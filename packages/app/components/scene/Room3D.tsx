"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { generateFloor, generateWalls, getFurniture, getFloorWall, getPreset, drawFloorPattern, type RoomConfig, type FloorStyle, type DoorConfig } from "@diorama/engine";
import { RoomFurniture3D } from "./RoomFurniture3D";
import type { ThreeEvent } from "@react-three/fiber";

const GRID_UNIT = 200;
const WALL_OPACITY_GLASS = 0.15;

interface Room3DProps {
  room: RoomConfig;
  accentColor: string;
  floorColor: string;
  themeId: string;
  selected?: boolean;
  /** In the multi-selection set but not the primary selection — dimmer highlight */
  multiSelected?: boolean;
  glowIntensity?: number;
  /** Index of the selected furniture item in this room (custom furniture only) */
  selectedFurnitureIndex?: number | null;
  /** Live drag preview for one furniture item (room-center-relative position) */
  furniturePreview?: { index: number; position: [number, number, number] } | null;
  /** When set, furniture items are clickable/draggable */
  onFurniturePointerDown?: (index: number, e: ThreeEvent<PointerEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: () => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
}

export function Room3D({ room, accentColor, floorColor, themeId, selected, multiSelected, glowIntensity = 0, selectedFurnitureIndex = null, furniturePreview = null, onFurniturePointerDown, onPointerDown, onPointerUp, onPointerMove }: Room3DProps) {
  // Resolve preset floor+wall defaults; null for unknown presets (e.g. "custom") — downstream uses have fallbacks
  const presetFloorWall = useMemo(
    () => getFloorWall(room.preset, themeId),
    [room.preset, themeId],
  );

  // Three-tier color resolution: per-room override > preset theme default > global theme fallback
  const effectiveAccent = room.colors?.accent ?? accentColor;
  const effectiveFloor  = room.colors?.floor  ?? presetFloorWall?.floorColor ?? floorColor;
  const effectiveWall   = room.colors?.wall   ?? presetFloorWall?.wallColor  ?? accentColor;
  const effectiveStyle  = (room.floorStyle ?? presetFloorWall?.floorStyle ?? "solid") as FloorStyle;

  // Generate procedural floor texture with proper GPU disposal on deps change
  const [floorTexture, setFloorTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (effectiveStyle === "solid") {
      setFloorTexture(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    drawFloorPattern(ctx, effectiveStyle, effectiveFloor);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(room.size[0] * 1.5, room.size[1] * 1.5);
    setFloorTexture(tex as THREE.Texture);
    return () => { tex.dispose(); };
  }, [effectiveStyle, effectiveFloor, room.size]);

  const { floor, walls } = useMemo(() => {
    const rect = {
      x: room.position[0] * GRID_UNIT,
      y: room.position[1] * GRID_UNIT,
      w: room.size[0] * GRID_UNIT,
      h: room.size[1] * GRID_UNIT,
      color: effectiveFloor,
      glassWalls: true,
    };

    // Resolve door configs from preset relative positions to absolute canvas coords
    const preset = getPreset(room.preset);
    const doors: DoorConfig[] = (preset?.doors ?? []).map((rd) => ({
      x: rect.x + rd.rx * rect.w,
      y: rect.y + rd.ry * rect.h,
      facing: rd.facing,
    }));

    return {
      floor: generateFloor(rect),
      walls: generateWalls(rect, doors),
    };
  }, [room.position, room.size, room.preset, effectiveFloor]);

  // If room has custom furniture, use it; otherwise fall back to preset defaults
  const furniture = useMemo(
    () => (room.furniture && room.furniture.length > 0) ? room.furniture : getFurniture(room.preset, themeId),
    [room.furniture, room.preset, themeId],
  );

  const roomCenter: [number, number, number] = [floor.position[0], 0, floor.position[2]];

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPointerDown?.(e);
  }, [onPointerDown]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPointerUp?.();
  }, [onPointerUp]);

  return (
    <group
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={onPointerMove}
    >
      {/* Floor */}
      <mesh position={floor.position} receiveShadow>
        <boxGeometry args={[floor.width, 0.05, floor.depth]} />
        {floorTexture ? (
          <meshStandardMaterial
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map={floorTexture as any}
            emissive="#ffffff"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            emissiveMap={floorTexture as any}
            emissiveIntensity={0.3}
            roughness={0.7}
          />
        ) : (
          <meshStandardMaterial color={floor.color} roughness={0.8} />
        )}
      </mesh>

      {/* Selection highlight */}
      {selected && (
        <mesh position={[floor.position[0], 0.06, floor.position[2]]}>
          <boxGeometry args={[floor.width + 0.02, 0.01, floor.depth + 0.02]} />
          <meshStandardMaterial color={effectiveAccent} emissive={effectiveAccent} emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Multi-selection highlight — dimmer variant of the selection visual */}
      {!selected && multiSelected && (
        <mesh position={[floor.position[0], 0.06, floor.position[2]]}>
          <boxGeometry args={[floor.width + 0.02, 0.01, floor.depth + 0.02]} />
          <meshStandardMaterial
            color={effectiveAccent}
            emissive={effectiveAccent}
            emissiveIntensity={0.25}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}

      {/* Activity glow */}
      {glowIntensity > 0 && (
        <mesh position={[floor.position[0], 0.08, floor.position[2]]}>
          <boxGeometry args={[floor.width, 0.01, floor.depth]} />
          <meshStandardMaterial
            color={effectiveAccent}
            emissive={effectiveAccent}
            emissiveIntensity={glowIntensity}
            transparent
            opacity={0.3 * glowIntensity}
          />
        </mesh>
      )}

      {/* Walls */}
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.position} rotation={[0, wall.rotation, 0]}>
          <boxGeometry args={[wall.width, wall.height, 0.04]} />
          <meshStandardMaterial
            color={effectiveWall}
            transparent={wall.glass}
            opacity={wall.glass ? WALL_OPACITY_GLASS : 1}
            emissive={effectiveWall}
            emissiveIntensity={wall.glass ? 0.2 : 0}
          />
        </mesh>
      ))}

      {/* Room label — floating above */}
      <Html
        position={[floor.position[0], 2.8, floor.position[2]]}
        center
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <div style={{
          color: effectiveAccent,
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
          textShadow: "0 0 8px rgba(0,0,0,0.8)",
          userSelect: "none",
        }}>
          {room.label}
        </div>
      </Html>

      {/* Neon edge glow */}
      <mesh position={[floor.position[0], 0.07, floor.position[2]]}>
        <boxGeometry args={[floor.width, 0.01, floor.depth]} />
        <meshStandardMaterial
          color={effectiveAccent}
          emissive={effectiveAccent}
          emissiveIntensity={0.3}
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* Dimension callouts — visible when selected (all 4 edges) */}
      {selected && (() => {
        const cx = floor.position[0];
        const cz = floor.position[2];
        const hw = floor.width / 2;
        const hd = floor.depth / 2;
        const labelStyle: React.CSSProperties = {
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 10,
          fontWeight: 500,
          background: "rgba(10,18,32,0.82)",
          color: "#8bacd4",
          padding: "1px 5px",
          borderRadius: 3,
          whiteSpace: "nowrap",
          userSelect: "none",
          pointerEvents: "none",
        };
        return (
          <>
            {/* North edge — width */}
            <Html position={[cx, 0.15, cz - hd - 0.6]} center style={{ pointerEvents: "none" }}>
              <div style={labelStyle}>{room.size[0].toFixed(1)} m</div>
            </Html>
            {/* West edge — depth */}
            <Html position={[cx - hw - 0.6, 0.15, cz]} center style={{ pointerEvents: "none" }}>
              <div style={labelStyle}>{room.size[1].toFixed(1)} m</div>
            </Html>
            {/* South edge — width */}
            <Html position={[cx, 0.15, cz + hd + 0.6]} center style={{ pointerEvents: "none" }}>
              <div style={labelStyle}>{room.size[0].toFixed(1)} m</div>
            </Html>
            {/* East edge — depth */}
            <Html position={[cx + hw + 0.6, 0.15, cz]} center style={{ pointerEvents: "none" }}>
              <div style={labelStyle}>{room.size[1].toFixed(1)} m</div>
            </Html>
          </>
        );
      })()}

      {/* Furniture */}
      <RoomFurniture3D
        items={furniture}
        roomCenter={roomCenter}
        selectedIndex={selectedFurnitureIndex}
        accentColor={effectiveAccent}
        previewOverride={furniturePreview}
        onItemPointerDown={onFurniturePointerDown}
      />
    </group>
  );
}
