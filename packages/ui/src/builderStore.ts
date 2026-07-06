export interface RoomPlacement {
  id: string;
  preset: string;
  position: [number, number];
  size: [number, number];
  label: string;
  colors?: { accent?: string; floor?: string; wall?: string };
  floorStyle?: "solid" | "grid-tiles" | "wood-planks" | "hex-tiles" | "carpet";
  furniture?: Array<{
    geometry: "box" | "cylinder" | "sphere" | "plane";
    size: [number, number, number];
    position: [number, number, number];
    rotation?: [number, number, number];
    label?: string;
    material: { color: string; emissive?: string; wireframe?: boolean; opacity?: number };
  }>;
}

interface HistoryEntry {
  rooms: RoomPlacement[];
}

export interface FurnitureRef {
  roomId: string;
  index: number;
}

export interface BuilderState {
  rooms: RoomPlacement[];
  /** Primary selection (last clicked). Kept for single-select consumers. */
  selectedRoomId: string | null;
  /** Full multi-selection set; always contains selectedRoomId when non-null. */
  selectedRoomIds: string[];
  /** Selected furniture item, if any (mutually exclusive with room selection). */
  selectedFurniture: FurnitureRef | null;
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };
}

export type BuilderAction =
  | { type: "ADD_ROOM"; room: RoomPlacement }
  | { type: "REMOVE_ROOM"; roomId: string }
  | { type: "MOVE_ROOM"; roomId: string; position: [number, number] }
  | { type: "RESIZE_ROOM"; roomId: string; size: [number, number] }
  | { type: "UPDATE_ROOM"; roomId: string; updates: Partial<Pick<RoomPlacement, "label">> }
  | { type: "SELECT_ROOM"; roomId: string | null }
  | { type: "TOGGLE_SELECT_ROOM"; roomId: string }
  | { type: "SELECT_ROOMS"; roomIds: string[] }
  | { type: "NUDGE_ROOMS"; roomIds: string[]; delta: [number, number] }
  | { type: "DUPLICATE_ROOM"; roomId: string; newId: string }
  | { type: "SET_ROOM_COLORS"; roomId: string; colors: RoomPlacement["colors"] }
  | { type: "SET_FLOOR_STYLE"; roomId: string; floorStyle: RoomPlacement["floorStyle"] }
  | { type: "ADD_FURNITURE"; roomId: string; item: NonNullable<RoomPlacement["furniture"]>[0] }
  | { type: "REMOVE_FURNITURE"; roomId: string; furnitureIndex: number }
  | { type: "UPDATE_FURNITURE"; roomId: string; furnitureIndex: number; updates: Partial<NonNullable<RoomPlacement["furniture"]>[0]> }
  | { type: "SELECT_FURNITURE"; ref: FurnitureRef | null }
  | { type: "UNDO" }
  | { type: "REDO" };

export function createBuilderState(initialRooms: RoomPlacement[] = []): BuilderState {
  return {
    rooms: initialRooms,
    selectedRoomId: null,
    selectedRoomIds: [],
    selectedFurniture: null,
    history: { past: [], future: [] },
  };
}

function overlaps(a: RoomPlacement, b: RoomPlacement): boolean {
  const [ax, ay] = a.position;
  const [aw, ah] = a.size;
  const [bx, by] = b.position;
  const [bw, bh] = b.size;
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function hasOverlap(room: RoomPlacement, others: RoomPlacement[]): boolean {
  return others.some((o) => o.id !== room.id && overlaps(room, o));
}

/** First non-overlapping grid position, scanning row-major from origin. */
function findFreePosition(size: [number, number], rooms: RoomPlacement[]): [number, number] {
  const probe: RoomPlacement = { id: "__probe__", preset: "", position: [0, 0], size, label: "" };
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      probe.position = [x, y];
      if (!hasOverlap(probe, rooms)) return [x, y];
    }
  }
  return [0, 0];
}

function pushHistory(state: BuilderState): BuilderState {
  return {
    ...state,
    history: {
      past: [...state.history.past, { rooms: structuredClone(state.rooms) }],
      future: [],
    },
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "ADD_ROOM": {
      if (hasOverlap(action.room, state.rooms)) return state;
      const withHistory = pushHistory(state);
      return { ...withHistory, rooms: [...state.rooms, action.room] };
    }

    case "REMOVE_ROOM": {
      const withHistory = pushHistory(state);
      const ids = state.selectedRoomIds.filter((id) => id !== action.roomId);
      return {
        ...withHistory,
        rooms: state.rooms.filter((r) => r.id !== action.roomId),
        selectedRoomId: state.selectedRoomId === action.roomId ? (ids[ids.length - 1] ?? null) : state.selectedRoomId,
        selectedRoomIds: ids,
        selectedFurniture:
          state.selectedFurniture?.roomId === action.roomId ? null : state.selectedFurniture,
      };
    }

    case "MOVE_ROOM": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const moved = { ...room, position: action.position };
      if (hasOverlap(moved, state.rooms)) return state;
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) => (r.id === action.roomId ? moved : r)),
      };
    }

    case "RESIZE_ROOM": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const resized = { ...room, size: action.size };
      if (hasOverlap(resized, state.rooms)) return state;
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) => (r.id === action.roomId ? resized : r)),
      };
    }

    case "UPDATE_ROOM": {
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId ? { ...r, ...action.updates } : r
        ),
      };
    }

    case "SELECT_ROOM": {
      const ids = action.roomId ? [action.roomId] : [];
      if (
        state.selectedRoomId === action.roomId &&
        state.selectedRoomIds.length === ids.length &&
        state.selectedFurniture === null
      ) {
        return state;
      }
      return {
        ...state,
        selectedRoomId: action.roomId,
        selectedRoomIds: ids,
        selectedFurniture: null,
      };
    }

    case "TOGGLE_SELECT_ROOM": {
      const has = state.selectedRoomIds.includes(action.roomId);
      const ids = has
        ? state.selectedRoomIds.filter((id) => id !== action.roomId)
        : [...state.selectedRoomIds, action.roomId];
      return {
        ...state,
        selectedRoomIds: ids,
        selectedRoomId: has ? (ids[ids.length - 1] ?? null) : action.roomId,
        selectedFurniture: null,
      };
    }

    case "SELECT_ROOMS": {
      const ids = action.roomIds.filter((id) => state.rooms.some((r) => r.id === id));
      return {
        ...state,
        selectedRoomIds: ids,
        selectedRoomId: ids[ids.length - 1] ?? null,
        selectedFurniture: null,
      };
    }

    case "NUDGE_ROOMS": {
      const [dx, dy] = action.delta;
      if (dx === 0 && dy === 0) return state;
      const group = new Set(action.roomIds);
      const moving = state.rooms.filter((r) => group.has(r.id));
      if (moving.length === 0) return state;

      const movedRooms = state.rooms.map((r) =>
        group.has(r.id)
          ? { ...r, position: [r.position[0] + dx, r.position[1] + dy] as [number, number] }
          : r,
      );
      // Reject when any moved room goes negative or collides with a
      // non-group room (group members may not collide with each other
      // either — they move rigidly, so relative overlap is unchanged).
      for (const r of movedRooms) {
        if (!group.has(r.id)) continue;
        if (r.position[0] < 0 || r.position[1] < 0) return state;
        if (movedRooms.some((o) => o.id !== r.id && !group.has(o.id) && overlaps(r, o))) {
          return state;
        }
      }
      const withHistory = pushHistory(state);
      return { ...withHistory, rooms: movedRooms };
    }

    case "DUPLICATE_ROOM": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const copy: RoomPlacement = {
        ...structuredClone(room),
        id: action.newId,
        label: `${room.label} Copy`,
        position: findFreePosition(room.size, state.rooms),
      };
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: [...state.rooms, copy],
        selectedRoomId: copy.id,
        selectedRoomIds: [copy.id],
        selectedFurniture: null,
      };
    }

    case "UPDATE_FURNITURE": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room?.furniture?.[action.furnitureIndex]) return state;
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId
            ? {
                ...r,
                furniture: r.furniture!.map((f, i) =>
                  i === action.furnitureIndex ? { ...f, ...action.updates } : f,
                ),
              }
            : r,
        ),
      };
    }

    case "SELECT_FURNITURE": {
      if (
        state.selectedFurniture?.roomId === action.ref?.roomId &&
        state.selectedFurniture?.index === action.ref?.index
      ) {
        return state;
      }
      return {
        ...state,
        selectedFurniture: action.ref,
        ...(action.ref ? { selectedRoomId: action.ref.roomId, selectedRoomIds: [action.ref.roomId] } : {}),
      };
    }

    case "UNDO": {
      if (state.history.past.length === 0) return state;
      const prev = state.history.past[state.history.past.length - 1];
      return {
        ...state,
        rooms: prev.rooms,
        history: {
          past: state.history.past.slice(0, -1),
          future: [{ rooms: state.rooms }, ...state.history.future],
        },
      };
    }

    case "REDO": {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      return {
        ...state,
        rooms: next.rooms,
        history: {
          past: [...state.history.past, { rooms: state.rooms }],
          future: state.history.future.slice(1),
        },
      };
    }

    case "SET_ROOM_COLORS": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId ? { ...r, colors: action.colors } : r
        ),
      };
    }

    case "SET_FLOOR_STYLE": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId ? { ...r, floorStyle: action.floorStyle } : r
        ),
      };
    }

    case "ADD_FURNITURE": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const withHistory = pushHistory(state);
      return {
        ...withHistory,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId
            ? { ...r, furniture: [...(r.furniture ?? []), action.item] }
            : r
        ),
      };
    }

    case "REMOVE_FURNITURE": {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room || !room.furniture) return state;
      const withHistory = pushHistory(state);
      const sel = state.selectedFurniture;
      let selectedFurniture = sel;
      if (sel?.roomId === action.roomId) {
        if (sel.index === action.furnitureIndex) selectedFurniture = null;
        else if (sel.index > action.furnitureIndex) selectedFurniture = { ...sel, index: sel.index - 1 };
      }
      return {
        ...withHistory,
        rooms: state.rooms.map((r) =>
          r.id === action.roomId
            ? { ...r, furniture: r.furniture!.filter((_, i) => i !== action.furnitureIndex) }
            : r
        ),
        selectedFurniture,
      };
    }

    default:
      return state;
  }
}
