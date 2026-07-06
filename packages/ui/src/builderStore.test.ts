import { describe, it, expect } from "vitest";
import {
  createBuilderState,
  builderReducer,
  type RoomPlacement,
} from "./builderStore";

function room(preset: string, x: number, y: number, w = 2, h = 2): RoomPlacement {
  return { id: `${preset}-${x}-${y}`, preset, position: [x, y], size: [w, h], label: preset };
}

describe("createBuilderState", () => {
  it("starts with empty rooms and no selection", () => {
    const state = createBuilderState();
    expect(state.rooms).toEqual([]);
    expect(state.selectedRoomId).toBeNull();
    expect(state.history.past).toEqual([]);
    expect(state.history.future).toEqual([]);
  });

  it("accepts initial rooms", () => {
    const state = createBuilderState([room("workspace", 0, 0)]);
    expect(state.rooms).toHaveLength(1);
  });
});

describe("builderReducer", () => {
  it("adds a room", () => {
    const state = createBuilderState();
    const next = builderReducer(state, {
      type: "ADD_ROOM",
      room: room("meeting", 0, 0, 3, 3),
    });
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0].preset).toBe("meeting");
  });

  it("records history on add (enables undo)", () => {
    const state = createBuilderState();
    const next = builderReducer(state, {
      type: "ADD_ROOM",
      room: room("workspace", 0, 0),
    });
    expect(next.history.past).toHaveLength(1);
    expect(next.history.future).toEqual([]);
  });

  it("removes a room by id", () => {
    const state = createBuilderState([room("a", 0, 0), room("b", 2, 0)]);
    const next = builderReducer(state, { type: "REMOVE_ROOM", roomId: "a-0-0" });
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0].id).toBe("b-2-0");
  });

  it("moves a room to new position", () => {
    const state = createBuilderState([room("a", 0, 0)]);
    const next = builderReducer(state, {
      type: "MOVE_ROOM",
      roomId: "a-0-0",
      position: [5, 3],
    });
    expect(next.rooms[0].position).toEqual([5, 3]);
  });

  it("resizes a room", () => {
    const state = createBuilderState([room("a", 0, 0, 2, 2)]);
    const next = builderReducer(state, {
      type: "RESIZE_ROOM",
      roomId: "a-0-0",
      size: [4, 3],
    });
    expect(next.rooms[0].size).toEqual([4, 3]);
  });

  it("updates room label", () => {
    const state = createBuilderState([room("a", 0, 0)]);
    const next = builderReducer(state, {
      type: "UPDATE_ROOM",
      roomId: "a-0-0",
      updates: { label: "My Custom Room" },
    });
    expect(next.rooms[0].label).toBe("My Custom Room");
  });

  it("selects a room", () => {
    const state = createBuilderState([room("a", 0, 0)]);
    const next = builderReducer(state, { type: "SELECT_ROOM", roomId: "a-0-0" });
    expect(next.selectedRoomId).toBe("a-0-0");
  });

  it("deselects room", () => {
    let state = createBuilderState([room("a", 0, 0)]);
    state = builderReducer(state, { type: "SELECT_ROOM", roomId: "a-0-0" });
    const next = builderReducer(state, { type: "SELECT_ROOM", roomId: null });
    expect(next.selectedRoomId).toBeNull();
  });

  describe("click-to-deselect (empty space)", () => {
    it("deselecting preserves all room data unchanged", () => {
      const rooms = [room("a", 0, 0, 3, 3), room("b", 4, 0, 2, 2)];
      let state = createBuilderState(rooms);
      state = builderReducer(state, { type: "SELECT_ROOM", roomId: "a-0-0" });
      const next = builderReducer(state, { type: "SELECT_ROOM", roomId: null });
      expect(next.selectedRoomId).toBeNull();
      expect(next.rooms).toEqual(state.rooms);
    });

    it("deselecting when already deselected is a no-op (same state ref)", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      expect(state.selectedRoomId).toBeNull();
      const next = builderReducer(state, { type: "SELECT_ROOM", roomId: null });
      expect(next).toBe(state);
    });

    it("deselect does not push to undo history", () => {
      let state = createBuilderState([room("a", 0, 0)]);
      state = builderReducer(state, { type: "SELECT_ROOM", roomId: "a-0-0" });
      const historyBefore = state.history.past.length;
      const next = builderReducer(state, { type: "SELECT_ROOM", roomId: null });
      expect(next.history.past).toHaveLength(historyBefore);
    });
  });

  describe("undo/redo", () => {
    it("undoes the last action", () => {
      let state = createBuilderState();
      state = builderReducer(state, { type: "ADD_ROOM", room: room("a", 0, 0) });
      expect(state.rooms).toHaveLength(1);

      state = builderReducer(state, { type: "UNDO" });
      expect(state.rooms).toHaveLength(0);
    });

    it("redoes an undone action", () => {
      let state = createBuilderState();
      state = builderReducer(state, { type: "ADD_ROOM", room: room("a", 0, 0) });
      state = builderReducer(state, { type: "UNDO" });
      expect(state.rooms).toHaveLength(0);

      state = builderReducer(state, { type: "REDO" });
      expect(state.rooms).toHaveLength(1);
    });

    it("clears future on new action after undo", () => {
      let state = createBuilderState();
      state = builderReducer(state, { type: "ADD_ROOM", room: room("a", 0, 0) });
      state = builderReducer(state, { type: "UNDO" });
      expect(state.history.future).toHaveLength(1);

      state = builderReducer(state, { type: "ADD_ROOM", room: room("b", 2, 0) });
      expect(state.history.future).toEqual([]);
    });

    it("does nothing on undo with empty history", () => {
      const state = createBuilderState();
      const next = builderReducer(state, { type: "UNDO" });
      expect(next).toBe(state);
    });

    it("does nothing on redo with empty future", () => {
      const state = createBuilderState();
      const next = builderReducer(state, { type: "REDO" });
      expect(next).toBe(state);
    });

    it("supports multiple undos", () => {
      let state = createBuilderState();
      state = builderReducer(state, { type: "ADD_ROOM", room: room("a", 0, 0) });
      state = builderReducer(state, { type: "ADD_ROOM", room: room("b", 2, 0) });
      state = builderReducer(state, { type: "ADD_ROOM", room: room("c", 4, 0) });
      expect(state.rooms).toHaveLength(3);

      state = builderReducer(state, { type: "UNDO" });
      state = builderReducer(state, { type: "UNDO" });
      expect(state.rooms).toHaveLength(1);
      expect(state.rooms[0].id).toBe("a-0-0");
    });
  });

  describe("overlap detection", () => {
    it("prevents adding a room that overlaps an existing one", () => {
      const state = createBuilderState([room("a", 0, 0, 3, 3)]);
      const next = builderReducer(state, {
        type: "ADD_ROOM",
        room: room("b", 1, 1, 2, 2), // overlaps a
      });
      // Should reject — rooms unchanged
      expect(next.rooms).toHaveLength(1);
    });

    it("allows adding a room that does not overlap", () => {
      const state = createBuilderState([room("a", 0, 0, 2, 2)]);
      const next = builderReducer(state, {
        type: "ADD_ROOM",
        room: room("b", 3, 0, 2, 2), // no overlap
      });
      expect(next.rooms).toHaveLength(2);
    });

    it("prevents moving a room into an overlapping position", () => {
      const state = createBuilderState([room("a", 0, 0, 2, 2), room("b", 4, 0, 2, 2)]);
      const next = builderReducer(state, {
        type: "MOVE_ROOM",
        roomId: "b-4-0",
        position: [1, 0], // would overlap a
      });
      // Should reject — position unchanged
      expect(next.rooms.find((r) => r.id === "b-4-0")!.position).toEqual([4, 0]);
    });

    it("prevents resizing a room into an overlapping size", () => {
      const state = createBuilderState([room("a", 0, 0, 2, 2), room("b", 3, 0, 2, 2)]);
      const next = builderReducer(state, {
        type: "RESIZE_ROOM",
        roomId: "a-0-0",
        size: [4, 2], // would overlap b (extends from 0 to 4, b starts at 3)
      });
      // Should reject — size unchanged
      expect(next.rooms.find((r) => r.id === "a-0-0")!.size).toEqual([2, 2]);
    });
  });

  describe("SET_ROOM_COLORS", () => {
    it("updates room colors and pushes history", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      const next = builderReducer(state, {
        type: "SET_ROOM_COLORS",
        roomId: "a-0-0",
        colors: { accent: "#ff0000", floor: "#00ff00" },
      });
      expect(next.rooms[0].colors).toEqual({ accent: "#ff0000", floor: "#00ff00" });
      expect(next.history.past).toHaveLength(1);
    });

    it("clears colors when set to undefined", () => {
      let state = createBuilderState([room("a", 0, 0)]);
      state = builderReducer(state, {
        type: "SET_ROOM_COLORS",
        roomId: "a-0-0",
        colors: { accent: "#ff0000" },
      });
      const next = builderReducer(state, {
        type: "SET_ROOM_COLORS",
        roomId: "a-0-0",
        colors: undefined,
      });
      expect(next.rooms[0].colors).toBeUndefined();
      expect(next.history.past).toHaveLength(2);
    });
  });

  describe("ADD_FURNITURE", () => {
    const chair = {
      geometry: "cylinder" as const,
      size: [0.2, 0.7, 0.2] as [number, number, number],
      position: [0, 0.35, 0] as [number, number, number],
      material: { color: "#333" },
    };

    it("adds item to room without existing furniture (creates array)", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      const next = builderReducer(state, {
        type: "ADD_FURNITURE",
        roomId: "a-0-0",
        item: chair,
      });
      expect(next.rooms[0].furniture).toHaveLength(1);
      expect(next.rooms[0].furniture![0].geometry).toBe("cylinder");
      expect(next.history.past).toHaveLength(1);
    });

    it("adds to room with existing furniture", () => {
      let state = createBuilderState([room("a", 0, 0)]);
      state = builderReducer(state, {
        type: "ADD_FURNITURE",
        roomId: "a-0-0",
        item: chair,
      });
      const desk = {
        geometry: "box" as const,
        size: [1.2, 0.08, 0.6] as [number, number, number],
        position: [0, 0.75, 0] as [number, number, number],
        material: { color: "#1a2a40" },
      };
      const next = builderReducer(state, {
        type: "ADD_FURNITURE",
        roomId: "a-0-0",
        item: desk,
      });
      expect(next.rooms[0].furniture).toHaveLength(2);
      expect(next.rooms[0].furniture![1].geometry).toBe("box");
    });
  });

  describe("REMOVE_FURNITURE", () => {
    const chair = {
      geometry: "cylinder" as const,
      size: [0.2, 0.7, 0.2] as [number, number, number],
      position: [0, 0.35, 0] as [number, number, number],
      material: { color: "#333" },
    };

    it("removes furniture by index", () => {
      let state = createBuilderState([room("a", 0, 0)]);
      state = builderReducer(state, { type: "ADD_FURNITURE", roomId: "a-0-0", item: chair });
      const desk = {
        geometry: "box" as const,
        size: [1.2, 0.08, 0.6] as [number, number, number],
        position: [0, 0.75, 0] as [number, number, number],
        material: { color: "#1a2a40" },
      };
      state = builderReducer(state, { type: "ADD_FURNITURE", roomId: "a-0-0", item: desk });
      expect(state.rooms[0].furniture).toHaveLength(2);

      const next = builderReducer(state, {
        type: "REMOVE_FURNITURE",
        roomId: "a-0-0",
        furnitureIndex: 0,
      });
      expect(next.rooms[0].furniture).toHaveLength(1);
      expect(next.rooms[0].furniture![0].geometry).toBe("box");
      expect(next.history.past).toHaveLength(3);
    });

    it("is a no-op on room without furniture", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      const next = builderReducer(state, {
        type: "REMOVE_FURNITURE",
        roomId: "a-0-0",
        furnitureIndex: 0,
      });
      expect(next).toBe(state);
    });
  });

  describe("SET_FLOOR_STYLE", () => {
    it("sets floorStyle on the specified room", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      const next = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "a-0-0",
        floorStyle: "wood-planks",
      });
      expect(next.rooms[0].floorStyle).toBe("wood-planks");
    });

    it("clears floorStyle when set to undefined", () => {
      let state = createBuilderState([room("a", 0, 0)]);
      state = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "a-0-0",
        floorStyle: "hex-tiles",
      });
      const next = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "a-0-0",
        floorStyle: undefined,
      });
      expect(next.rooms[0].floorStyle).toBeUndefined();
    });

    it("pushes history on SET_FLOOR_STYLE", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      const next = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "a-0-0",
        floorStyle: "carpet",
      });
      expect(next.history.past).toHaveLength(1);
    });

    it("ignores unknown roomId", () => {
      const state = createBuilderState([room("a", 0, 0)]);
      const next = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "nonexistent",
        floorStyle: "grid-tiles",
      });
      expect(next).toBe(state);
    });

    it("sets floorStyle on a custom room", () => {
      const state = createBuilderState([room("custom", 0, 0)]);
      const next = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "custom-0-0",
        floorStyle: "wood-planks",
      });
      expect(next.rooms[0].floorStyle).toBe("wood-planks");
      expect(next.rooms[0].preset).toBe("custom");
    });

    it("clears floorStyle override on custom room", () => {
      let state = createBuilderState([room("custom", 0, 0)]);
      state = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "custom-0-0",
        floorStyle: "hex-tiles",
      });
      const next = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "custom-0-0",
        floorStyle: undefined,
      });
      expect(next.rooms[0].floorStyle).toBeUndefined();
    });

    it("undo restores previous floor style", () => {
      let state = createBuilderState([room("workspace", 0, 0)]);
      state = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "workspace-0-0",
        floorStyle: "grid-tiles",
      });
      expect(state.rooms[0].floorStyle).toBe("grid-tiles");
      state = builderReducer(state, { type: "UNDO" });
      expect(state.rooms[0].floorStyle).toBeUndefined();
    });

    it("redo re-applies floor style", () => {
      let state = createBuilderState([room("workspace", 0, 0)]);
      state = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "workspace-0-0",
        floorStyle: "carpet",
      });
      state = builderReducer(state, { type: "UNDO" });
      state = builderReducer(state, { type: "REDO" });
      expect(state.rooms[0].floorStyle).toBe("carpet");
    });

    it("preserves other room fields when setting floor style", () => {
      let state = createBuilderState([room("meeting", 1, 2, 3, 4)]);
      state = builderReducer(state, {
        type: "SET_FLOOR_STYLE",
        roomId: "meeting-1-2",
        floorStyle: "hex-tiles",
      });
      expect(state.rooms[0].preset).toBe("meeting");
      expect(state.rooms[0].position).toEqual([1, 2]);
      expect(state.rooms[0].size).toEqual([3, 4]);
      expect(state.rooms[0].label).toBe("meeting");
    });
  });
});
