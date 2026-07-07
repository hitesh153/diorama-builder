"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Home for first-time users (no saved office yet): explains the product
 * in one screen and routes into the wizard, or spins up a demo office
 * with one click.
 */

const FEATURES: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: "▤",
    title: "Design an office",
    body: "Lay out rooms in a 2D/3D editor, or describe it and let the AI copilot build it.",
  },
  {
    glyph: "⇄",
    title: "Connect your agents",
    body: "Codex CLI, Claude Code, OpenClaw, or anything that can send one HTTP request.",
  },
  {
    glyph: "◉",
    title: "Watch them work",
    body: "Agents sit, walk between rooms, and show what they're doing as events arrive.",
  },
];

const DEMO_CONFIG = {
  name: "Demo Office",
  gateway: { url: "", token: "" },
  sources: [],
  view: "3d-office",
  theme: "neon-dark",
  rooms: [
    { preset: "meeting", position: [0, 0], size: [4, 3], label: "Meeting Room" },
    { preset: "workspace", position: [4, 0], size: [5, 4], label: "Workspace" },
    { preset: "lab", position: [0, 3], size: [4, 4], label: "Lab" },
    { preset: "social", position: [4, 4], size: [3, 3], label: "Lounge" },
  ],
  agents: {
    "aegis-prime": { desk: "workspace-desk-1", allowedRooms: [], energy: 0.5 },
    herald: { desk: "meeting-room-desk-1", allowedRooms: [], energy: 0.7 },
    sentinel: { desk: "lab-desk-1", allowedRooms: [], energy: 0.4 },
    scribe: { desk: "workspace-desk-2", allowedRooms: [], energy: 0.5 },
    contrarian: { desk: "lounge-desk-1", allowedRooms: [], energy: 0.8 },
  },
};

export function Welcome() {
  const router = useRouter();
  const [detected, setDetected] = useState<string[]>([]);
  const [startingDemo, setStartingDemo] = useState(false);

  useEffect(() => {
    fetch("/api/sources/detect")
      .then((r) => r.json())
      .then((data: { sources: Array<{ type: string; label: string; available: boolean }> }) => {
        setDetected(data.sources.filter((s) => s.available && s.type !== "ingest").map((s) => s.label));
      })
      .catch(() => {});
  }, []);

  const startDemo = async () => {
    setStartingDemo(true);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_CONFIG),
      });
      router.refresh();
      window.location.reload();
    } catch {
      setStartingDemo(false);
    }
  };

  return (
    <div className="dio-fade-in" style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%", padding: "72px 24px 48px" }}>
        <div aria-hidden style={{ color: "var(--accent)", fontSize: 28, lineHeight: 1, marginBottom: 16 }}>◆</div>
        <h1 style={{ fontSize: 24, fontWeight: 650, margin: "0 0 8px", letterSpacing: "-0.015em" }}>
          A 3D world for your AI agents
        </h1>
        <p style={{ color: "var(--ink-2)", margin: "0 0 32px", maxWidth: "42ch" }}>
          Diorama turns your invisible agents into little figures in an office you design:
          live, on a screen you can glance at.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 32 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 14, padding: "10px 0", alignItems: "flex-start" }}>
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                  fontSize: 14,
                }}
              >
                {f.glyph}
              </span>
              <span>
                <span style={{ display: "block", fontWeight: 550 }}>{f.title}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-2)", marginTop: 1 }}>
                  {f.body}
                </span>
              </span>
            </div>
          ))}
        </div>

        {detected.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--ok)", margin: "0 0 20px" }}>
            ✓ Found on this machine: {detected.join(" · ")}
          </p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/wizard")} className="dio-btn dio-btn-primary" style={{ flex: 1, height: 38 }}>
            Design your office
          </button>
          <button onClick={startDemo} disabled={startingDemo} className="dio-btn" style={{ height: 38 }}>
            {startingDemo ? "Starting…" : "Try the demo"}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 12 }}>
          The demo opens a ready-made office with sample agents; you can redesign it any time.
        </p>
      </div>
    </div>
  );
}
