import { subscribe, acquireConnectors } from "@/lib/eventHub";

export const dynamic = "force-dynamic";

/**
 * SSE stream of hub events for the browser. `?sources=codex,claude-code`
 * additionally starts those local connectors while this stream is open
 * (refcounted — they stop when the last subscriber leaves).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sources = (url.searchParams.get("sources") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const releaseConnectors = acquireConnectors(sources);
      const unsubscribe = subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed — cleanup happens in cancel()
        }
      });
      // Keep-alive comments so proxies don't kill the connection
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          // closed
        }
      }, 15000);
      keepAlive.unref?.();

      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
        releaseConnectors();
      };

      controller.enqueue(encoder.encode(`: connected sources=${sources.join(",") || "none"}\n\n`));
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
