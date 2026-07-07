"use client";

interface ProToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  viewMode: "2d" | "3d";
  onViewModeChange: (mode: "2d" | "3d") => void;
  onFit: () => void;
}

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "var(--border)",
  margin: "0 6px",
  flexShrink: 0,
};

const SEG_BTN: React.CSSProperties = {
  padding: "3px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 550,
  color: "var(--ink-2)",
  transition: "background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)",
};

const SEG_BTN_ACTIVE: React.CSSProperties = {
  ...SEG_BTN,
  background: "var(--surface-3)",
  color: "var(--ink)",
};

export function ProToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  viewMode,
  onViewModeChange,
  onFit,
}: ProToolbarProps) {
  return (
    <div style={{
      height: 44,
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 4,
      userSelect: "none",
    }}>
      {/* Select indicator — quiet chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 5,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          fontSize: 12,
          fontWeight: 550,
          color: "var(--ink-2)",
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden>▸</span> Select
      </div>

      <div style={DIVIDER} />

      {/* 2D | 3D segmented view toggle */}
      <div style={{
        display: "flex",
        padding: 2,
        background: "var(--surface-2)",
        borderRadius: 6,
        flexShrink: 0,
      }}>
        <button
          onClick={() => onViewModeChange("2d")}
          title="Top-down 2D view (2)"
          style={viewMode === "2d" ? SEG_BTN_ACTIVE : SEG_BTN}
        >
          2D
        </button>
        <button
          onClick={() => onViewModeChange("3d")}
          title="Perspective 3D view (3)"
          style={viewMode === "3d" ? SEG_BTN_ACTIVE : SEG_BTN}
        >
          3D
        </button>
      </div>

      {/* Zoom to fit */}
      <button onClick={onFit} title="Zoom to fit (F)" className="dio-btn dio-btn-ghost dio-btn-sm">
        ⤢ Fit
      </button>

      <div style={DIVIDER} />

      {/* Undo / Redo */}
      <button
        onClick={canUndo ? onUndo : undefined}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="dio-btn dio-btn-ghost dio-btn-sm"
        style={{ width: 28, padding: 0, fontSize: 14 }}
      >
        ↩
      </button>
      <button
        onClick={canRedo ? onRedo : undefined}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className="dio-btn dio-btn-ghost dio-btn-sm"
        style={{ width: 28, padding: 0, fontSize: 14 }}
      >
        ↪
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Keyboard shortcut hints */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
        <span><kbd className="dio-kbd">2</kbd>/<kbd className="dio-kbd">3</kbd> view</span>
        <span aria-hidden>·</span>
        <span><kbd className="dio-kbd">F</kbd> fit</span>
        <span aria-hidden>·</span>
        <span><kbd className="dio-kbd">⌘D</kbd> duplicate</span>
        <span aria-hidden>·</span>
        <span><kbd className="dio-kbd">⌫</kbd> delete</span>
      </div>
    </div>
  );
}
