import { describe, it, expect } from "vitest";
import { normalizeRoomName, matchRoomIndex } from "./roomMatch";

const rooms = [
  { label: "Meeting Room" },
  { label: "Workspace" },
  { label: "Test Lab" },
  { label: "Social Lounge" },
];

describe("normalizeRoomName", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizeRoomName("Meeting Room")).toBe("meeting-room");
    expect(normalizeRoomName("test_lab")).toBe("test-lab");
    expect(normalizeRoomName("  Comms  Hub  ")).toBe("comms-hub");
  });

  it("strips leading/trailing separators", () => {
    expect(normalizeRoomName("--lab--")).toBe("lab");
  });
});

describe("matchRoomIndex", () => {
  it("matches exact labels case-insensitively", () => {
    expect(matchRoomIndex(rooms, "meeting room")).toBe(0);
    expect(matchRoomIndex(rooms, "MEETING-ROOM")).toBe(0);
  });

  it("matches slug forms of labels", () => {
    expect(matchRoomIndex(rooms, "test-lab")).toBe(2);
    expect(matchRoomIndex(rooms, "social_lounge")).toBe(3);
  });

  it("matches by containment", () => {
    expect(matchRoomIndex(rooms, "lab")).toBe(2);
    expect(matchRoomIndex(rooms, "lounge")).toBe(3);
  });

  it("matches when the event name contains the room label", () => {
    expect(matchRoomIndex(rooms, "main-workspace")).toBe(1);
  });

  it("returns -1 when nothing matches — never a random room", () => {
    expect(matchRoomIndex(rooms, "council-chamber")).toBe(-1);
    expect(matchRoomIndex(rooms, "")).toBe(-1);
  });

  it("prefers exact match over containment", () => {
    const ambiguous = [{ label: "Lab Annex" }, { label: "Lab" }];
    expect(matchRoomIndex(ambiguous, "lab")).toBe(1);
  });
});
