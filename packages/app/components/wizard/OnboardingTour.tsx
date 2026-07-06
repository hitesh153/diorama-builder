"use client";

import { useEffect, useState } from "react";

const MONO = "'SF Mono', 'Fira Code', monospace";
const STORAGE_KEY = "diorama.tour.v1";

interface TourStep {
  title: string;
  body: string;
  /** Where to park the card, roughly pointing at the relevant UI */
  position: React.CSSProperties;
}

const STEPS: TourStep[] = [
  {
    title: "Build your world",
    body: "Click a room preset to start placing it — a ghost follows your cursor; click again to drop it. Double-click a preset to auto-place.",
    position: { right: 340, top: 160 },
  },
  {
    title: "CAD controls",
    body: "2/3 toggles top-down and 3D views · F fits the view · arrows nudge · ⌘D duplicates · shift-click multi-selects. The Inspector gives exact numbers.",
    position: { left: 24, top: 60 },
  },
  {
    title: "Ask the copilot",
    body: "The ✦ AI tab connects your own LLM (Claude, OpenAI-compatible, Ollama, Codex login) and builds rooms, themes, and layouts from plain English.",
    position: { right: 340, top: 120 },
  },
  {
    title: "Watch it live",
    body: "After launch, your connected agents appear in the world — walking between rooms as events arrive from Codex, Claude Code, OpenClaw, or your own HTTP pushes.",
    position: { right: 340, bottom: 120 },
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setStep(0);
    } catch {
      // storage unavailable — skip the tour
    }
  }, []);

  if (step === null) return null;

  const done = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
    setStep(null);
  };

  const current = STEPS[step];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...current.position,
          width: 300,
          background: "#131c2e",
          border: "1px solid #2a3a5f",
          borderRadius: 12,
          padding: 16,
          pointerEvents: "auto",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 10, color: "#667", fontFamily: MONO }}>
          {step + 1} / {STEPS.length}
        </p>
        <h4 style={{ margin: "0 0 6px", fontSize: 14, color: "#e0e0e0" }}>{current.title}</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#9aa8c5", lineHeight: 1.5 }}>
          {current.body}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={done}
            style={{ background: "transparent", border: "none", color: "#556", fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: MONO }}
          >
            Skip
          </button>
          <button
            onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : done())}
            style={{
              background: "#8090c0",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {step < STEPS.length - 1 ? "Next" : "Start building"}
          </button>
        </div>
      </div>
    </div>
  );
}
