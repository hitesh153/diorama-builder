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

function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 650,
        background: on ? "var(--accent)" : "transparent",
        border: on ? "1px solid transparent" : "1px solid var(--border-strong)",
        color: "var(--accent-ink)",
        transition: "background var(--t-fast) var(--ease)",
      }}
    >
      {on ? "✓" : ""}
    </span>
  );
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
    <div style={{ maxWidth: 560, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 650, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Configure agents
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 24px" }}>
        Set each agent&apos;s seat, room access, and energy level.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
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
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            No agents discovered. Go back and connect to a gateway or use demo mode.
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onBack} className="dio-btn dio-btn-ghost">
          Back
        </button>
        <button onClick={() => onComplete(behaviors)} className="dio-btn dio-btn-primary">
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
    <div className="dio-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 650, color: "var(--ink)" }}>{agent}</span>
      </div>

      {/* Seat Assignment */}
      <div style={{ marginBottom: 14 }}>
        <label className="dio-label">Seat assignment</label>
        <select
          value={behavior.seat}
          onChange={(e) => onUpdate({ seat: e.target.value })}
          className="dio-select dio-mono"
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
        <label className="dio-label">
          Room access
          <span style={{ color: "var(--ink-3)", fontWeight: 450, marginLeft: 8 }}>
            (none checked = all rooms)
          </span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
          {roomLabels.map((room) => {
            const on = behavior.allowedRooms.includes(room);
            return (
              <label
                key={room}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: on ? "var(--ink)" : "var(--ink-2)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleRoom(room)}
                  style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                />
                <Checkbox on={on} />
                {room}
              </label>
            );
          })}
        </div>
      </div>

      {/* Energy Slider */}
      <div>
        <label className="dio-label">Energy</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 32 }}>Calm</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={behavior.energy}
            onChange={(e) => onUpdate({ energy: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 48 }}>Restless</span>
          <span className="dio-mono" style={{ fontSize: 11, color: "var(--accent)", minWidth: 28, textAlign: "right" }}>
            {behavior.energy.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
