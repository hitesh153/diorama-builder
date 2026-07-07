"use client";

import { useState } from "react";

// Theme preview colors are theme data (what the 3D world will look like),
// not UI chrome — intentionally not design tokens.
const THEMES = [
  { type: "neon-dark", label: "Sci-Fi", bg: "#0e1520", accent: "#8090c0", desc: "Dark with neon glows" },
  { type: "warm-office", label: "Modern Office", bg: "#2a2420", accent: "#d4a574", desc: "Warm beige and wood tones" },
  { type: "cyberpunk", label: "Cyberpunk", bg: "#0a0012", accent: "#ff2d95", desc: "Dark with magenta neon" },
  { type: "minimal", label: "Minimal", bg: "#f5f5f5", accent: "#666666", desc: "Clean and light" },
];

interface ThemeStepProps {
  onNext: (theme: string) => void;
  onBack?: () => void;
  compact?: boolean;
}

function ThemeSwatch({ bg, accent, selected }: { bg: string; accent: string; selected: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        border: "1px solid var(--border)",
        boxShadow: selected ? "0 0 0 2px var(--accent)" : "none",
        transition: "box-shadow var(--t-fast) var(--ease)",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: accent }} />
    </span>
  );
}

export function ThemeStep({ onNext, onBack, compact }: ThemeStepProps) {
  const [selected, setSelected] = useState("neon-dark");

  if (compact) {
    return (
      <div>
        <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 550, letterSpacing: "0.02em", color: "var(--ink-2)" }}>Theme</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {THEMES.map((theme) => (
            <button
              key={theme.type}
              onClick={() => {
                setSelected(theme.type);
                onNext(theme.type);
              }}
              className="dio-card dio-card-interactive"
              data-selected={selected === theme.type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                textAlign: "left",
              }}
            >
              <ThemeSwatch bg={theme.bg} accent={theme.accent} selected={selected === theme.type} />
              <span style={{ fontSize: 13, fontWeight: 550, color: "var(--ink)" }}>
                {theme.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 650, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Choose a theme
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 24px" }}>
        This sets the visual style of your 3D workspace.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {THEMES.map((theme) => (
          <button
            key={theme.type}
            onClick={() => setSelected(theme.type)}
            className="dio-card dio-card-interactive"
            data-selected={selected === theme.type}
            style={{ padding: 16, textAlign: "left" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ThemeSwatch bg={theme.bg} accent={theme.accent} selected={selected === theme.type} />
              <span style={{ fontWeight: 550, color: "var(--ink)" }}>{theme.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-2)" }}>{theme.desc}</p>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
        {onBack && (
          <button onClick={onBack} className="dio-btn dio-btn-ghost">
            Back
          </button>
        )}
        <button onClick={() => onNext(selected)} className="dio-btn dio-btn-primary">
          Next
        </button>
      </div>
    </div>
  );
}
