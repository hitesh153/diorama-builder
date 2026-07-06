"use client";

import { useState, useCallback, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { RoomPlacement, BuilderAction } from "@diorama/ui/src/builderStore";

/** GRID_UNIT(200) * SCALE(0.018) — one grid cell in world units */
const GRID_WORLD = 3.6;
/** Minimum world-unit movement before a pointer-down becomes a drag */
const DRAG_THRESHOLD = 0.15;
/** Keep-out margin from the room walls (world units) */
const ROOM_MARGIN = 0.3;

interface FurnitureDragInfo {
  roomId: string;
  index: number;
  startWorldX: number;
  startWorldZ: number;
  startLocalX: number;
  startLocalZ: number;
  itemY: number;
  halfW: number;
  halfH: number;
  hasMoved: boolean;
}

export interface FurniturePreview {
  roomId: string;
  index: number;
  /** Room-center-relative position (same space as FurnitureItem.position) */
  position: [number, number, number];
}

/**
 * Click-to-select + drag-to-move for furniture items inside a room.
 *
 * Same ref-based pattern as useDragRoom (stable handlers, no stale closures):
 *   pointerDown on furniture mesh  →  track start position (room-local)
 *   pointerMove on ground / rooms  →  update local preview (no reducer spam)
 *   pointerUp anywhere             →  commit UPDATE_FURNITURE or SELECT_FURNITURE
 *
 * Furniture positions are relative to the room center in world units
 * (see RoomFurniture3D), so drag deltas in world space translate 1:1.
 */
export function useFurnitureDrag(
  rooms: RoomPlacement[],
  dispatch: React.Dispatch<BuilderAction>,
) {
  // ---- visual state (re-renders the live preview) ----
  const [preview, setPreview] = useState<FurniturePreview | null>(null);

  // ---- refs for the hot path ----
  const infoRef = useRef<FurnitureDragInfo | null>(null);
  const previewRef = useRef<FurniturePreview | null>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  /** Called from a furniture mesh onPointerDown (selected room only) */
  const handleFurniturePointerDown = useCallback(
    (roomId: string, index: number, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const room = roomsRef.current.find((r) => r.id === roomId);
      const item = room?.furniture?.[index];
      if (!room || !item) return;

      infoRef.current = {
        roomId,
        index,
        startWorldX: e.point.x,
        startWorldZ: e.point.z,
        startLocalX: item.position[0],
        startLocalZ: item.position[2],
        itemY: item.position[1],
        halfW: Math.max((room.size[0] * GRID_WORLD) / 2 - ROOM_MARGIN, 0),
        halfH: Math.max((room.size[1] * GRID_WORLD) / 2 - ROOM_MARGIN, 0),
        hasMoved: false,
      };
    },
    [],
  );

  /** Called from DragGroundPlane AND every Room3D onPointerMove */
  const handleFurniturePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const info = infoRef.current;
    if (!info) return;

    const dx = e.point.x - info.startWorldX;
    const dz = e.point.z - info.startWorldZ;

    if (!info.hasMoved) {
      if (Math.hypot(dx, dz) < DRAG_THRESHOLD) return;
      info.hasMoved = true;
    }

    // Clamp within room bounds (half-size minus wall margin)
    const x = Math.min(Math.max(info.startLocalX + dx, -info.halfW), info.halfW);
    const z = Math.min(Math.max(info.startLocalZ + dz, -info.halfH), info.halfH);

    const next: FurniturePreview = {
      roomId: info.roomId,
      index: info.index,
      position: [x, info.itemY, z],
    };
    previewRef.current = next;
    setPreview(next);
  }, []);

  /** Called from DragGroundPlane AND every Room3D onPointerUp */
  const handleFurniturePointerUp = useCallback(() => {
    const info = infoRef.current;
    if (!info) return;

    // Click (no movement) selects; drag commits the final position.
    dispatchRef.current({
      type: "SELECT_FURNITURE",
      ref: { roomId: info.roomId, index: info.index },
    });
    if (info.hasMoved && previewRef.current) {
      dispatchRef.current({
        type: "UPDATE_FURNITURE",
        roomId: info.roomId,
        furnitureIndex: info.index,
        updates: { position: previewRef.current.position },
      });
    }

    infoRef.current = null;
    previewRef.current = null;
    setPreview(null);
  }, []);

  return {
    isDraggingFurniture: preview !== null,
    furniturePreview: preview,
    handleFurniturePointerDown,
    handleFurniturePointerMove,
    handleFurniturePointerUp,
  };
}
