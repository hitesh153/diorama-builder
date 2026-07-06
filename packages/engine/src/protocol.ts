import { z } from "zod";
import type { DioramaEvent } from "./eventBus";

/**
 * The public Diorama event protocol — the "bring your own agents" contract.
 *
 * Any system can visualize its agents by POSTing events to the dev server's
 * ingest endpoint (or streaming them over its WebSocket):
 *
 *   POST /api/ingest
 *   { "v": 1, "type": "task.started", "agent": "my-agent",
 *     "room": "Lab", "label": "running tests", "ts": 1751780000000 }
 *
 * Only `v`, `type`, and `agent` are required. `room` targets a room by
 * (fuzzy-matched) label; `label` overrides the feed text; `ts` defaults to
 * arrival time. Everything else goes in `payload`.
 */

export const PROTOCOL_VERSION = 1;

export const IngestEventSchema = z.object({
  /** Protocol version — always 1 for now */
  v: z.literal(PROTOCOL_VERSION),
  /** Event type, e.g. "task.started", "message.sent", "test.passed" */
  type: z.string().min(1),
  /** Agent identifier — creates the agent in the world if unknown */
  agent: z.string().min(1),
  /** Target room label (fuzzy-matched against the user's rooms) */
  room: z.string().optional(),
  /** Human-readable feed label (defaults to a derived one) */
  label: z.string().optional(),
  /** Unix millis; defaults to arrival time */
  ts: z.number().int().positive().optional(),
  /** Arbitrary extra data */
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type IngestEvent = z.infer<typeof IngestEventSchema>;

/** Batch form: a single event or an array of them. */
export const IngestBatchSchema = z.union([IngestEventSchema, z.array(IngestEventSchema).min(1).max(500)]);

export interface IngestParseOk {
  ok: true;
  events: IngestEvent[];
}
export interface IngestParseErr {
  ok: false;
  error: string;
}

/** Parse an ingest request body (object or array). Never throws. */
export function parseIngestBody(body: unknown): IngestParseOk | IngestParseErr {
  // Parse the concrete branch (not the union) so errors carry field paths.
  if (Array.isArray(body)) {
    if (body.length === 0) return { ok: false, error: "empty event array" };
    if (body.length > 500) return { ok: false, error: "batch too large (max 500)" };
    const events: IngestEvent[] = [];
    for (let i = 0; i < body.length; i++) {
      const result = IngestEventSchema.safeParse(body[i]);
      if (!result.success) {
        const issue = result.error.issues[0];
        const path = issue?.path?.length ? issue.path.join(".") : "event";
        return { ok: false, error: `[${i}] ${path}: ${issue?.message ?? "invalid"}` };
      }
      events.push(result.data);
    }
    return { ok: true, events };
  }

  const result = IngestEventSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "event";
    return { ok: false, error: `${path}: ${issue?.message ?? "invalid"}` };
  }
  return { ok: true, events: [result.data] };
}

/** Convert a validated ingest event to the internal DioramaEvent shape. */
export function ingestToDioramaEvent(event: IngestEvent, now: () => number = Date.now): DioramaEvent {
  return {
    type: event.type,
    room: event.room ?? "",
    agent: event.agent,
    payload: {
      ...(event.payload ?? {}),
      ...(event.label ? { label: event.label } : {}),
      source: "ingest",
    },
    timestamp: event.ts ?? now(),
  };
}
