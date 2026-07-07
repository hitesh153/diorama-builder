"use client";

import { useEffect, useState } from "react";

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
        className="dio-card"
        style={{
          position: "absolute",
          ...current.position,
          width: 300,
          padding: 16,
          pointerEvents: "auto",
          boxShadow: "0 8px 32px rgb(0 0 0 / 0.45)",
        }}
      >
        <p className="dio-mono" style={{ margin: "0 0 4px", fontSize: 10, color: "var(--ink-3)" }}>
          {step + 1} / {STEPS.length}
        </p>
        <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>{current.title}</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
          {current.body}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={done} className="dio-btn dio-btn-ghost dio-btn-sm">
            Skip
          </button>
          <button
            onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : done())}
            className="dio-btn dio-btn-primary dio-btn-sm"
          >
            {step < STEPS.length - 1 ? "Next" : "Start building"}
          </button>
        </div>
      </div>
    </div>
  );
}
