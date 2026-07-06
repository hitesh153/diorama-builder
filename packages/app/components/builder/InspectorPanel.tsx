"use client";

import { useEffect, useState } from "react";
import { furnitureDisplayName, type FurnitureItem } from "@diorama/engine";
import type { RoomPlacement, FurnitureRef, BuilderAction } from "@diorama/ui/src/builderStore";

const MONO = "'SF Mono', 'Fira Code', monospace";

/**
 * Draft-buffered input: edits are local while typing and COMMIT on blur or
 * Enter (Escape reverts). Committing per keystroke would move rooms through
 * transient values ("6" while typing "62") and spam the undo history.
 */
function CommitField({
  value,
  disabled,
  onCommit,
  type = "text",
  min,
  step,
  style,
}: {
  value: string;
  disabled?: boolean;
  onCommit: (raw: string) => void;
  type?: "text" | "number";
  min?: number;
  step?: number;
  style: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  // Re-sync when the source value changes (selection change, undo, drag...)
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      type={type}
      min={min}
      step={step}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
        e.stopPropagation();
      }}
      style={style}
    />
  );
}

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "#556",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
  fontFamily: MONO,
};

const INPUT: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "5px 8px",
  background: "#0a111c",
  border: "1px solid #1a2535",
  borderRadius: 5,
  color: "#e0e0e0",
  fontSize: 12,
  fontFamily: MONO,
  outline: "none",
};

const INPUT_DISABLED: React.CSSProperties = {
  ...INPUT,
  color: "#556",
  cursor: "default",
};

const SECTION: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #1a2535",
  background: "#0d1520",
};

const HEADER: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 11,
  color: "#8090c0",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  fontFamily: MONO,
};

interface InspectorPanelProps {
  rooms: RoomPlacement[];
  selectedRoomId: string | null;
  selectedRoomIds: string[];
  selectedFurniture: FurnitureRef | null;
  dispatch: React.Dispatch<BuilderAction>;
}

export function InspectorPanel({
  rooms,
  selectedRoomId,
  selectedRoomIds,
  selectedFurniture,
  dispatch,
}: InspectorPanelProps) {
  // ---- Furniture inspector ----
  if (selectedFurniture) {
    const room = rooms.find((r) => r.id === selectedFurniture.roomId);
    const item = room?.furniture?.[selectedFurniture.index];
    if (room && item) {
      const setPosition = (axis: 0 | 2, raw: string) => {
        const v = parseFloat(raw);
        if (!Number.isFinite(v)) return;
        const position: [number, number, number] = [...item.position];
        position[axis] = v;
        dispatch({
          type: "UPDATE_FURNITURE",
          roomId: room.id,
          furnitureIndex: selectedFurniture.index,
          updates: { position },
        });
      };
      const rotate90 = () => {
        const rot = item.rotation ?? [0, 0, 0];
        dispatch({
          type: "UPDATE_FURNITURE",
          roomId: room.id,
          furnitureIndex: selectedFurniture.index,
          updates: { rotation: [rot[0], (rot[1] + Math.PI / 2) % (Math.PI * 2), rot[2]] },
        });
      };
      return (
        <div style={SECTION}>
          <h4 style={HEADER}>Furniture</h4>
          <p style={{ fontSize: 13, margin: "0 0 10px", color: "#e0e0e0" }}>
            {furnitureDisplayName(item as FurnitureItem, selectedFurniture.index)}
            <span style={{ fontSize: 11, color: "#556", marginLeft: 8, fontFamily: MONO }}>
              in {room.label}
            </span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={FIELD_LABEL}>X</label>
              <CommitField
                type="number"
                step={0.1}
                value={String(item.position[0])}
                onCommit={(raw) => setPosition(0, raw)}
                style={INPUT}
              />
            </div>
            <div>
              <label style={FIELD_LABEL}>Z</label>
              <CommitField
                type="number"
                step={0.1}
                value={String(item.position[2])}
                onCommit={(raw) => setPosition(2, raw)}
                style={INPUT}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={rotate90}
              style={{
                flex: 1,
                padding: "7px 0",
                background: "#1a2535",
                color: "#c0d0e0",
                border: "1px solid #2a3545",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: MONO,
              }}
            >
              ↻ 90°
            </button>
            <button
              onClick={() =>
                dispatch({
                  type: "REMOVE_FURNITURE",
                  roomId: room.id,
                  furnitureIndex: selectedFurniture.index,
                })
              }
              style={{
                flex: 1,
                padding: "7px 0",
                background: "transparent",
                color: "#ff6b6b",
                border: "1px solid #ff6b6b33",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: MONO,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      );
    }
  }

  // ---- Room inspector ----
  const room = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) ?? null : null;
  if (!room) return null;

  const multi = selectedRoomIds.length > 1;
  const [w, h] = room.size;

  const moveAxis = (axis: 0 | 1, raw: string) => {
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 0) return;
    const position: [number, number] = [...room.position];
    position[axis] = v;
    // Reducer rejects overlaps, so invalid moves just don't apply.
    dispatch({ type: "MOVE_ROOM", roomId: room.id, position });
  };

  const resizeAxis = (axis: 0 | 1, raw: string) => {
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 1) return;
    const size: [number, number] = [...room.size];
    size[axis] = v;
    dispatch({ type: "RESIZE_ROOM", roomId: room.id, size });
  };

  return (
    <div style={SECTION}>
      <h4 style={HEADER}>Inspector</h4>
      {multi && (
        <p style={{ fontSize: 12, color: "#8090c0", margin: "0 0 10px", fontFamily: MONO }}>
          {selectedRoomIds.length} rooms selected
        </p>
      )}
      <div style={{ marginBottom: 10 }}>
        <label style={FIELD_LABEL}>Label</label>
        <CommitField
          type="text"
          value={room.label}
          disabled={multi}
          onCommit={(raw) => raw.trim() && dispatch({ type: "UPDATE_ROOM", roomId: room.id, updates: { label: raw.trim() } })}
          style={multi ? INPUT_DISABLED : INPUT}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={FIELD_LABEL}>X</label>
          <CommitField
            type="number"
            min={0}
            step={1}
            value={String(room.position[0])}
            disabled={multi}
            onCommit={(raw) => moveAxis(0, raw)}
            style={multi ? INPUT_DISABLED : INPUT}
          />
        </div>
        <div>
          <label style={FIELD_LABEL}>Y</label>
          <CommitField
            type="number"
            min={0}
            step={1}
            value={String(room.position[1])}
            disabled={multi}
            onCommit={(raw) => moveAxis(1, raw)}
            style={multi ? INPUT_DISABLED : INPUT}
          />
        </div>
        <div>
          <label style={FIELD_LABEL}>W</label>
          <CommitField
            type="number"
            min={1}
            step={1}
            value={String(w)}
            disabled={multi}
            onCommit={(raw) => resizeAxis(0, raw)}
            style={multi ? INPUT_DISABLED : INPUT}
          />
        </div>
        <div>
          <label style={FIELD_LABEL}>H</label>
          <CommitField
            type="number"
            min={1}
            step={1}
            value={String(h)}
            disabled={multi}
            onCommit={(raw) => resizeAxis(1, raw)}
            style={multi ? INPUT_DISABLED : INPUT}
          />
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#556", margin: 0, fontFamily: MONO }}>
        {w}×{h} cells · {w * h} cells² · {(w * h).toFixed(1)} m²
      </p>
    </div>
  );
}
