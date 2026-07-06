import {
  ROOM_PRESETS,
  FURNITURE_CATALOG,
  getCatalogItem,
  catalogItemToFurniture,
  findNextPosition,
  matchRoomIndex,
} from "@diorama/engine";
import type { BuilderState, BuilderAction, RoomPlacement } from "./builderStore";

/**
 * The AI copilot's tool surface. Every tool maps to builder-store actions
 * (dispatched as ONE undoable BATCH) or to a side effect the host applies
 * (theme change, agent assignment). Pure module: no LLM, no React — the
 * copilot chat calls an LLM with COPILOT_TOOLS, then feeds the returned
 * tool calls through applyToolCall.
 */

export interface CopilotToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CopilotToolCall {
  name: string;
  input: Record<string, unknown>;
}

export type CopilotEffect =
  | { kind: "set_theme"; theme: string }
  | { kind: "assign_agent"; agent: string; room: string };

export interface ApplyResult {
  actions: BuilderAction[];
  effects: CopilotEffect[];
  /** Human-readable summary of what was done (for the chat transcript). */
  summary: string;
  error?: string;
}

const PRESET_IDS = ROOM_PRESETS.map((p) => p.id);
const FLOOR_STYLES = ["solid", "grid-tiles", "wood-planks", "hex-tiles", "carpet"];
const THEMES = ["neon-dark", "warm-office", "cyberpunk", "minimal"];
const CATALOG_IDS = FURNITURE_CATALOG.map((c) => c.id);

export const COPILOT_TOOLS: CopilotToolDef[] = [
  {
    name: "add_room",
    description:
      "Add a room to the office. Position is optional — omit it to auto-place at the next free spot. Sizes are in grid cells (1 cell = 1 m²).",
    input_schema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: PRESET_IDS, description: "Room type" },
        label: { type: "string", description: "Display name (defaults to the preset name)" },
        x: { type: "integer", minimum: 0 },
        y: { type: "integer", minimum: 0 },
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
      },
      required: ["preset"],
    },
  },
  {
    name: "remove_room",
    description: "Remove a room by its label.",
    input_schema: {
      type: "object",
      properties: { room: { type: "string", description: "Room label" } },
      required: ["room"],
    },
  },
  {
    name: "move_room",
    description: "Move a room to a new grid position. Fails silently if the target overlaps another room.",
    input_schema: {
      type: "object",
      properties: {
        room: { type: "string" },
        x: { type: "integer", minimum: 0 },
        y: { type: "integer", minimum: 0 },
      },
      required: ["room", "x", "y"],
    },
  },
  {
    name: "resize_room",
    description: "Resize a room (grid cells).",
    input_schema: {
      type: "object",
      properties: {
        room: { type: "string" },
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
      },
      required: ["room", "width", "height"],
    },
  },
  {
    name: "rename_room",
    description: "Rename a room.",
    input_schema: {
      type: "object",
      properties: { room: { type: "string" }, new_label: { type: "string" } },
      required: ["room", "new_label"],
    },
  },
  {
    name: "set_room_colors",
    description: "Set custom colors (hex) for a room's floor, walls, or accent.",
    input_schema: {
      type: "object",
      properties: {
        room: { type: "string" },
        floor: { type: "string" },
        wall: { type: "string" },
        accent: { type: "string" },
      },
      required: ["room"],
    },
  },
  {
    name: "set_floor_style",
    description: "Set a room's floor texture style.",
    input_schema: {
      type: "object",
      properties: {
        room: { type: "string" },
        style: { type: "string", enum: FLOOR_STYLES },
      },
      required: ["room", "style"],
    },
  },
  {
    name: "add_furniture",
    description:
      "Add a furniture item from the catalog to a room. x/z are offsets in meters from the room center (optional, default center).",
    input_schema: {
      type: "object",
      properties: {
        room: { type: "string" },
        item: { type: "string", enum: CATALOG_IDS },
        x: { type: "number" },
        z: { type: "number" },
      },
      required: ["room", "item"],
    },
  },
  {
    name: "set_theme",
    description: "Switch the whole office theme.",
    input_schema: {
      type: "object",
      properties: { theme: { type: "string", enum: THEMES } },
      required: ["theme"],
    },
  },
  {
    name: "assign_agent",
    description: "Assign an agent to a room.",
    input_schema: {
      type: "object",
      properties: { agent: { type: "string" }, room: { type: "string" } },
      required: ["agent", "room"],
    },
  },
  {
    name: "generate_layout",
    description:
      "Generate a complete office layout for a team. Describes the team as roles with counts; rooms are chosen per role (engineers→workspaces, testers→labs, etc.), plus a meeting room and lounge for bigger teams. Adds to the existing layout.",
    input_schema: {
      type: "object",
      properties: {
        team: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", description: "e.g. engineer, qa, research, comms, manager" },
              count: { type: "integer", minimum: 1 },
            },
            required: ["role", "count"],
          },
        },
      },
      required: ["team"],
    },
  },
];

// ---- Role → room mapping for generate_layout ----

const ROLE_PRESET_RULES: Array<{ keywords: string[]; preset: string; capacity: number }> = [
  { keywords: ["qa", "test", "sentinel", "quality"], preset: "lab", capacity: 4 },
  { keywords: ["research", "scientist", "lab", "experiment"], preset: "lab", capacity: 4 },
  { keywords: ["manager", "lead", "exec", "director"], preset: "private", capacity: 1 },
  { keywords: ["comms", "support", "herald", "social", "community"], preset: "social", capacity: 4 },
  // default: engineers/coders/everyone else
  { keywords: [], preset: "workspace", capacity: 3 },
];

function presetForRole(role: string): { preset: string; capacity: number } {
  const r = role.toLowerCase();
  for (const rule of ROLE_PRESET_RULES) {
    if (rule.keywords.some((k) => r.includes(k))) return rule;
  }
  return ROLE_PRESET_RULES[ROLE_PRESET_RULES.length - 1];
}

export interface LayoutRoomSpec {
  preset: string;
  label: string;
  size: [number, number];
}

/** Deterministic role-based room program for a team brief. */
export function roomProgramForTeam(team: Array<{ role: string; count: number }>): LayoutRoomSpec[] {
  const specs: LayoutRoomSpec[] = [];
  let total = 0;

  for (const { role, count } of team) {
    total += count;
    const { preset, capacity } = presetForRole(role);
    const roomsNeeded = Math.max(1, Math.ceil(count / capacity));
    const presetDef = ROOM_PRESETS.find((p) => p.id === preset)!;
    for (let i = 0; i < roomsNeeded; i++) {
      const base = role.charAt(0).toUpperCase() + role.slice(1);
      specs.push({
        preset,
        label: roomsNeeded > 1 ? `${base} ${i + 1}` : base,
        size: [...presetDef.defaultSize] as [number, number],
      });
    }
  }

  // Shared spaces for bigger teams
  if (total >= 3 && !specs.some((s) => s.preset === "meeting")) {
    specs.push({ preset: "meeting", label: "Meeting Room", size: [4, 3] });
  }
  if (total >= 5 && !specs.some((s) => s.preset === "social")) {
    specs.push({ preset: "social", label: "Lounge", size: [3, 3] });
  }
  return specs;
}

// ---- Tool application ----

function findRoom(state: BuilderState, name: string): RoomPlacement | null {
  const idx = matchRoomIndex(state.rooms, name);
  return idx >= 0 ? state.rooms[idx] : null;
}

/**
 * Convert one LLM tool call into builder actions + effects. Pure — the
 * caller dispatches `{type:"BATCH", actions}` and applies effects itself.
 */
export function applyToolCall(
  state: BuilderState,
  call: CopilotToolCall,
  makeId: () => string,
): ApplyResult {
  const input = call.input ?? {};
  const fail = (error: string): ApplyResult => ({ actions: [], effects: [], summary: "", error });

  switch (call.name) {
    case "add_room": {
      const presetId = String(input.preset ?? "");
      const preset = ROOM_PRESETS.find((p) => p.id === presetId);
      if (!preset && presetId !== "custom") return fail(`Unknown preset "${presetId}"`);
      const size: [number, number] = [
        Number(input.width) >= 1 ? Number(input.width) : (preset?.defaultSize[0] ?? 3),
        Number(input.height) >= 1 ? Number(input.height) : (preset?.defaultSize[1] ?? 3),
      ];
      const existing = state.rooms.map((r) => ({ position: r.position, size: r.size }));
      const position: [number, number] =
        Number.isInteger(input.x) && Number.isInteger(input.y)
          ? [Number(input.x), Number(input.y)]
          : findNextPosition(size, existing);
      const label = typeof input.label === "string" && input.label.trim()
        ? input.label.trim()
        : (preset?.label ?? "Room");
      return {
        actions: [{ type: "ADD_ROOM", room: { id: makeId(), preset: presetId, position, size, label } }],
        effects: [],
        summary: `Added ${label} (${size[0]}×${size[1]}) at (${position[0]}, ${position[1]})`,
      };
    }

    case "remove_room": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      return {
        actions: [{ type: "REMOVE_ROOM", roomId: room.id }],
        effects: [],
        summary: `Removed ${room.label}`,
      };
    }

    case "move_room": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      return {
        actions: [{ type: "MOVE_ROOM", roomId: room.id, position: [Number(input.x), Number(input.y)] }],
        effects: [],
        summary: `Moved ${room.label} to (${input.x}, ${input.y})`,
      };
    }

    case "resize_room": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      return {
        actions: [{ type: "RESIZE_ROOM", roomId: room.id, size: [Number(input.width), Number(input.height)] }],
        effects: [],
        summary: `Resized ${room.label} to ${input.width}×${input.height}`,
      };
    }

    case "rename_room": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      const label = String(input.new_label ?? "").trim();
      if (!label) return fail("new_label is empty");
      return {
        actions: [{ type: "UPDATE_ROOM", roomId: room.id, updates: { label } }],
        effects: [],
        summary: `Renamed ${room.label} → ${label}`,
      };
    }

    case "set_room_colors": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      const colors = {
        ...(room.colors ?? {}),
        ...(typeof input.floor === "string" ? { floor: input.floor } : {}),
        ...(typeof input.wall === "string" ? { wall: input.wall } : {}),
        ...(typeof input.accent === "string" ? { accent: input.accent } : {}),
      };
      return {
        actions: [{ type: "SET_ROOM_COLORS", roomId: room.id, colors }],
        effects: [],
        summary: `Recolored ${room.label}`,
      };
    }

    case "set_floor_style": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      const style = String(input.style ?? "");
      if (!FLOOR_STYLES.includes(style)) return fail(`Unknown floor style "${style}"`);
      return {
        actions: [
          { type: "SET_FLOOR_STYLE", roomId: room.id, floorStyle: style as RoomPlacement["floorStyle"] },
        ],
        effects: [],
        summary: `Set ${room.label} floor to ${style}`,
      };
    }

    case "add_furniture": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      const catalogItem = getCatalogItem(String(input.item ?? ""));
      if (!catalogItem) return fail(`Unknown catalog item "${input.item}"`);
      const x = Number.isFinite(Number(input.x)) ? Number(input.x) : 0;
      const z = Number.isFinite(Number(input.z)) ? Number(input.z) : 0;
      const item = catalogItemToFurniture(catalogItem, [x, 0, z]);
      return {
        actions: [{ type: "ADD_FURNITURE", roomId: room.id, item }],
        effects: [],
        summary: `Added ${catalogItem.label} to ${room.label}`,
      };
    }

    case "set_theme": {
      const theme = String(input.theme ?? "");
      if (!THEMES.includes(theme)) return fail(`Unknown theme "${theme}"`);
      return { actions: [], effects: [{ kind: "set_theme", theme }], summary: `Theme → ${theme}` };
    }

    case "assign_agent": {
      const room = findRoom(state, String(input.room ?? ""));
      if (!room) return fail(`No room matching "${input.room}"`);
      const agent = String(input.agent ?? "").trim();
      if (!agent) return fail("agent is empty");
      return {
        actions: [],
        effects: [{ kind: "assign_agent", agent, room: room.label }],
        summary: `Assigned ${agent} to ${room.label}`,
      };
    }

    case "generate_layout": {
      const team = Array.isArray(input.team) ? (input.team as Array<{ role: string; count: number }>) : [];
      if (team.length === 0) return fail("team is empty");
      const specs = roomProgramForTeam(team);
      const actions: BuilderAction[] = [];
      const placed: Array<{ position: [number, number]; size: [number, number] }> = state.rooms.map(
        (r) => ({ position: r.position, size: r.size }),
      );
      for (const spec of specs) {
        const position = findNextPosition(spec.size, placed);
        placed.push({ position, size: spec.size });
        actions.push({
          type: "ADD_ROOM",
          room: { id: makeId(), preset: spec.preset, position, size: spec.size, label: spec.label },
        });
      }
      return {
        actions,
        effects: [],
        summary: `Generated ${specs.length} rooms: ${specs.map((s) => s.label).join(", ")}`,
      };
    }

    default:
      return fail(`Unknown tool "${call.name}"`);
  }
}

/** Compact world description injected into the copilot's system prompt. */
export function describeWorld(state: BuilderState, theme: string, agents: string[]): string {
  const rooms = state.rooms.map(
    (r) =>
      `- ${r.label} (${r.preset}, ${r.size[0]}×${r.size[1]} at ${r.position[0]},${r.position[1]})` +
      (r.furniture?.length ? ` — ${r.furniture.length} custom furniture` : ""),
  );
  return [
    `Theme: ${theme}`,
    `Rooms (${state.rooms.length}):`,
    ...(rooms.length ? rooms : ["  (none yet)"]),
    `Agents: ${agents.length ? agents.join(", ") : "(none discovered)"}`,
  ].join("\n");
}
