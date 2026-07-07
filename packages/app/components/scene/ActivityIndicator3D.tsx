"use client";

import { useState, useEffect } from "react";
import { Html } from "@react-three/drei";
import type { AgentActivity } from "@diorama/engine";

const ACTIVITY_ICONS: Record<AgentActivity, string> = {
  idle: "",
  talking: "\ud83d\udcac",
  working: "\u2328\ufe0f",
  testing: "\ud83d\udd2c",
  presenting: "\ud83d\udcca",
  listening: "\ud83d\udc42",
  sending: "\ud83d\udce1",
  reviewing: "\ud83d\udd0d",
};

const PULSE_ACTIVITIES = new Set<AgentActivity>(["testing", "sending"]);
const DOTS_ACTIVITIES = new Set<AgentActivity>(["talking", "working"]);

interface ActivityIndicator3DProps {
  activity: AgentActivity;
  agentLabel: string;
  color: string;
  /** The agent is blocked waiting for the user (permission prompt, question). */
  attention?: boolean;
  /** Short reason shown in the attention pill, e.g. "waiting for your approval". */
  attentionLabel?: string;
}

export function ActivityIndicator3D({
  activity,
  agentLabel,
  color,
  attention = false,
  attentionLabel,
}: ActivityIndicator3DProps) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (!DOTS_ACTIVITIES.has(activity)) return;
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(id);
  }, [activity]);

  const icon = ACTIVITY_ICONS[activity];
  const isActive = activity !== "idle";
  const showDots = DOTS_ACTIVITIES.has(activity);
  const showPulse = PULSE_ACTIVITIES.has(activity);

  return (
    <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {/* Attention pill — the agent is blocked on the user. Sits ABOVE the
            normal activity icon; slow opacity pulse (dio-pulse keyframes from
            globals.css), unmissable but not strobing. */}
        {attention && (
          <div
            style={{
              background: "rgba(13,21,32,0.92)",
              border: "1px solid var(--warn)",
              color: "var(--warn)",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.2,
              display: "flex",
              alignItems: "center",
              gap: 5,
              animation: "dio-pulse 1.2s ease-in-out infinite",
            }}
          >
            <span aria-hidden>✋</span>
            <span>{attentionLabel ?? "needs you"}</span>
          </div>
        )}

        {/* Activity indicator */}
        {isActive && (
          <div
            style={{
              background: "rgba(13,21,32,0.85)",
              borderRadius: 8,
              padding: "3px 8px",
              fontSize: 13,
              lineHeight: 1.2,
              display: "flex",
              alignItems: "center",
              gap: 4,
              animation: showPulse
                ? "actPulse 1s ease-in-out infinite"
                : undefined,
            }}
          >
            <span>{icon}</span>
            {showDots && (
              <span
                style={{
                  color: "#8090c0",
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 12,
                  width: 20,
                  display: "inline-block",
                }}
              >
                {dots}
              </span>
            )}
          </div>
        )}

        {/* Agent name label */}
        <div
          style={{
            color: attention ? "var(--warn)" : isActive ? color : "rgba(128,144,192,0.5)",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 10,
            fontWeight: 600,
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            letterSpacing: "0.02em",
          }}
        >
          {agentLabel}
        </div>
      </div>

      {/* Inline keyframes for pulse animation */}
      {showPulse && (
        <style>{`
          @keyframes actPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }
        `}</style>
      )}
    </Html>
  );
}
