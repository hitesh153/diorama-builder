import type { DioramaEvent } from "@diorama/engine";
import { connectCodexSessions } from "@diorama/plugins/sources/codexSessions";
import { connectClaudeCode } from "@diorama/plugins/sources/claudeCode";
import type { JsonlTailHandle } from "@diorama/plugins/sources/jsonlTail";

/**
 * Server-side event hub. Ingested events (POST /api/ingest) and local
 * connector events (Codex / Claude Code tailers) are published here and
 * fanned out to every subscribed browser via the SSE stream route.
 *
 * Module-level state persists for the life of the dev-server process.
 * Connectors are refcounted: they run while at least one stream subscriber
 * requested them and stop when the last one disconnects.
 */

type Subscriber = (event: DioramaEvent) => void;

// Next.js bundles each route separately, so plain module state would be
// duplicated per route (POST /api/ingest and the SSE stream would see
// different hubs). Anchor the state on globalThis to get one true hub.
interface HubState {
  subscribers: Set<Subscriber>;
  connectorHandles: Map<string, JsonlTailHandle>;
  connectorRefs: Map<string, number>;
}
const HUB_KEY = "__dioramaEventHub__";
const hub: HubState = ((globalThis as Record<string, unknown>)[HUB_KEY] as HubState) ?? {
  subscribers: new Set(),
  connectorHandles: new Map(),
  connectorRefs: new Map(),
};
(globalThis as Record<string, unknown>)[HUB_KEY] = hub;

const { subscribers, connectorHandles, connectorRefs } = hub;

export function publish(event: DioramaEvent): void {
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch {
      // never let one bad subscriber break the fan-out
    }
  }
}

export function subscribe(handler: Subscriber): () => void {
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
}

const CONNECTOR_FACTORIES: Record<string, (onEvent: (e: DioramaEvent) => void) => JsonlTailHandle> = {
  codex: (onEvent) => connectCodexSessions({ onEvent }),
  "claude-code": (onEvent) => connectClaudeCode({ onEvent }),
};

/** Acquire connectors for a subscriber; returns a release function. */
export function acquireConnectors(types: string[]): () => void {
  const acquired: string[] = [];
  for (const type of types) {
    const factory = CONNECTOR_FACTORIES[type];
    if (!factory) continue;
    const refs = connectorRefs.get(type) ?? 0;
    connectorRefs.set(type, refs + 1);
    acquired.push(type);
    if (refs === 0 && !connectorHandles.has(type)) {
      connectorHandles.set(type, factory(publish));
    }
  }
  return () => {
    for (const type of acquired) {
      const refs = (connectorRefs.get(type) ?? 1) - 1;
      connectorRefs.set(type, refs);
      if (refs <= 0) {
        connectorHandles.get(type)?.stop();
        connectorHandles.delete(type);
        connectorRefs.delete(type);
      }
    }
  };
}

/** Test/observability helper. */
export function hubStats(): { subscribers: number; connectors: string[] } {
  return { subscribers: subscribers.size, connectors: [...connectorHandles.keys()] };
}
