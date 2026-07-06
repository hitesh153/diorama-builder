"use client";

import { useState, useCallback, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { RoomPlacement, BuilderAction } from "@diorama/ui/src/builderStore";
import { detectAlignments, type AlignmentGuide } from "./useAlignmentDetection";

/** GRID_UNIT(200) * SCALE(0.018) — one grid cell in world units */
const GRID_WORLD = 3.6;
/** Minimum world-unit movement before a pointer-down becomes a drag */
const DRAG_THRESHOLD = 0.5;

interface DragInfo {
  roomId: string;
  startWorldX: number;
  startWorldZ: number;
  startGridX: number;
  startGridY: number;
  roomSize: [number, number];
  hasMoved: boolean;
  /** Shift held at pointer-down → click toggles multi-select */
  shiftKey: boolean;
}

export interface GhostData {
  position: [number, number];
  size: [number, number];
  isValid: boolean;
  roomId: string;
}

/**
 * Drag-to-move hook for rooms in the 3D viewport.
 *
 * Returns stable handlers (ref-based, no stale closures) that can be
 * passed directly to R3F mesh event props.
 *
 * Flow:
 *   pointerDown on Room  →  track start position
 *   pointerMove on ground / rooms  →  update ghost (snap to grid)
 *   pointerUp anywhere  →  commit MOVE_ROOM or SELECT_ROOM
 */
export function useDragRoom(
  rooms: RoomPlacement[],
  dispatch: React.Dispatch<BuilderAction>,
) {
  // ---- visual state (triggers re-renders for the ghost overlay) ----
  const [ghost, setGhost] = useState<GhostData | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  // ---- refs for the hot path (no re-render cost) ----
  const dragInfoRef = useRef<DragInfo | null>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const ghostDataRef = useRef<{ position: [number, number]; isValid: boolean } | null>(null);

  // ---- helpers ----
  const checkOverlap = (
    pos: [number, number],
    size: [number, number],
    excludeId: string,
  ): boolean =>
    roomsRef.current.some((r) => {
      if (r.id === excludeId) return false;
      return (
        pos[0] < r.position[0] + r.size[0] &&
        pos[0] + size[0] > r.position[0] &&
        pos[1] < r.position[1] + r.size[1] &&
        pos[1] + size[1] > r.position[1]
      );
    });

  // ---- handlers (stable — deps are []) ----

  /** Called from Room3D onPointerDown */
  const handleRoomPointerDown = useCallback(
    (roomId: string, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const room = roomsRef.current.find((r) => r.id === roomId);
      if (!room) return;

      dragInfoRef.current = {
        roomId,
        startWorldX: e.point.x,
        startWorldZ: e.point.z,
        startGridX: room.position[0],
        startGridY: room.position[1],
        roomSize: [...room.size],
        hasMoved: false,
        shiftKey: e.shiftKey ?? e.nativeEvent?.shiftKey ?? false,
      };
    },
    [],
  );

  /** Called from DragGroundPlane AND every Room3D onPointerMove */
  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const info = dragInfoRef.current;
      if (!info) return;

      const dx = e.point.x - info.startWorldX;
      const dz = e.point.z - info.startWorldZ;

      // Not yet dragging — check threshold
      if (!info.hasMoved) {
        if (Math.sqrt(dx * dx + dz * dz) < DRAG_THRESHOLD) return;
        info.hasMoved = true;
      }

      // Snap delta to grid
      const gridDx = Math.round(dx / GRID_WORLD);
      const gridDz = Math.round(dz / GRID_WORLD);
      const newPos: [number, number] = [
        info.startGridX + gridDx,
        info.startGridY + gridDz,
      ];

      // Snap to aligned edges/centers of other rooms
      const { snappedPos, guides } = detectAlignments(newPos, info.roomSize, roomsRef.current, info.roomId);
      const overlaps = checkOverlap(snappedPos, info.roomSize, info.roomId);

      setAlignmentGuides(guides);
      ghostDataRef.current = { position: snappedPos, isValid: !overlaps };
      setGhost({
        position: snappedPos,
        size: info.roomSize,
        isValid: !overlaps,
        roomId: info.roomId,
      });
    },
    [],
  );

  /** Called from DragGroundPlane AND every Room3D onPointerUp */
  const handlePointerUp = useCallback(() => {
    const info = dragInfoRef.current;
    if (!info) return;

    if (info.hasMoved && ghostDataRef.current) {
      if (ghostDataRef.current.isValid) {
        dispatchRef.current({
          type: "MOVE_ROOM",
          roomId: info.roomId,
          position: ghostDataRef.current.position,
        });
      }
      // invalid drop → room stays at original position (no dispatch)
    } else if (!info.hasMoved) {
      // No movement → treat as click → select (shift-click toggles multi-select)
      if (info.shiftKey) {
        dispatchRef.current({ type: "TOGGLE_SELECT_ROOM", roomId: info.roomId });
      } else {
        dispatchRef.current({ type: "SELECT_ROOM", roomId: info.roomId });
      }
    }

    // Clean up
    dragInfoRef.current = null;
    ghostDataRef.current = null;
    setGhost(null);
    setAlignmentGuides([]);
  }, []);

  return {
    isDragging: ghost !== null,
    ghost,
    alignmentGuides,
    handleRoomPointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
