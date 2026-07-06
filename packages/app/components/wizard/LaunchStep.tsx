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

  return (
    <div style={{ maxWidth: 500, width: "100%" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Ready to Launch</h2>

      <div style={{ background: "#1a2535", borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "#999" }}>Theme</span>
          <p style={{ fontSize: 14, margin: "4px 0 0" }}>{theme}</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "#999" }}>Rooms</span>
          <p style={{ fontSize: 14, margin: "4px 0 0" }}>
            {rooms.length} room{rooms.length !== 1 ? "s" : ""}
            {rooms.length > 0 && ` (${rooms.map((r) => r.label).join(", ")})`}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "#999" }}>Agents</span>
          <p style={{ fontSize: 14, margin: "4px 0 0" }}>
            {Object.keys(agentAssignments).length} assigned
          </p>
        </div>

        <div>
          <span style={{ fontSize: 12, color: "#999" }}>Sources</span>
          <p style={{ fontSize: 14, margin: "4px 0 0" }}>
            {sources.length > 0
              ? sources.map((s) => s.type).join(", ")
              : gatewayUrl || "(demo mode)"}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: "12px 0",
            background: "transparent",
            color: "#888",
            border: "1px solid #333",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          onClick={handleLaunch}
          disabled={saving}
          style={{
            flex: 2,
            padding: "12px 0",
            background: "#8090c0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save & Launch"}
        </button>
      </div>
    </div>
  );
}
