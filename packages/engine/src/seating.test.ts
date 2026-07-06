import { describe, it, expect } from "vitest";
import {
  resolveRoomFurniture,
  isSeatingItem,
  furnitureDisplayName,
  buildSeatOptions,
  resolveSeatRef,
} from "./seating";
import { getFurniture, type FurnitureItem } from "./roomPresets";
import type { RoomConfig } from "./config";

const meetingRoom: RoomConfig = {
  preset: "meeting",
  position: [0, 0],
  size: [4, 3],
  label: "Meeting Room",
};

const customChair: FurnitureItem = {
  geometry: "box",
  size: [0.5, 0.9, 0.5],
  position: [1, 0, 1],
  label: "Desk Chair",
  material: { color: "#333" },
};

const customTable: FurnitureItem = {
  geometry: "box",
  size: [2, 0.1, 1],
  position: [0, 0, 0],
  label: "Table",
  material: { color: "#333" },
};

describe("resolveRoomFurniture", () => {
  it("falls back to preset furniture when room has none", () => {
    const furniture = resolveRoomFurniture(meetingRoom, "neon-dark");
    expect(furniture).toEqual(getFurniture("meeting", "neon-dark"));
    expect(furniture.length).toBeGreaterThan(0);
  });

  it("prefers explicit room furniture over preset defaults", () => {
    const room = { ...meetingRoom, furniture: [customChair] };
    expect(resolveRoomFurniture(room, "neon-dark")).toEqual([customChair]);
  });

  it("treats an empty furniture array as unset", () => {
    const room = { ...meetingRoom, furniture: [] };
    expect(resolveRoomFurniture(room, "neon-dark").length).toBeGreaterThan(0);
  });
});

describe("isSeatingItem", () => {
  it("detects seating by label keyword", () => {
    expect(isSeatingItem(customChair)).toBe(true);
    expect(isSeatingItem(customTable)).toBe(false);
  });

  it("detects unlabeled preset chairs via glbPath", () => {
    const presetFurniture = getFurniture("meeting", "neon-dark");
    const seats = presetFurniture.filter(isSeatingItem);
    // meeting preset = 1 table + 6-chair ring
    expect(seats.length).toBe(6);
  });

  it("does not flag desks", () => {
    const item: FurnitureItem = {
      geometry: "box",
      size: [1, 0.1, 0.6],
      position: [0, 0, 0],
      material: { color: "#333" },
      glbPath: "/models/kenney-furniture/desk.glb",
    };
    expect(isSeatingItem(item)).toBe(false);
  });
});

describe("furnitureDisplayName", () => {
  it("uses the label when present", () => {
    expect(furnitureDisplayName(customChair, 0)).toBe("Desk Chair");
  });

  it("derives a name from the glb filename", () => {
    const item: FurnitureItem = {
      geometry: "cylinder",
      size: [0.2, 0.7, 0.2],
      position: [0, 0, 0],
      material: { color: "#333" },
      glbPath: "/models/kenney-furniture/chair.glb",
    };
    expect(furnitureDisplayName(item, 3)).toBe("Chair");
  });

  it("falls back to a numbered item", () => {
    const item: FurnitureItem = {
      geometry: "box",
      size: [1, 1, 1],
      position: [0, 0, 0],
      material: { color: "#333" },
    };
    expect(furnitureDisplayName(item, 2)).toBe("Item 3");
  });
});

describe("buildSeatOptions", () => {
  it("offers preset seats for rooms without explicit furniture", () => {
    const options = buildSeatOptions([meetingRoom], "neon-dark");
    expect(options.length).toBe(6);
    expect(options[0].room).toBe("Meeting Room");
    expect(options[0].value).toMatch(/^Meeting Room::\d+$/);
  });

  it("indexes seat values into the resolved furniture list", () => {
    const options = buildSeatOptions([meetingRoom], "neon-dark");
    const furniture = resolveRoomFurniture(meetingRoom, "neon-dark");
    for (const opt of options) {
      const idx = Number(opt.value.split("::").pop());
      expect(isSeatingItem(furniture[idx])).toBe(true);
    }
  });

  it("only offers seating from explicit furniture", () => {
    const room = { ...meetingRoom, furniture: [customTable, customChair] };
    const options = buildSeatOptions([room], "neon-dark");
    expect(options.length).toBe(1);
    expect(options[0].value).toBe("Meeting Room::1");
  });

  it("spans multiple rooms", () => {
    const workspace: RoomConfig = {
      preset: "workspace",
      position: [4, 0],
      size: [5, 4],
      label: "Workspace",
    };
    const options = buildSeatOptions([meetingRoom, workspace], "neon-dark");
    const roomsSeen = new Set(options.map((o) => o.room));
    expect(roomsSeen.has("Meeting Room")).toBe(true);
    expect(roomsSeen.has("Workspace")).toBe(true);
  });
});

describe("resolveSeatRef", () => {
  it("resolves a valid preset seat reference", () => {
    const options = buildSeatOptions([meetingRoom], "neon-dark");
    const resolved = resolveSeatRef([meetingRoom], "neon-dark", options[0].value);
    expect(resolved).not.toBeNull();
    expect(resolved!.roomIndex).toBe(0);
    expect(isSeatingItem(resolved!.item)).toBe(true);
  });

  it("returns null for unknown rooms", () => {
    expect(resolveSeatRef([meetingRoom], "neon-dark", "Nowhere::1")).toBeNull();
  });

  it("returns null for out-of-range indices", () => {
    expect(resolveSeatRef([meetingRoom], "neon-dark", "Meeting Room::99")).toBeNull();
  });

  it("returns null when the index points at non-seating furniture", () => {
    // meeting preset index 0 is the table
    expect(resolveSeatRef([meetingRoom], "neon-dark", "Meeting Room::0")).toBeNull();
  });

  it("returns null for malformed refs", () => {
    expect(resolveSeatRef([meetingRoom], "neon-dark", "")).toBeNull();
    expect(resolveSeatRef([meetingRoom], "neon-dark", "Meeting Room")).toBeNull();
    expect(resolveSeatRef([meetingRoom], "neon-dark", "::3")).toBeNull();
    expect(resolveSeatRef([meetingRoom], "neon-dark", "Meeting Room::abc")).toBeNull();
  });

  it("handles room labels containing colons", () => {
    const weird = { ...meetingRoom, label: "Room: A" };
    const options = buildSeatOptions([weird], "neon-dark");
    const resolved = resolveSeatRef([weird], "neon-dark", options[0].value);
    expect(resolved).not.toBeNull();
  });
});
