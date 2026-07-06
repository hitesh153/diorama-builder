import { describe, it, expect } from "vitest";
import { createBuilderState, builderReducer, type BuilderState, type RoomPlacement } from "./builderStore";
import {
  COPILOT_TOOLS,
  applyToolCall,
  roomProgramForTeam,
  describeWorld,
} from "./copilotTools";

let n = 0;
const makeId = () => `test-${++n}`;

function room(id: string, label: string, x = 0, y = 0): RoomPlacement {
  return { id, preset: "workspace", position: [x, y], size: [3, 3], label };
}

function run(state: BuilderState, name: string, input: Record<string, unknown>) {
  return applyToolCall(state, { name, input }, makeId);
}

describe("COPILOT_TOOLS schemas", () => {
  it("every tool has a name, description, and object schema", () => {
    expect(COPILOT_TOOLS.length).toBeGreaterThanOrEqual(10);
    for (const t of COPILOT_TOOLS) {
      expect(t.name).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(10);
      expect((t.input_schema as { type: string }).type).toBe("object");
    }
  });
});

describe("applyToolCall — rooms", () => {
  it("add_room auto-places and uses preset defaults", () => {
    const r = run(createBuilderState(), "add_room", { preset: "meeting" });
    expect(r.error).toBeUndefined();
    expect(r.actions).toHaveLength(1);
    const action = r.actions[0] as { type: string; room: RoomPlacement };
    expect(action.type).toBe("ADD_ROOM");
    expect(action.room.size).toEqual([4, 3]);
    expect(action.room.label).toBe("Meeting Room");
  });

  it("add_room honors explicit position/size/label", () => {
    const r = run(createBuilderState(), "add_room", { preset: "lab", label: "Test Lab", x: 5, y: 2, width: 3, height: 3 });
    const action = r.actions[0] as { room: RoomPlacement };
    expect(action.room.position).toEqual([5, 2]);
    expect(action.room.size).toEqual([3, 3]);
    expect(action.room.label).toBe("Test Lab");
  });

  it("add_room rejects unknown presets", () => {
    expect(run(createBuilderState(), "add_room", { preset: "spaceship" }).error).toMatch(/Unknown preset/);
  });

  it("remove/move/resize/rename resolve rooms fuzzily by label", () => {
    const state = createBuilderState([room("a", "Test Lab")]);
    expect(run(state, "remove_room", { room: "test-lab" }).actions[0]).toMatchObject({ type: "REMOVE_ROOM", roomId: "a" });
    expect(run(state, "move_room", { room: "lab", x: 4, y: 4 }).actions[0]).toMatchObject({ type: "MOVE_ROOM", position: [4, 4] });
    expect(run(state, "resize_room", { room: "Test Lab", width: 5, height: 4 }).actions[0]).toMatchObject({ type: "RESIZE_ROOM", size: [5, 4] });
    expect(run(state, "rename_room", { room: "lab", new_label: "QA Bay" }).actions[0]).toMatchObject({ type: "UPDATE_ROOM", updates: { label: "QA Bay" } });
  });

  it("unknown room label errors", () => {
    const state = createBuilderState([room("a", "Workspace")]);
    expect(run(state, "remove_room", { room: "dungeon" }).error).toMatch(/No room matching/);
  });

  it("set_room_colors merges with existing colors", () => {
    const state = createBuilderState([{ ...room("a", "Lab"), colors: { floor: "#111111" } }]);
    const r = run(state, "set_room_colors", { room: "Lab", wall: "#222222" });
    expect(r.actions[0]).toMatchObject({ colors: { floor: "#111111", wall: "#222222" } });
  });
});

describe("applyToolCall — furniture, theme, agents", () => {
  it("add_furniture converts catalog items", () => {
    const state = createBuilderState([room("a", "Lab")]);
    const r = run(state, "add_furniture", { room: "Lab", item: "desk", x: 1, z: -1 });
    expect(r.error).toBeUndefined();
    const action = r.actions[0] as { type: string; item: { position: [number, number, number] } };
    expect(action.type).toBe("ADD_FURNITURE");
    expect(action.item.position[0]).toBe(1);
    expect(action.item.position[2]).toBe(-1);
  });

  it("add_furniture rejects unknown items", () => {
    const state = createBuilderState([room("a", "Lab")]);
    expect(run(state, "add_furniture", { room: "Lab", item: "jacuzzi" }).error).toMatch(/Unknown catalog item/);
  });

  it("set_theme returns an effect, no actions", () => {
    const r = run(createBuilderState(), "set_theme", { theme: "cyberpunk" });
    expect(r.actions).toHaveLength(0);
    expect(r.effects).toEqual([{ kind: "set_theme", theme: "cyberpunk" }]);
  });

  it("assign_agent resolves the room and returns an effect", () => {
    const state = createBuilderState([room("a", "Test Lab")]);
    const r = run(state, "assign_agent", { agent: "sentinel", room: "lab" });
    expect(r.effects).toEqual([{ kind: "assign_agent", agent: "sentinel", room: "Test Lab" }]);
  });
});

describe("generate_layout", () => {
  it("maps roles to presets with capacity splitting", () => {
    const specs = roomProgramForTeam([
      { role: "engineer", count: 5 },
      { role: "qa", count: 2 },
      { role: "manager", count: 1 },
    ]);
    // 5 engineers / cap 3 = 2 workspaces; 2 qa = 1 lab; 1 manager = 1 private
    expect(specs.filter((s) => s.preset === "workspace")).toHaveLength(2);
    expect(specs.filter((s) => s.preset === "lab")).toHaveLength(1);
    expect(specs.filter((s) => s.preset === "private")).toHaveLength(1);
    // 8 people ≥3 → meeting, ≥5 → social
    expect(specs.some((s) => s.preset === "meeting")).toBe(true);
    expect(specs.some((s) => s.preset === "social")).toBe(true);
  });

  it("small teams skip shared spaces", () => {
    const specs = roomProgramForTeam([{ role: "engineer", count: 1 }]);
    expect(specs.some((s) => s.preset === "meeting")).toBe(false);
    expect(specs.some((s) => s.preset === "social")).toBe(false);
  });

  it("produces non-overlapping ADD_ROOM actions applyable as a BATCH", () => {
    const state = createBuilderState([room("existing", "HQ", 0, 0)]);
    const r = run(state, "generate_layout", { team: [{ role: "engineer", count: 4 }, { role: "qa", count: 2 }] });
    expect(r.error).toBeUndefined();
    expect(r.actions.length).toBeGreaterThanOrEqual(3);
    const after = builderReducer(state, { type: "BATCH", actions: r.actions });
    // all rooms placed (none rejected as overlapping)
    expect(after.rooms.length).toBe(1 + r.actions.length);
    // one undo step restores the original single room
    const undone = builderReducer(after, { type: "UNDO" });
    expect(undone.rooms).toHaveLength(1);
  });
});

describe("BATCH", () => {
  it("applies several actions as one undo step", () => {
    let state = createBuilderState();
    const a = run(state, "add_room", { preset: "meeting" });
    const b = run(state, "add_room", { preset: "lab", x: 10, y: 10 });
    state = builderReducer(state, { type: "BATCH", actions: [...a.actions, ...b.actions] });
    expect(state.rooms).toHaveLength(2);
    expect(state.history.past).toHaveLength(1);
    state = builderReducer(state, { type: "UNDO" });
    expect(state.rooms).toHaveLength(0);
  });

  it("no-op batch leaves history untouched", () => {
    const state = createBuilderState([room("a", "Lab")]);
    const after = builderReducer(state, { type: "BATCH", actions: [{ type: "SELECT_ROOM", roomId: "a" }] });
    expect(after.history.past).toHaveLength(0);
    expect(after.selectedRoomId).toBe("a");
  });
});

describe("describeWorld", () => {
  it("summarizes rooms, theme, agents", () => {
    const state = createBuilderState([room("a", "Test Lab", 2, 3)]);
    const text = describeWorld(state, "cyberpunk", ["sentinel", "herald"]);
    expect(text).toContain("cyberpunk");
    expect(text).toContain("Test Lab");
    expect(text).toContain("sentinel, herald");
  });
});
