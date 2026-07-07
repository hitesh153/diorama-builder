"use client";

import { useState } from "react";
import { ROOM_PRESETS } from "@diorama/engine";
import { CustomRoomForm } from "../builder/CustomRoomForm";

const PRESET_GLYPHS: Record<string, string> = {
  meeting: "◇",
  workspace: "▤",
  private: "▪",
  social: "◍",
  lab: "△",
};

const GLYPH_TILE: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 7,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  color: "var(--ink-2)",
  fontSize: 13,
};

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "10px 12px",
  textAlign: "left",
};

interface PresetPaletteProps {
  onAdd: (presetId: string) => void;
  /** Double-click: place immediately at the next free position (bypasses placement mode) */
  onAddImmediate?: (presetId: string) => void;
  onAddCustom?: (name: string, width: number, height: number) => void;
}

export function PresetPalette({ onAdd, onAddImmediate, onAddCustom }: PresetPaletteProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);

  return (
    <div>
      <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 550, letterSpacing: "0.02em", color: "var(--ink-2)" }}>
        Room presets
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ROOM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onAdd(preset.id)}
            onDoubleClick={() => onAddImmediate?.(preset.id)}
            className="dio-card dio-card-interactive"
            style={ROW}
          >
            <span aria-hidden style={GLYPH_TILE}>
              {PRESET_GLYPHS[preset.id] ?? "•"}
            </span>
            <span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 550, color: "var(--ink)" }}>
                {preset.label}
              </span>
              <span className="dio-mono" style={{ display: "block", fontSize: 11, color: "var(--ink-3)" }}>
                {preset.defaultSize[0]}×{preset.defaultSize[1]}
              </span>
            </span>
          </button>
        ))}

        {/* Custom room */}
        {showCustomForm ? (
          <CustomRoomForm
            onAdd={(name, w, h) => {
              onAddCustom?.(name, w, h);
              setShowCustomForm(false);
            }}
            onCancel={() => setShowCustomForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowCustomForm(true)}
            className="dio-card dio-card-interactive"
            style={{ ...ROW, background: "transparent", borderStyle: "dashed" }}
          >
            <span aria-hidden style={GLYPH_TILE}>
              +
            </span>
            <span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 550, color: "var(--ink)" }}>
                Custom Room
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)" }}>
                Blank room, your layout
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
