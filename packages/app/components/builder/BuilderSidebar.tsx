"use client";

import { useReducer, useCallback, useRef, useEffect, useState } from "react";
import {
  createBuilderState,
  builderReducer,
  type BuilderAction,
  type RoomPlacement,
} from "../../../ui/src/builderStore";
import type { DioramaConfig } from "@diorama/engine";
import { RoomCatalog } from "./RoomCatalog";
import { RoomProperties } from "./RoomProperties";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UndoRedo } from "./UndoRedo";

interface BuilderSidebarProps {
  config: DioramaConfig;
  selectedRoom: string | null;
  onConfigChange: (config: DioramaConfig) => void;
  onSelectRoom: (roomLabel: string | null) => void;
}

function configToRooms(config: DioramaConfig): RoomPlacement[] {
  return config.rooms.map((r, i) => ({
    id: `${r.preset}-${r.position[0]}-${r.position[1]}-${i}`,
    preset: r.preset,
    position: r.position as [number, number],
    size: r.size as [number, number],
    label: r.label,
    ...(r.colors && { colors: r.colors }),
    ...(r.floorStyle && { floorStyle: r.floorStyle }),
    ...(r.furniture && { furniture: r.furniture }),
  }));
}

export function BuilderSidebar({ config, selectedRoom, onConfigChange, onSelectRoom }: BuilderSidebarProps) {
  const [state, dispatch] = useReducer(builderReducer, createBuilderState(configToRooms(config)));
  const [tab, setTab] = useState<"rooms" | "theme">("rooms");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save on state change (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const updatedConfig: DioramaConfig = {
        ...config,
        rooms: state.rooms.map((r) => ({
          preset: r.preset,
          position: r.position,
          size: r.size,
          label: r.label,
          ...(r.colors && { colors: r.colors }),
          ...(r.floorStyle && { floorStyle: r.floorStyle }),
          ...(r.furniture && { furniture: r.furniture }),
        })),
      };
      onConfigChange(updatedConfig);

      // Persist to server
      fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      }).catch(() => {});
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.rooms]);

  const handleDispatch = useCallback((action: BuilderAction) => {
    dispatch(action);
  }, []);

  const selectedPlacement = state.rooms.find((r) => r.label === selectedRoom) ?? null;

  return (
    <div
      style={{
        width: 300,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Builder</h3>
      </div>

      {/* Undo/Redo */}
      <UndoRedo
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        onUndo={() => handleDispatch({ type: "UNDO" })}
        onRedo={() => handleDispatch({ type: "REDO" })}
      />

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {(["rooms", "theme"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="dio-tab"
            data-active={tab === t}
            style={{ flex: 1 }}
          >
            {t === "rooms" ? "Rooms" : "Theme"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: 12 }}>
        {tab === "rooms" && (
          <>
            {selectedPlacement ? (
              <RoomProperties
                room={selectedPlacement}
                onUpdate={(updates) =>
                  handleDispatch({ type: "UPDATE_ROOM", roomId: selectedPlacement.id, updates })
                }
                onResize={(size) =>
                  handleDispatch({ type: "RESIZE_ROOM", roomId: selectedPlacement.id, size })
                }
                onRemove={() => {
                  handleDispatch({ type: "REMOVE_ROOM", roomId: selectedPlacement.id });
                  onSelectRoom(null);
                }}
                onDeselect={() => onSelectRoom(null)}
              />
            ) : (
              <RoomCatalog onAdd={(room) => handleDispatch({ type: "ADD_ROOM", room })} />
            )}
          </>
        )}

        {tab === "theme" && (
          <ThemeSwitcher
            currentTheme={config.theme}
            onThemeChange={(theme) => {
              onConfigChange({ ...config, theme });
              fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...config, theme }),
              }).catch(() => {});
            }}
          />
        )}
      </div>

      {/* Reset button */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
        <button
          onClick={async () => {
            await fetch("/api/config", { method: "DELETE" });
            window.location.href = "/wizard";
          }}
          className="dio-btn dio-btn-danger"
          style={{ width: "100%" }}
        >
          Reset Configuration
        </button>
      </div>
    </div>
  );
}
