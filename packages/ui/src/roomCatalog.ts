import { ROOM_PRESETS } from "@diorama/engine";

export interface RoomCatalogEntry {
  preset: string;
  label: string;
  defaultSize: [number, number];
}

export function createRoomCatalog(): RoomCatalogEntry[] {
  return ROOM_PRESETS.map((p) => ({
    preset: p.id,
    label: p.label,
    defaultSize: p.defaultSize,
  }));
}
