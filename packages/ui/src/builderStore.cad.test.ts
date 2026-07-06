import { describe, it, expect } from "vitest";
import {
  createBuilderState,
  builderReducer,
  type BuilderState,
  type RoomPlacement,
} from "./builderStore";

function room(id: string, x: number, y: number, w = 2, h = 2): RoomPlacement {
  return { id, preset: "workspace", position: [x, y], size: [w, h], label: id };
}

function stateWith(...rooms: RoomPlacement[]): BuilderState {
  return createBuilderState(rooms);
}

describe("multi-select", () => {
  it("SELECT_ROOM sets both primary and set", () => {
    const s = builderReducer(stateWith(room("a", 0, 0)), { type: "SELECT_ROOM", roomId: "a" });
    expect(s.selectedRoomId).toBe("a");
    expect(s.selectedRoomIds).toEqual(["a"]);
  });

  it("SELECT_ROOM null clears the set", () => {
    let s = builderReducer(stateWith(room("a", 0, 0)), { type: "SELECT_ROOM", roomId: "a" });
    s = builderReducer(s, { type: "SELECT_ROOM", roomId: null });
    expect(s.selectedRoomId).toBeNull();
    expect(s.selectedRoomIds).toEqual([]);
  });

  it("TOGGLE_SELECT_ROOM adds and removes from the set", () => {
    let s = stateWith(room("a", 0, 0), room("b", 3, 0));
    s = builderReducer(s, { type: "SELECT_ROOM", roomId: "a" });
    s = builderReducer(s, { type: "TOGGLE_SELECT_ROOM", roomId: "b" });
    expect(s.selectedRoomIds).toEqual(["a", "b"]);
    expect(s.selectedRoomId).toBe("b");
    s = builderReducer(s, { type: "TOGGLE_SELECT_ROOM", roomId: "a" });
    expect(s.selectedRoomIds).toEqual(["b"]);
    expect(s.selectedRoomId).toBe("b");
  });

  it("SELECT_ROOMS filters unknown ids", () => {
    let s = stateWith(room("a", 0, 0), room("b", 3, 0));
    s = builderReducer(s, { type: "SELECT_ROOMS", roomIds: ["a", "ghost", "b"] });
    expect(s.selectedRoomIds).toEqual(["a", "b"]);
    expect(s.selectedRoomId).toBe("b");
  });

  it("REMOVE_ROOM prunes the selection set", () => {
    let s = stateWith(room("a", 0, 0), room("b", 3, 0));
    s = builderReducer(s, { type: "SELECT_ROOMS", roomIds: ["a", "b"] });
    s = builderReducer(s, { type: "REMOVE_ROOM", roomId: "b" });
    expect(s.selectedRoomIds).toEqual(["a"]);
    expect(s.selectedRoomId).toBe("a");
  });
});

describe("NUDGE_ROOMS", () => {
  it("moves a single room by the delta", () => {
    let s = stateWith(room("a", 1, 1));
    s = builderReducer(s, { type: "NUDGE_ROOMS", roomIds: ["a"], delta: [1, 0] });
    expect(s.rooms[0].position).toEqual([2, 1]);
  });

  it("moves a group rigidly", () => {
    let s = stateWith(room("a", 0, 0), room("b", 3, 0));
    s = builderReducer(s, { type: "NUDGE_ROOMS", roomIds: ["a", "b"], delta: [0, 2] });
    expect(s.rooms[0].position).toEqual([0, 2]);
    expect(s.rooms[1].position).toEqual([3, 2]);
  });

  it("rejects collision with a non-group room", () => {
    const s0 = stateWith(room("a", 0, 0), room("b", 2, 0));
    const s = builderReducer(s0, { type: "NUDGE_ROOMS", roomIds: ["a"], delta: [1, 0] });
    expect(s).toBe(s0);
  });

  it("allows a group to move past internal adjacency", () => {
    let s = stateWith(room("a", 0, 0), room("b", 2, 0));
    s = builderReducer(s, { type: "NUDGE_ROOMS", roomIds: ["a", "b"], delta: [1, 0] });
    expect(s.rooms[0].position).toEqual([1, 0]);
    expect(s.rooms[1].position).toEqual([3, 0]);
  });

  it("rejects negative positions", () => {
    const s0 = stateWith(room("a", 0, 0));
    const s = builderReducer(s0, { type: "NUDGE_ROOMS", roomIds: ["a"], delta: [-1, 0] });
    expect(s).toBe(s0);
  });

  it("is undoable", () => {
    let s = stateWith(room("a", 0, 0));
    s = builderReducer(s, { type: "NUDGE_ROOMS", roomIds: ["a"], delta: [2, 0] });
    s = builderReducer(s, { type: "UNDO" });
    expect(s.rooms[0].position).toEqual([0, 0]);
  });
});

describe("DUPLICATE_ROOM", () => {
  it("clones the room at a free position and selects the copy", () => {
    let s = stateWith(room("a", 0, 0));
    s = builderReducer(s, { type: "DUPLICATE_ROOM", roomId: "a", newId: "a2" });
    expect(s.rooms).toHaveLength(2);
    const copy = s.rooms[1];
    expect(copy.id).toBe("a2");
    expect(copy.label).toBe("a Copy");
    expect(copy.size).toEqual([2, 2]);
    expect(copy.position).not.toEqual([0, 0]);
    expect(s.selectedRoomId).toBe("a2");
  });

  it("deep-copies furniture", () => {
    const src = { ...room("a", 0, 0), furniture: [{ geometry: "box" as const, size: [1, 1, 1] as [number, number, number], position: [0, 0, 0] as [number, number, number], material: { color: "#fff" } }] };
    let s = stateWith(src);
    s = builderReducer(s, { type: "DUPLICATE_ROOM", roomId: "a", newId: "a2" });
    expect(s.rooms[1].furniture).toEqual(src.furniture);
    expect(s.rooms[1].furniture).not.toBe(src.furniture);
  });

  it("no-ops for unknown room", () => {
    const s0 = stateWith(room("a", 0, 0));
    expect(builderReducer(s0, { type: "DUPLICATE_ROOM", roomId: "zzz", newId: "z2" })).toBe(s0);
  });
});

describe("furniture selection and editing", () => {
  const chair = {
    geometry: "box" as const,
    size: [0.5, 0.9, 0.5] as [number, number, number],
    position: [1, 0, 1] as [number, number, number],
    label: "Chair",
    material: { color: "#333" },
  };

  it("SELECT_FURNITURE selects and syncs room selection", () => {
    let s = stateWith({ ...room("a", 0, 0), furniture: [chair] });
    s = builderReducer(s, { type: "SELECT_FURNITURE", ref: { roomId: "a", index: 0 } });
    expect(s.selectedFurniture).toEqual({ roomId: "a", index: 0 });
    expect(s.selectedRoomId).toBe("a");
  });

  it("SELECT_ROOM clears furniture selection", () => {
    let s = stateWith({ ...room("a", 0, 0), furniture: [chair] }, room("b", 5, 5));
    s = builderReducer(s, { type: "SELECT_FURNITURE", ref: { roomId: "a", index: 0 } });
    s = builderReducer(s, { type: "SELECT_ROOM", roomId: "b" });
    expect(s.selectedFurniture).toBeNull();
  });

  it("UPDATE_FURNITURE patches position and rotation", () => {
    let s = stateWith({ ...room("a", 0, 0), furniture: [chair] });
    s = builderReducer(s, {
      type: "UPDATE_FURNITURE",
      roomId: "a",
      furnitureIndex: 0,
      updates: { position: [2, 0, 0], rotation: [0, Math.PI / 2, 0] },
    });
    expect(s.rooms[0].furniture![0].position).toEqual([2, 0, 0]);
    expect(s.rooms[0].furniture![0].rotation).toEqual([0, Math.PI / 2, 0]);
    expect(s.rooms[0].furniture![0].label).toBe("Chair");
  });

  it("UPDATE_FURNITURE no-ops on bad index", () => {
    const s0 = stateWith({ ...room("a", 0, 0), furniture: [chair] });
    expect(
      builderReducer(s0, { type: "UPDATE_FURNITURE", roomId: "a", furnitureIndex: 5, updates: {} }),
    ).toBe(s0);
  });

  it("REMOVE_FURNITURE clears or shifts the furniture selection", () => {
    let s = stateWith({ ...room("a", 0, 0), furniture: [chair, { ...chair, label: "Chair 2" }] });
    s = builderReducer(s, { type: "SELECT_FURNITURE", ref: { roomId: "a", index: 1 } });
    s = builderReducer(s, { type: "REMOVE_FURNITURE", roomId: "a", furnitureIndex: 0 });
    expect(s.selectedFurniture).toEqual({ roomId: "a", index: 0 });
    s = builderReducer(s, { type: "REMOVE_FURNITURE", roomId: "a", furnitureIndex: 0 });
    expect(s.selectedFurniture).toBeNull();
  });

  it("UPDATE_FURNITURE is undoable", () => {
    let s = stateWith({ ...room("a", 0, 0), furniture: [chair] });
    s = builderReducer(s, {
      type: "UPDATE_FURNITURE",
      roomId: "a",
      furnitureIndex: 0,
      updates: { position: [3, 0, 3] },
    });
    s = builderReducer(s, { type: "UNDO" });
    expect(s.rooms[0].furniture![0].position).toEqual([1, 0, 1]);
  });
});
