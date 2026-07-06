"use client";

import { Component, useMemo, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { toWorld, toCanvas } from "@diorama/engine";
import * as THREE from "three";
import { Room3D } from "../scene/Room3D";
import { fitCameraDistance } from "../scene/DioramaScene";
import { DragGroundPlane } from "../scene/DragGroundPlane";
import { GhostRoom } from "../scene/GhostRoom";
import { ResizeHandles } from "../scene/ResizeHandles";
import { AlignmentGuides } from "../scene/AlignmentGuides";
import { useDragRoom } from "../../hooks/useDragRoom";
import { useResizeRoom } from "../../hooks/useResizeRoom";
import { useFurnitureDrag } from "../../hooks/useFurnitureDrag";
import type { RoomPlacement, BuilderAction, FurnitureRef } from "@diorama/ui/src/builderStore";
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
  selectedRoomIds: string[];
  selectedFurniture: FurnitureRef | null;
  dispatch: React.Dispatch<BuilderAction>;
  viewMode: "2d" | "3d";
  /** Increment to trigger zoom-to-fit (F key / toolbar button) */
  fitSignal: number;
  isPlacingFurniture?: boolean;
  onFurniturePlacementClick?: (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void;
  /** Room-placement mode: ghost follows pointer, click places */
  placingRoom?: { size: [number, number] } | null;
  onPlaceRoom?: (position: [number, number]) => void;
}

interface CameraFrame {
  center: [number, number, number];
  fitRadius: number;
}

/**
 * Frames the 3D perspective camera on the rooms. Only refits when
 * `fitSignal` changes (or on first mount / camera swap) — NOT on every
 * rooms-centroid change, so the camera never jumps while editing.
 * Center/fitRadius are read through a ref at fit time to avoid dep churn.
 */
function CameraSync({ frameRef, fitSignal }: { frameRef: React.RefObject<CameraFrame>; fitSignal: number }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const { center, fitRadius } = frameRef.current;
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
  }, [fitSignal, camera, controls, frameRef]);

  return null;
}

/**
 * Top-down framing for the 2D view. Uses the same perspective camera as 3D
 * (no camera swapping — drei makeDefault swaps race with imperative camera
 * setup) positioned directly overhead; OrbitControls rotation is disabled in
 * this mode so the view stays planimetric. Recomputes on fitSignal.
 */
function TopDownCameraSync({ frameRef, fitSignal }: { frameRef: React.RefObject<CameraFrame>; fitSignal: number }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const { center, fitRadius } = frameRef.current;
    const fov = "fov" in camera ? (camera as unknown as THREE.PerspectiveCamera).fov : 50;
    // Height so the bounding radius fills ~80% of the vertical view
    const h = Math.min(Math.max((fitRadius * 1.25) / Math.tan(((fov / 2) * Math.PI) / 180), 8), 55);
    camera.up.set(0, 0, -1);
    camera.position.set(center[0], h, center[2]);
    camera.lookAt(center[0], 0, center[2]);
    camera.updateProjectionMatrix();

    if (controls) {
      const c = controls as unknown as { target: THREE.Vector3; update: () => void };
      c.target.set(center[0], 0, center[2]);
      c.update();
    }
    return () => {
      // Restore default up for the 3D mode
      camera.up.set(0, 1, 0);
    };
  }, [fitSignal, camera, controls, frameRef]);

  return null;
}

export function BuildStep3D({
  rooms,
  theme,
  selectedRoomId,
  selectedRoomIds,
  selectedFurniture,
  dispatch,
  viewMode,
  fitSignal,
  isPlacingFurniture,
  onFurniturePlacementClick,
  placingRoom = null,
  onPlaceRoom,
}: BuildStep3DProps) {
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

  const {
    isDraggingFurniture,
    furniturePreview,
    handleFurniturePointerDown,
    handleFurniturePointerMove,
    handleFurniturePointerUp,
  } = useFurnitureDrag(rooms, dispatch);

  const allGuides = [...dragGuides, ...resizeGuides];

  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : null;
  const isInteracting = isDragging || isResizing || isDraggingFurniture;

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

  // Camera framing is read via ref at fit time (fitSignal), never as an effect dep
  const frameRef = useRef<CameraFrame>({ center: roomsCenter, fitRadius });
  frameRef.current = { center: roomsCenter, fitRadius };

  // ---- Room placement mode (ghost follows pointer) ----
  const [placeGhost, setPlaceGhost] = useState<{ position: [number, number]; isValid: boolean } | null>(null);
  useEffect(() => {
    if (!placingRoom) setPlaceGhost(null);
  }, [placingRoom]);

  const placementPosFromEvent = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>): [number, number] => {
    const [canvasX, canvasY] = toCanvas(e.point.x, e.point.z);
    const [w, h] = placingRoom!.size;
    return [
      Math.max(0, Math.round(canvasX / GRID_UNIT - w / 2)),
      Math.max(0, Math.round(canvasY / GRID_UNIT - h / 2)),
    ];
  };

  const placementOverlaps = (pos: [number, number], size: [number, number]): boolean =>
    rooms.some(
      (r) =>
        pos[0] < r.position[0] + r.size[0] &&
        pos[0] + size[0] > r.position[0] &&
        pos[1] < r.position[1] + r.size[1] &&
        pos[1] + size[1] > r.position[1],
    );

  const updatePlacementGhost = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    if (!placingRoom) return;
    const pos = placementPosFromEvent(e);
    const isValid = !placementOverlaps(pos, placingRoom.size);
    setPlaceGhost((prev) =>
      prev && prev.position[0] === pos[0] && prev.position[1] === pos[1] && prev.isValid === isValid
        ? prev
        : { position: pos, isValid },
    );
  };

  // Merge pointer-move / pointer-up so drag, resize, furniture drag and
  // placement ghost all get events from both the ground plane and rooms
  const onGroundMove = (e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
    handleDragPointerMove(e);
    handleResizePointerMove(e);
    handleFurniturePointerMove(e);
    updatePlacementGhost(e);
  };
  const onGroundUp = () => {
    handleDragPointerUp();
    handleResizePointerUp();
    handleFurniturePointerUp();
  };

  return (
    <Canvas3DErrorBoundary>
      <Canvas
        style={{ background: colors.background }}
        onPointerMissed={() => {
          dispatch({ type: "SELECT_ROOM", roomId: null });
        }}
      >
        {/* Camera — shared perspective camera; 2D locks it top-down */}
        <PerspectiveCamera makeDefault position={[0, 20, 15]} fov={50} />
        {viewMode === "3d" ? (
          <CameraSync frameRef={frameRef} fitSignal={fitSignal} />
        ) : (
          <TopDownCameraSync frameRef={frameRef} fitSignal={fitSignal} />
        )}

        {/* Lighting */}
        <ambientLight intensity={0.4} color={colors.accent} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
        <directionalLight position={[-5, 10, -5]} intensity={0.3} />

        {/* Grid helper */}
        <gridHelper
          args={[40, 40, "#1a2535", "#111825"]}
          position={[0, -0.01, 0]}
        />

        {/* Invisible ground plane for drag / resize / placement tracking */}
        <DragGroundPlane
          onPointerDown={(e) => {
            if (placingRoom) {
              onPlaceRoom?.(placementPosFromEvent(e));
              return;
            }
            dispatch({ type: "SELECT_ROOM", roomId: null });
          }}
          onPointerMove={onGroundMove}
          onPointerUp={onGroundUp}
        />

        {rooms.map((room) => {
          const hasCustomFurniture = (room.furniture?.length ?? 0) > 0;
          const furnitureEditable =
            hasCustomFurniture &&
            selectedRoomId === room.id &&
            !isPlacingFurniture &&
            !placingRoom;
          return (
            <Room3D
              key={room.id}
              room={room}
              accentColor={colors.accent}
              floorColor={colors.background}
              themeId={theme}
              selected={selectedRoomId === room.id}
              multiSelected={selectedRoomId !== room.id && selectedRoomIds.includes(room.id)}
              selectedFurnitureIndex={
                hasCustomFurniture && selectedFurniture?.roomId === room.id
                  ? selectedFurniture.index
                  : null
              }
              furniturePreview={
                furniturePreview?.roomId === room.id
                  ? { index: furniturePreview.index, position: furniturePreview.position }
                  : null
              }
              onFurniturePointerDown={
                furnitureEditable
                  ? (index, e) => handleFurniturePointerDown(room.id, index, e)
                  : undefined
              }
              onPointerDown={(e) => {
                // In room placement mode, clicking anywhere attempts to place
                if (placingRoom) {
                  onPlaceRoom?.(placementPosFromEvent(e));
                  return;
                }
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
          );
        })}

        {/* Resize handles on selected room */}
        {selectedRoom && !isDragging && !placingRoom && (
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

        {/* Ghost room shown in placement mode (red tint on overlap) */}
        {placingRoom && placeGhost && (
          <GhostRoom
            position={placeGhost.position}
            size={placingRoom.size}
            isValid={placeGhost.isValid}
          />
        )}

        {/* Alignment snap guides */}
        <AlignmentGuides guides={allGuides} />

        {viewMode === "3d" ? (
          <OrbitControls
            key="orbit-3d"
            makeDefault
            enableDamping
            dampingFactor={0.1}
            enablePan={false}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={5}
            maxDistance={50}
            enabled={!isInteracting}
          />
        ) : (
          <OrbitControls
            key="orbit-2d"
            makeDefault
            enableDamping
            dampingFactor={0.1}
            enableRotate={false}
            enablePan
            screenSpacePanning
            minDistance={5}
            maxDistance={55}
            enabled={!isInteracting}
          />
        )}
      </Canvas>
    </Canvas3DErrorBoundary>
  );
}
