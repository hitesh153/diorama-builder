"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomConfig, SourceConfig } from "@diorama/engine";
import type { AgentBehavior } from "./AgentBehaviorStep";

interface LaunchStepProps {
  gatewayUrl: string;
  gatewayToken: string;
  sources: SourceConfig[];
  theme: string;
  rooms: RoomConfig[];
  agentAssignments: Record<string, string>;
  agentBehaviors: Record<string, AgentBehavior>;
  onBack: () => void;
}

export function LaunchStep({ gatewayUrl, gatewayToken, sources, theme, rooms, agentAssignments, agentBehaviors, onBack }: LaunchStepProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setSaving(true);
    setError(null);

    const config = {
      name: "My Diorama Office",
      gateway: { url: gatewayUrl, token: gatewayToken },
      sources,
      view: "3d-office",
      theme,
      rooms,
      agents: Object.fromEntries(
        Object.entries(agentAssignments).map(([agent, roomLabel]) => {
          const behavior = agentBehaviors[agent];
          return [
            agent,
            {
              desk: `${roomLabel.toLowerCase().replace(/\s+/g, "-")}-desk-1`,
              ...(behavior ? {
                seat: behavior.seat,
                allowedRooms: behavior.allowedRooms,
                energy: behavior.energy,
              } : {}),
            },
          ];
        }),
      ),
    };

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save config");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  const summaryRows: Array<{ key: string; value: React.ReactNode }> = [
    { key: "Theme", value: <span className="dio-mono">{theme}</span> },
    {
      key: "Rooms",
      value: (
        <>
          <span className="dio-mono">{rooms.length}</span>
          {rooms.length > 0 && (
            <span style={{ color: "var(--ink-2)" }}> · {rooms.map((r) => r.label).join(", ")}</span>
          )}
        </>
      ),
    },
    {
      key: "Agents",
      value: (
        <>
          <span className="dio-mono">{Object.keys(agentAssignments).length}</span>
          <span style={{ color: "var(--ink-2)" }}> assigned</span>
        </>
      ),
    },
    {
      key: "Sources",
      value: (
        <span className="dio-mono">
          {sources.length > 0
            ? sources.map((s) => s.type).join(", ")
            : gatewayUrl || "(demo mode)"}
        </span>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 560, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 650, margin: "0 0 24px", letterSpacing: "-0.01em" }}>
        Ready to launch
      </h1>

      <div className="dio-card" style={{ marginBottom: 24 }}>
        {summaryRows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              padding: "12px 16px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--ink-2)", flexShrink: 0 }}>{row.key}</span>
            <span style={{ fontSize: 13, textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ color: "var(--err)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onBack} className="dio-btn dio-btn-ghost">
          Back
        </button>
        <button onClick={handleLaunch} disabled={saving} className="dio-btn dio-btn-primary">
          {saving ? "Saving…" : "Save & Launch"}
        </button>
      </div>
    </div>
  );
}
