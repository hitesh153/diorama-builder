"use client";

import { useState, useMemo } from "react";
import { buildSeatOptions, type RoomConfig } from "@diorama/engine";

export interface AgentBehavior {
  seat: string;
  allowedRooms: string[];
  energy: number;
}

interface AgentBehaviorStepProps {
  agents: string[];
  rooms: RoomConfig[];
  theme: string;
  initialBehaviors: Record<string, AgentBehavior>;
  onComplete: (behaviors: Record<string, AgentBehavior>) => void;
  onBack: () => void;
}

function defaultBehavior(): AgentBehavior {
  return { seat: "", allowedRooms: [], energy: 0.5 };
}

export function AgentBehaviorStep({
  agents,
  rooms,
  theme,
  initialBehaviors,
  onComplete,
  onBack,
}: AgentBehaviorStepProps) {
  const [behaviors, setBehaviors] = useState<Record<string, AgentBehavior>>(() => {
    const init: Record<string, AgentBehavior> = {};
    for (const agent of agents) {
      init[agent] = initialBehaviors[agent] ?? defaultBehavior();
    }
    return init;
  });

  const seatOptions = useMemo(() => buildSeatOptions(rooms, theme), [rooms, theme]);
  const roomLabels = useMemo(() => rooms.map((r) => r.label), [rooms]);

  const updateBehavior = (agent: string, patch: Partial<AgentBehavior>) => {
    setBehaviors((prev) => ({
      ...prev,
      [agent]: { ...prev[agent], ...patch },
    }));
  };

  const toggleRoom = (agent: string, roomLabel: string) => {
    setBehaviors((prev) => {
      const current = prev[agent].allowedRooms;
      const next = current.includes(roomLabel)
        ? current.filter((r) => r !== roomLabel)
        : [...current, roomLabel];
      return { ...prev, [agent]: { ...prev[agent], allowedRooms: next } };
    });
  };

  return (
    <div style={{ maxWidth: 700, width: "100%", margin: "0 auto", padding: "0 24px" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Configure Agents</h2>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        Set each agent's seat, room access, and energy level.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32, maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
        {agents.map((agent) => (
          <AgentCard
            key={agent}
            agent={agent}
            behavior={behaviors[agent]}
            seatOptions={seatOptions}
            roomLabels={roomLabels}
            onUpdate={(patch) => updateBehavior(agent, patch)}
            onToggleRoom={(room) => toggleRoom(agent, room)}
          />
        ))}

        {agents.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
            No agents discovered. Go back and connect to a gateway or use demo mode.
          </div>
        )}
      </div>

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
          onClick={() => onComplete(behaviors)}
          style={{
            flex: 2,
            padding: "12px 0",
            background: "#8090c0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Per-agent card ──

interface AgentCardProps {
  agent: string;
  behavior: AgentBehavior;
  seatOptions: Array<{ room: string; label: string; value: string }>;
  roomLabels: string[];
  onUpdate: (patch: Partial<AgentBehavior>) => void;
  onToggleRoom: (room: string) => void;
}

function AgentCard({ agent, behavior, seatOptions, roomLabels, onUpdate, onToggleRoom }: AgentCardProps) {
  return (
    <div
      style={{
        background: "#1a2535",
        borderRadius: 8,
        padding: 20,
        border: "1px solid #2a3a50",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#e0e0e0" }}>
        {agent}
      </div>

      {/* Seat Assignment */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 4 }}>
          Seat Assignment
        </label>
        <select
          value={behavior.seat}
          onChange={(e) => onUpdate({ seat: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "#0d1520",
            color: "#e0e0e0",
            border: "1px solid #2a3a50",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}
        >
          <option value="">No assigned seat</option>
          {seatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Room Access */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>
          Room Access
          <span style={{ color: "#666", fontWeight: 400, marginLeft: 8 }}>
            (none checked = all rooms)
          </span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {roomLabels.map((room) => (
            <label
              key={room}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "#ccc",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={behavior.allowedRooms.includes(room)}
                onChange={() => onToggleRoom(room)}
                style={{ accentColor: "#8090c0" }}
              />
              {room}
            </label>
          ))}
        </div>
      </div>

      {/* Energy Slider */}
      <div>
        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 4 }}>
          Energy
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#666", minWidth: 32 }}>Calm</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={behavior.energy}
            onChange={(e) => onUpdate({ energy: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: "#8090c0" }}
          />
          <span style={{ fontSize: 11, color: "#666", minWidth: 48 }}>Restless</span>
          <span style={{ fontSize: 11, color: "#8090c0", minWidth: 28, textAlign: "right", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
            {behavior.energy.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
