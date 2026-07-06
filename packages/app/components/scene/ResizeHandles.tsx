"use client";

import { useMemo } from "react";
import { toWorld } from "@diorama/engine";
import type { ThreeEvent } from "@react-three/fiber";

const GRID_UNIT = 200;
const HANDLE_SIZE = 0.25;
const HANDLE_Y = 0.15;

type HandleEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeHandlesProps {
  position: [number, number]; // grid position
  size: [number, number]; // grid size
  color: string;
  onPointerDown: (edge: HandleEdge, e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: () => void;
}

interface HandleDef {
  edge: HandleEdge;
  worldPos: [number, number, number];
}

/**
 * Renders 8 small interactive boxes (4 corners + 4 edges)
 * around a selected room for resizing.
 */
export function ResizeHandles({
  position,
  size,
  color,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: ResizeHandlesProps) {
  const handles = useMemo<HandleDef[]>(() => {
    const [gx, gy] = position;
    const [gw, gh] = size;

    // Room boundaries in canvas coords
    const left = gx * GRID_UNIT;
    const right = (gx + gw) * GRID_UNIT;
    const top = gy * GRID_UNIT;
    const bottom = (gy + gh) * GRID_UNIT;
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;

    const pts: Array<{ edge: HandleEdge; cx: number; cy: number }> = [
      { edge: "nw", cx: left, cy: top },
      { edge: "n", cx: midX, cy: top },
      { edge: "ne", cx: right, cy: top },
      { edge: "w", cx: left, cy: midY },
      { edge: "e", cx: right, cy: midY },
      { edge: "sw", cx: left, cy: bottom },
      { edge: "s", cx: midX, cy: bottom },
      { edge: "se", cx: right, cy: bottom },
    ];

    return pts.map(({ edge, cx, cy }) => {
      const [wx, , wz] = toWorld(cx, cy);
      return { edge, worldPos: [wx, HANDLE_Y, wz] as [number, number, number] };
    });
  }, [position, size]);

  return (
    <group>
      {handles.map(({ edge, worldPos }) => (
        <mesh
          key={edge}
          position={worldPos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(edge, e);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => {
            e.stopPropagation();
            onPointerUp();
          }}
        >
          <boxGeometry args={[HANDLE_SIZE, HANDLE_SIZE * 0.4, HANDLE_SIZE]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}
