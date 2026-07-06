"use client";

import { Component, useMemo, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { toWorld } from "@diorama/engine";
import * as THREE from "three";
import { Room3D } from "../scene/Room3D";
import { fitCameraDistance } from "../scene/DioramaScene";
import { DragGroundPlane } from "../scene/DragGroundPlane";
import { GhostRoom } from "../scene/GhostRoom";
import { ResizeHandles } from "../scene/ResizeHandles";
import { AlignmentGuides } from "../scene/AlignmentGuides";
import { useDragRoom } from "../../hooks/useDragRoom";
import { useResizeRoom } from "../../hooks/useResizeRoom";
import type { RoomPlacement, BuilderAction } from "@diorama/ui/src/builderStore";
import {
  neonDarkTheme,
  warmOfficeTheme,
  cyberpunkTheme,
  minimalTheme,
} from "@diorama/plugins";

const THEMES: Record<string, { background: string; accent: string }> = {
  "neon-dark": neonDarkTheme.colors,
  "warm-office": warmOfficeTheme.colors,
  cyberpunk: cyberpunkTheme.colors,
  minimal: minimalTheme.colors,
};

class Canvas3DErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message + "\n" + err.stack };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#ff6b6b", fontSize: 13, whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "100%" }}>
          <strong>3D Render Error</strong>
          <pre style={{ marginTop: 8 }}>{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface BuildStep3DProps {
  rooms: RoomPlacement[];
  theme: string;
  selectedRoomId: string | null;
  dispatch: React.Dispatch<BuilderAction>;
  isPlacingFurniture?: boolean;
  onFurniturePlacementClick?: (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void;
}

/** Syncs camera + OrbitControls target to the rooms centroid on every frame */
function CameraSync({ center, fitRadius }: { center: [number, number, number]; fitRadius: number }) {
  const { camera, controls } = useThree();
  const prevCenter = useRef<string>("");

  useEffect(() => {
    const key = `${center[0].toFixed(2)},${center[2].toFixed(2)},${fitRadius.toFixed(2)}`;
    if (key === prevCenter.current) return;
    prevCenter.current = key;

    const fov = "fov" in camera ? (camera as unknown as THREE.PerspectiveCamera).fov : 50;
    const d = fitCameraDistance(fitRadius, fov);
    camera.position.set(center[0], d * 0.8, center[2] + d * 0.6);
    camera.lookAt(center[0], 0, center[2]);
    camera.updateProjectionMatrix();

    // Imperatively update OrbitControls target so it orbits around rooms
    if (controls) {
      const c = controls as unknown as { target: THREE.Vector3; update: () => void };
      c.target.set(center[0], 0, center[2]);
      c.update();
    }
  }, [center, fitRadius, camera, controls]);

  return null;
}

export function BuildStep3D({ rooms, theme, selectedRoomId, dispatch, isPlacingFurniture, onFurniturePlacementClick }: BuildStep3DProps) {
  const colors = THEMES[theme] ?? THEMES["neon-dark"];

  const {
    isDragging,
    ghost: dragGhost,
    alignmentGuides: dragGuides,
    handleRoomPointerDown,
    handlePointerMove: handleDragPointerMove,
    handlePointerUp: handleDragPointerUp,
  } = useDragRoom(rooms, dispatch);

  const {
    isResizing,
    resizeGhost,
    alignmentGuides: resizeGuides,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
  } = useResizeRoom(rooms, dispatch);

  const allGuides = [...dragGuides, ...resizeGuides];

  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : null;
  const isInteracting = isDragging || isResizing;

  // Compute centroid + bounding radius of all rooms for camera targeting
  const GRID_UNIT = 200;
  const GRID_WORLD = 3.6;
  const { roomsCenter, fitRadius } = useMemo(() => {
    if (rooms.length === 0) {
      return { roomsCenter: [0, 0, 0] as [number, number, number], fitRadius: 12 };
    }
    let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (const r of rooms) {
      minGx = Math.min(minGx, r.position[0]);
      minGy = Math.min(minGy, r.position[1]);
      maxGx = Math.max(maxGx, r.position[0] + r.size[0]);
      maxGy = Math.max(maxGy, r.position[1] + r.size[1]);
    }
    const cx = ((minGx + maxGx) / 2) * GRID_UNIT;
    const cy = ((minGy + maxGy) / 2) * GRID_UNIT;
    const [wx, , wz] = toWorld(cx, cy);
    const halfW = ((maxGx - minGx) / 2) * GRID_WORLD;
    const halfH = ((maxGy - minGy) / 2) * GRID_WORLD;
    return {
      roomsCenter: [wx, 0, wz] as [number, number, number],
      fitRadius: Math.max(Math.hypot(halfW, halfH), 6),
    };
  }, [rooms]);

  // Merge pointer-move / pointer-up so both drag and resize get events
  const onGroundMove = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    handleDragPointerMove(e);
    handleResizePointerMove(e);
  };
  const onGroundUp = () => {
    handleDragPointerUp();
    handleResizePointerUp();
  };

  return (
    <Canvas3DErrorBoundary>
      <Canvas
        style={{ background: colors.background }}
        onPointerMissed={() => {
          dispatch({ type: "SELECT_ROOM", roomId: null });
        }}
      >
        {/* Camera */}
        <PerspectiveCamera makeDefault position={[roomsCenter[0], 20, roomsCenter[2] + 15]} fov={50} />
        <CameraSync center={roomsCenter} fitRadius={fitRadius} />

        {/* Lighting */}
        <ambientLight intensity={0.4} color={colors.accent} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
        <directionalLight position={[-5, 10, -5]} intensity={0.3} />

        {/* Grid helper */}
        <gridHelper
          args={[40, 40, "#1a2535", "#111825"]}
          position={[0, -0.01, 0]}
        />

        {/* Invisible ground plane for drag / resize tracking */}
        <DragGroundPlane
          onPointerDown={() => {
            dispatch({ type: "SELECT_ROOM", roomId: null });
          }}
          onPointerMove={onGroundMove}
          onPointerUp={onGroundUp}
        />

        {rooms.map((room) => (
          <Room3D
            key={room.id}
            room={room}
            accentColor={colors.accent}
            floorColor={colors.background}
            themeId={theme}
            selected={selectedRoomId === room.id}
            onPointerDown={(e) => {
              // In furniture placement mode, clicking the selected room places furniture
              if (isPlacingFurniture && selectedRoomId === room.id) {
                onFurniturePlacementClick?.(e);
                return;
              }
              handleRoomPointerDown(room.id, e);
            }}
            onPointerUp={onGroundUp}
            onPointerMove={onGroundMove}
          />
        ))}

        {/* Resize handles on selected room */}
        {selectedRoom && !isDragging && (
          <ResizeHandles
            position={selectedRoom.position}
            size={selectedRoom.size}
            color={colors.accent}
            onPointerDown={(edge, e) => handleResizePointerDown(selectedRoom.id, edge, e)}
            onPointerMove={onGroundMove}
            onPointerUp={onGroundUp}
          />
        )}

        {/* Ghost room shown during drag */}
        {dragGhost && (
          <GhostRoom
            position={dragGhost.position}
            size={dragGhost.size}
            isValid={dragGhost.isValid}
          />
        )}

        {/* Ghost room shown during resize */}
        {resizeGhost && (
          <GhostRoom
            position={resizeGhost.position}
            size={resizeGhost.size}
            isValid={resizeGhost.isValid}
          />
        )}

        {/* Alignment snap guides */}
        <AlignmentGuides guides={allGuides} />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.1}
          target={roomsCenter}
          enablePan={false}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={50}
          enabled={!isInteracting}
        />
      </Canvas>
    </Canvas3DErrorBoundary>
  );
}
