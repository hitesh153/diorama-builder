"use client";

import { useEffect } from "react";
import type { EventBus, DioramaEvent } from "@diorama/engine";

/**
 * Subscribes to the server's SSE event stream (/api/ingest/stream) and
 * dispatches everything into the shared EventBus. `sources` also asks the
 * server to run local connectors (codex, claude-code) while subscribed.
 */
export function useIngestEvents(eventBus: EventBus, active: boolean, sources: string[]) {
  // Stable key — the effect should re-run only when the actual set changes
  const sourcesKey = [...sources].sort().join(",");

  useEffect(() => {
    if (!active) return;

    const es = new EventSource(`/api/ingest/stream?sources=${encodeURIComponent(sourcesKey)}`);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as DioramaEvent;
        if (event && typeof event.type === "string") {
          eventBus.dispatch(event);
        }
      } catch {
        // skip malformed frames
      }
    };
    // EventSource auto-reconnects on error; nothing to do here.

    return () => {
      es.close();
    };
  }, [eventBus, active, sourcesKey]);
}
