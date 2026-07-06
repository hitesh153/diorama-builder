import type { RoomConfig } from "./config";

/**
 * Fuzzy room-name matching. Event sources rarely emit labels that match the
 * user's rooms exactly ("test-lab" vs "Test Lab" vs "Lab"), so matching is:
 *   1. exact normalized match
 *   2. one name contains the other (normalized)
 *   3. no match → -1 (callers must NOT fall back to a random room)
 */

/** Normalize a label for comparison: lowercase, non-alphanumerics collapsed to "-". */
export function normalizeRoomName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Index of the room best matching `name`, or -1 when nothing matches. */
export function matchRoomIndex(
  rooms: Array<Pick<RoomConfig, "label">>,
  name: string,
): number {
  const target = normalizeRoomName(name);
  if (!target) return -1;

  // Pass 1: exact
  for (let i = 0; i < rooms.length; i++) {
    if (normalizeRoomName(rooms[i].label) === target) return i;
  }

  // Pass 2: containment either way — prefer the longest room label so
  // "lab" matches "Test Lab" over "Lab Annex" only via best overlap.
  let best = -1;
  let bestLen = 0;
  for (let i = 0; i < rooms.length; i++) {
    const roomName = normalizeRoomName(rooms[i].label);
    if (!roomName) continue;
    if (roomName.includes(target) || target.includes(roomName)) {
      if (roomName.length > bestLen) {
        best = i;
        bestLen = roomName.length;
      }
    }
  }
  return best;
}
