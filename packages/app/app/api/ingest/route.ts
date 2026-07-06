import { NextResponse } from "next/server";
import { parseIngestBody, ingestToDioramaEvent } from "@diorama/engine";
import { publish } from "@/lib/eventHub";

/**
 * Public event-ingest endpoint — the "bring your own agents" protocol.
 * See packages/engine/src/protocol.ts and docs/connectors.md.
 *
 *   curl -X POST localhost:3456/api/ingest -H 'content-type: application/json' \
 *     -d '{"v":1,"type":"task.started","agent":"my-agent","room":"Lab"}'
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parseIngestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });
  }

  for (const event of parsed.events) {
    publish(ingestToDioramaEvent(event));
  }
  return NextResponse.json({ ok: true, accepted: parsed.events.length });
}
