"use client";

import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import { ROOM_PRESETS, findNextPosition, getFloorWall, type RoomConfig, type FloorStyle } from "@diorama/engine";
import { builderReducer, createBuilderState } from "@diorama/ui/src/builderStore";
import { PresetPalette } from "./PresetPalette";
import { AgentAssignPanel } from "./AgentAssignPanel";
import { ThemeStep } from "./ThemeStep";
import { BuildStep3D } from "./BuildStep3D";
import { ProToolbar } from "./ProToolbar";
import { RoomColorPicker } from "../builder/RoomColorPicker";
import { FloorStylePicker } from "../builder/FloorStylePicker";
import { FurnitureCatalogPanel } from "../builder/FurnitureCatalogPanel";
import { InspectorPanel } from "../builder/InspectorPanel";
import { useFurniturePlacement } from "../../hooks/useFurniturePlacement";
import {
  neonDarkTheme,
  warmOfficeTheme,
  cyberpunkTheme,
  minimalTheme,
} from "@diorama/plugins";

const THEME_COLORS: Record<string, { background: string; accent: string }> = {
  "neon-dark": neonDarkTheme.colors,
  "warm-office": warmOfficeTheme.colors,
  cyberpunk: cyberpunkTheme.colors,
  minimal: minimalTheme.colors,
};

let nextRoomId = 0;
function genRoomId(): string {
  return `room-${Date.now()}-${nextRoomId++}`;
}

interface BuildStepProps {
  agents: string[];
  theme: string;
  onThemeChange: (theme: string) => void;
  onComplete: (rooms: RoomConfig[], agentAssignments: Record<string, string>) => void;
  onBack: () => void;
}

export function BuildStep({ agents, theme, onThemeChange, onComplete, onBack }: BuildStepProps) {
  const [state, dispatch] = useReducer(builderReducer, createBuilderState());
  const [agentAssignments, setAgentAssignments] = useState<Record<string, string>>({});
  const [sidebarTab, setSidebarTab] = useState<"rooms" | "agents" | "theme" | "furniture">("rooms");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [fitSignal, setFitSignal] = useState(0);
  // Room placement mode: a palette click arms this; a viewport click places
  const [placingRoom, setPlacingRoom] = useState<{ presetId: string; size: [number, number]; label: string } | null>(null);

  const { rooms, selectedRoomId } = state;
  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) ?? null : null;

  // Dev-only: expose builder state for automated verification (no-op in prod)
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    (window as unknown as { __dioramaBuilder?: unknown }).__dioramaBuilder = state;
  }

  // Furniture placement
  const {
    placingItem,
    startPlacing,
    cancelPlacement,
    handlePlacementClick,
  } = useFurniturePlacement(rooms, selectedRoomId, dispatch);

  // Keyboard shortcuts — the handler is registered once ([] deps) and reads
  // live state through this ref (repo ref-based pattern, avoids stale closures)
  const keyStateRef = useRef({
    rooms,
    selectedRoomId,
    selectedRoomIds: state.selectedRoomIds,
    selectedFurniture: state.selectedFurniture,
  });
  keyStateRef.current = {
    rooms,
    selectedRoomId,
    selectedRoomIds: state.selectedRoomIds,
    selectedFurniture: state.selectedFurniture,
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const s = keyStateRef.current;

      if (e.key === "Escape") {
        cancelPlacement();
        setPlacingRoom(null);
        dispatch({ type: "SELECT_ROOM", roomId: null });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }
      // Duplicate selected room
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (s.selectedRoomId) {
          dispatch({ type: "DUPLICATE_ROOM", roomId: s.selectedRoomId, newId: genRoomId() });
        }
        return;
      }
      // Arrow keys nudge the multi-selection (Shift = ×5)
      const NUDGE: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (NUDGE[e.key]) {
        e.preventDefault(); // stop page scroll
        if (s.selectedRoomIds.length > 0) {
          const step = e.shiftKey ? 5 : 1;
          const [dx, dy] = NUDGE[e.key];
          dispatch({ type: "NUDGE_ROOMS", roomIds: s.selectedRoomIds, delta: [dx * step, dy * step] });
        }
        return;
      }
      // Rotate selected furniture 90°
      if ((e.key === "r" || e.key === "R") && s.selectedFurniture) {
        const room = s.rooms.find((r) => r.id === s.selectedFurniture!.roomId);
        const item = room?.furniture?.[s.selectedFurniture!.index];
        if (item) {
          const rot = item.rotation ?? [0, 0, 0];
          dispatch({
            type: "UPDATE_FURNITURE",
            roomId: s.selectedFurniture!.roomId,
            furnitureIndex: s.selectedFurniture!.index,
            updates: { rotation: [rot[0], (rot[1] + Math.PI / 2) % (Math.PI * 2), rot[2]] },
          });
        }
        return;
      }
      // Delete selected furniture, else selected room
      if (e.key === "d" || e.key === "D" || e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedFurniture) {
          dispatch({
            type: "REMOVE_FURNITURE",
            roomId: s.selectedFurniture.roomId,
            furnitureIndex: s.selectedFurniture.index,
          });
        } else if (s.selectedRoomId) {
          dispatch({ type: "REMOVE_ROOM", roomId: s.selectedRoomId });
        }
        return;
      }
      // View controls
      if (e.key === "2") { setViewMode("2d"); return; }
      if (e.key === "3") { setViewMode("3d"); return; }
      if (e.key === "f" || e.key === "F") { setFitSignal((n) => n + 1); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancelPlacement]);

  // Palette click → enter placement mode (ghost follows pointer in viewport)
  const startPlacingRoom = useCallback((presetId: string) => {
    const preset = ROOM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setPlacingRoom({ presetId, size: [...preset.defaultSize], label: preset.label });
  }, []);

  // Viewport click while placing → try to place; overlaps keep placement mode
  const placingRoomRef = useRef(placingRoom);
  placingRoomRef.current = placingRoom;
  const handlePlaceRoom = useCallback((position: [number, number]) => {
    const placing = placingRoomRef.current;
    if (!placing) return;
    if (position[0] < 0 || position[1] < 0) return;
    const [w, h] = placing.size;
    const overlaps = keyStateRef.current.rooms.some(
      (r) =>
        position[0] < r.position[0] + r.size[0] &&
        position[0] + w > r.position[0] &&
        position[1] < r.position[1] + r.size[1] &&
        position[1] + h > r.position[1],
    );
    if (overlaps) return; // stay in placing mode so the user can pick another spot
    dispatch({
      type: "ADD_ROOM",
      room: {
        id: genRoomId(),
        preset: placing.presetId,
        position,
        size: placing.size,
        label: placing.label,
      },
    });
    setPlacingRoom(null);
  }, []);

  // Palette double-click → old behavior: auto-place at the next free position
  const addRoom = useCallback((presetId: string) => {
    const preset = ROOM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const size: [number, number] = [...preset.defaultSize];
    const existing = rooms.map((r) => ({ position: r.position, size: r.size }));
    const position = findNextPosition(size, existing);

    setPlacingRoom(null); // double-click bypasses placement mode
    dispatch({
      type: "ADD_ROOM",
      room: {
        id: genRoomId(),
        preset: presetId,
        position,
        size,
        label: preset.label,
      },
    });
  }, [rooms]);

  const addCustomRoom = useCallback((name: string, width: number, height: number) => {
    const size: [number, number] = [width, height];
    const existing = rooms.map((r) => ({ position: r.position, size: r.size }));
    const position = findNextPosition(size, existing);

    dispatch({
      type: "ADD_ROOM",
      room: {
        id: genRoomId(),
        preset: "custom",
        position,
        size,
        label: name,
      },
    });
  }, [rooms]);

  const removeRoom = useCallback((roomId: string) => {
    dispatch({ type: "REMOVE_ROOM", roomId });
  }, []);

  const handleComplete = () => {
    // Convert RoomPlacement[] to RoomConfig[] (strip IDs)
    let finalRooms: RoomConfig[] = rooms.map(({ id: _id, ...rest }) => rest);
    const assignedAgents = new Set(Object.keys(agentAssignments));
    const unassigned = agents.filter((a) => !assignedAgents.has(a));

    if (unassigned.length > 0 && !finalRooms.some((r) => r.label === "General")) {
      const existing = finalRooms.map((r) => ({ position: r.position, size: r.size }));
      const position = findNextPosition([5, 4], existing);
      finalRooms = [...finalRooms, { preset: "workspace", position, size: [5, 4], label: "General" }];
    }

    const finalAssignments = { ...agentAssignments };
    for (const agent of unassigned) {
      finalAssignments[agent] = "General";
    }

    onComplete(finalRooms, finalAssignments);
  };

  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top toolbar */}
      <ProToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => dispatch({ type: "UNDO" })}
        onRedo={() => dispatch({ type: "REDO" })}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onFit={() => setFitSignal((n) => n + 1)}
      />

      {/* Main content row */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Left: 3D Viewport */}
      <div style={{ flex: 1, position: "relative" }}>
        <BuildStep3D
          rooms={rooms}
          theme={theme}
          selectedRoomId={selectedRoomId}
          selectedRoomIds={state.selectedRoomIds}
          selectedFurniture={state.selectedFurniture}
          dispatch={dispatch}
          viewMode={viewMode}
          fitSignal={fitSignal}
          isPlacingFurniture={placingItem !== null}
          onFurniturePlacementClick={handlePlacementClick}
          placingRoom={placingRoom ? { size: placingRoom.size } : null}
          onPlaceRoom={handlePlaceRoom}
        />
        {placingRoom && (
          <div style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(8,14,24,0.94)",
            border: "1px solid #1e2d42",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 11,
            color: "#8bacd4",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            Click to place · Esc to cancel
          </div>
        )}
        {rooms.length === 0 && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "#666",
            pointerEvents: "none",
          }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>Your office is empty</p>
            <p style={{ fontSize: 13 }}>Add rooms from the palette on the right</p>
          </div>
        )}
      </div>

      {/* Right: Sidebar */}
      <div style={{
        width: 320,
        background: "#0d1520",
        borderLeft: "1px solid #1a2535",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1a2535" }}>
          {(["rooms", "agents", "theme", "furniture"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              style={{
                flex: 1,
                padding: "12px 0",
                background: sidebarTab === tab ? "#1a2535" : "transparent",
                border: "none",
                color: sidebarTab === tab ? "#e0e0e0" : "#666",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Inspector — top of the sidebar whenever a room is selected (any tab) */}
        {(selectedRoom || state.selectedRoomIds.length > 0 || state.selectedFurniture) && (
          <InspectorPanel
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            selectedRoomIds={state.selectedRoomIds}
            selectedFurniture={state.selectedFurniture}
            dispatch={dispatch}
          />
        )}

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "auto", overscrollBehavior: "contain", padding: 16 }}>
          {sidebarTab === "rooms" && (
            <div>
              <PresetPalette onAdd={startPlacingRoom} onAddImmediate={addRoom} onAddCustom={addCustomRoom} />
              {selectedRoom && (
                <div style={{ marginTop: 24, borderTop: "1px solid #1a2535", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#999" }}>Selected Room</h4>
                  <p style={{ fontSize: 14, marginBottom: 8 }}>{selectedRoom.label}</p>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
                    {selectedRoom.size[0].toFixed(1)}m × {selectedRoom.size[1].toFixed(1)}m
                    {" · "}{(selectedRoom.size[0] * selectedRoom.size[1]).toFixed(1)} m²
                    {" · "}({selectedRoom.position[0]}, {selectedRoom.position[1]})
                  </p>
                  {/* Per-room color picker */}
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <RoomColorPicker
                      accent={selectedRoom.colors?.accent}
                      floor={selectedRoom.colors?.floor}
                      wall={selectedRoom.colors?.wall}
                      defaultAccent={(THEME_COLORS[theme] ?? THEME_COLORS["neon-dark"]).accent}
                      defaultFloor={(THEME_COLORS[theme] ?? THEME_COLORS["neon-dark"]).background}
                      onChange={(colors) => {
                        dispatch({ type: "SET_ROOM_COLORS", roomId: selectedRoom.id, colors });
                      }}
                    />
                  </div>

                  {/* Per-room floor style picker */}
                  <div style={{ marginBottom: 16 }}>
                    <FloorStylePicker
                      value={selectedRoom.floorStyle as FloorStyle | undefined}
                      presetDefault={
                        getFloorWall(selectedRoom.preset, theme)?.floorStyle ?? "solid"
                      }
                      onChange={(style) => {
                        dispatch({ type: "SET_FLOOR_STYLE", roomId: selectedRoom.id, floorStyle: style });
                      }}
                    />
                  </div>

                  <button
                    onClick={() => removeRoom(selectedRoom.id)}
                    style={{
                      width: "100%",
                      padding: "8px 0",
                      background: "transparent",
                      color: "#ff6b6b",
                      border: "1px solid #ff6b6b33",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Remove Room
                  </button>
                </div>
              )}
            </div>
          )}

          {sidebarTab === "agents" && (
            <AgentAssignPanel
              agents={agents}
              rooms={rooms}
              assignments={agentAssignments}
              onAssign={(agent, roomLabel) => {
                setAgentAssignments((prev) => ({ ...prev, [agent]: roomLabel }));
              }}
            />
          )}

          {sidebarTab === "theme" && (
            <ThemeStep
              onNext={onThemeChange}
              compact
            />
          )}

          {sidebarTab === "furniture" && (
            selectedRoom ? (
              <FurnitureCatalogPanel
                selectedRoomLabel={selectedRoom.label}
                placingItemId={placingItem?.id ?? null}
                onSelectItem={startPlacing}
                onCancelPlacement={cancelPlacement}
                existingFurniture={(selectedRoom.furniture ?? []).map((f) => ({
                  geometry: f.geometry,
                  size: f.size,
                  label: f.label,
                }))}
                onRemoveFurniture={(idx) => {
                  dispatch({ type: "REMOVE_FURNITURE", roomId: selectedRoom.id, furnitureIndex: idx });
                }}
              />
            ) : (
              <div style={{ color: "#666", fontSize: 13 }}>
                <p>Select a room first to add furniture.</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>
                  Click on a room in the 3D viewport, then choose items from the catalog.
                </p>
              </div>
            )
          )}
        </div>

        {/* Floor area summary */}
        {rooms.length > 0 && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid #1a2535", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#556" }}>
            <span>{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
            <span style={{ color: "#8090c0" }}>
              {rooms.reduce((s, r) => s + r.size[0] * r.size[1], 0).toFixed(0)} m² total
            </span>
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ padding: 16, borderTop: "1px solid #1a2535", display: "flex", gap: 8 }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "transparent",
              color: "#888",
              border: "1px solid #333",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            disabled={rooms.length === 0}
            style={{
              flex: 2,
              padding: "10px 0",
              background: rooms.length > 0 ? "#8090c0" : "#333",
              color: rooms.length > 0 ? "#fff" : "#666",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: rooms.length > 0 ? "pointer" : "default",
            }}
          >
            Continue to Launch
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
