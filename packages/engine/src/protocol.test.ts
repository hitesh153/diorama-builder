import { describe, it, expect } from "vitest";
import { parseIngestBody, ingestToDioramaEvent, PROTOCOL_VERSION } from "./protocol";

const valid = { v: 1, type: "task.started", agent: "my-agent" };

describe("parseIngestBody", () => {
  it("accepts a minimal single event", () => {
    const r = parseIngestBody(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events).toHaveLength(1);
  });

  it("accepts the full shape", () => {
    const r = parseIngestBody({
      ...valid,
      room: "Lab",
      label: "running tests",
      ts: 1751780000000,
      payload: { pr: 42 },
    });
    expect(r.ok).toBe(true);
  });

  it("accepts an array batch", () => {
    const r = parseIngestBody([valid, { ...valid, type: "task.done" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events).toHaveLength(2);
  });

  it("rejects missing required fields with a path in the error", () => {
    const r = parseIngestBody({ v: 1, type: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("agent");
  });

  it("rejects wrong version", () => {
    expect(parseIngestBody({ ...valid, v: 2 }).ok).toBe(false);
  });

  it("rejects empty strings and non-objects", () => {
    expect(parseIngestBody({ ...valid, agent: "" }).ok).toBe(false);
    expect(parseIngestBody("nope").ok).toBe(false);
    expect(parseIngestBody(null).ok).toBe(false);
    expect(parseIngestBody([]).ok).toBe(false);
  });

  it("caps batch size at 500", () => {
    const big = Array.from({ length: 501 }, () => valid);
    expect(parseIngestBody(big).ok).toBe(false);
  });
});

describe("ingestToDioramaEvent", () => {
  it("maps fields and defaults timestamp to now", () => {
    const event = ingestToDioramaEvent({ v: PROTOCOL_VERSION, type: "t", agent: "a" }, () => 123);
    expect(event).toMatchObject({ type: "t", agent: "a", room: "", timestamp: 123 });
    expect((event.payload as { source: string }).source).toBe("ingest");
  });

  it("preserves explicit ts, room, label, payload", () => {
    const event = ingestToDioramaEvent({
      v: PROTOCOL_VERSION,
      type: "t",
      agent: "a",
      room: "Lab",
      label: "doing things",
      ts: 42,
      payload: { x: 1 },
    });
    expect(event.timestamp).toBe(42);
    expect(event.room).toBe("Lab");
    expect(event.payload).toMatchObject({ x: 1, label: "doing things" });
  });
});
