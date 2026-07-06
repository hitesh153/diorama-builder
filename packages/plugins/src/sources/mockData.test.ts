import { describe, it, expect } from "vitest";
import { mockDataPlugin, createMockEventStream } from "./mockData";

describe("mockDataPlugin", () => {
  it("has correct plugin metadata", () => {
    expect(mockDataPlugin.kind).toBe("source");
    expect(mockDataPlugin.type).toBe("mock-data");
  });

  it("has connect and disconnect methods", () => {
    expect(typeof mockDataPlugin.connect).toBe("function");
    expect(typeof mockDataPlugin.disconnect).toBe("function");
  });
});

describe("createMockEventStream", () => {
  it("generates events with valid structure", () => {
    const events = createMockEventStream(5);
    expect(events).toHaveLength(5);
    for (const event of events) {
      expect(event.type).toBeTruthy();
      expect(event.room).toBeTruthy();
      expect(event.agent).toBeTruthy();
      expect(typeof event.timestamp).toBe("number");
    }
  });

  it("generates events in chronological order", () => {
    const events = createMockEventStream(10);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }
  });

  it("generates a full pipeline sequence when count is sufficient", () => {
    const events = createMockEventStream(20);
    const types = events.map((e) => e.type);
    // Should include intake, council, sentinel events
    expect(types.some((t) => t.includes("intake"))).toBe(true);
    expect(types.some((t) => t.includes("council"))).toBe(true);
    expect(types.some((t) => t.includes("sentinel"))).toBe(true);
  });
});

describe("createMockEventStream room remapping", () => {
  it("remaps mock rooms onto provided room labels", () => {
    const labels = ["Meeting Room", "Workspace", "Lab"];
    const events = createMockEventStream(20, labels);
    for (const event of events) {
      expect(labels).toContain(event.room);
    }
  });

  it("maps each distinct mock room to a stable real room", () => {
    const labels = ["A", "B"];
    const a = createMockEventStream(20, labels);
    const b = createMockEventStream(20, labels);
    expect(a.map((e) => e.room)).toEqual(b.map((e) => e.room));
  });

  it("uses original mock rooms when no labels provided", () => {
    const events = createMockEventStream(5);
    expect(events[0].room).toBe("reception");
  });

  it("handles a single-room world", () => {
    const events = createMockEventStream(20, ["Only Room"]);
    expect(events.every((e) => e.room === "Only Room")).toBe(true);
  });

  it("ignores an empty labels array", () => {
    const events = createMockEventStream(5, []);
    expect(events[0].room).toBe("reception");
  });
});
