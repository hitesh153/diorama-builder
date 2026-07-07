"use client";

interface RoomColorPickerProps {
  accent?: string;
  floor?: string;
  wall?: string;
  defaultAccent: string;
  defaultFloor: string;
  onChange: (colors: { accent?: string; floor?: string; wall?: string } | undefined) => void;
}

/**
 * Three color-input fields for per-room accent / floor / wall overrides.
 * "Reset to theme defaults" clears all overrides.
 */
export function RoomColorPicker({
  accent,
  floor,
  wall,
  defaultAccent,
  defaultFloor,
  onChange,
}: RoomColorPickerProps) {
  const hasOverrides = accent !== undefined || floor !== undefined || wall !== undefined;

  const update = (key: "accent" | "floor" | "wall", value: string) => {
    onChange({ accent, floor, wall, [key]: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h5 style={{ margin: 0, fontSize: 11, fontWeight: 550, letterSpacing: "0.02em", color: "var(--ink-2)" }}>Room colors</h5>

      <ColorRow
        label="Accent"
        value={accent ?? defaultAccent}
        isOverride={accent !== undefined}
        onChange={(v) => update("accent", v)}
      />
      <ColorRow
        label="Floor"
        value={floor ?? defaultFloor}
        isOverride={floor !== undefined}
        onChange={(v) => update("floor", v)}
      />
      <ColorRow
        label="Wall"
        value={wall ?? defaultAccent}
        isOverride={wall !== undefined}
        onChange={(v) => update("wall", v)}
      />

      {hasOverrides && (
        <button
          onClick={() => onChange(undefined)}
          className="dio-btn dio-btn-sm"
          style={{ marginTop: 4, width: "100%" }}
        >
          Reset to theme defaults
        </button>
      )}
    </div>
  );
}

function ColorRow({
  label,
  value,
  isOverride,
  onChange,
}: {
  label: string;
  value: string;
  isOverride: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          border: isOverride ? "2px solid var(--accent)" : "2px solid var(--border)",
          borderRadius: 6,
          background: "transparent",
          cursor: "pointer",
        }}
      />
      <span style={{ fontSize: 12, color: isOverride ? "var(--ink)" : "var(--ink-3)", flex: 1 }}>
        {label}
      </span>
      {isOverride && (
        <span style={{ fontSize: 11, color: "var(--accent)" }}>custom</span>
      )}
    </label>
  );
}
