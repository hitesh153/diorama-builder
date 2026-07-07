"use client";

import type { RoomConfig } from "@diorama/engine";

interface AgentAssignPanelProps {
  agents: string[];
  rooms: RoomConfig[];
  assignments: Record<string, string>;
  onAssign: (agent: string, roomLabel: string) => void;
}

export function AgentAssignPanel({ agents, rooms, assignments, onAssign }: AgentAssignPanelProps) {
  if (agents.length === 0) {
    return (
      <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
        <p>No agents discovered yet.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Agents will appear here after connecting to a gateway or using demo data.
        </p>
      </div>
    );
  }

  const roomLabels = rooms.map((r) => r.label);

  return (
    <div>
      <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 550, letterSpacing: "0.02em", color: "var(--ink-2)" }}>
        Agent assignment ({agents.length} agents)
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {agents.map((agent) => (
          <div
            key={agent}
            className="dio-card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "8px 12px",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent}
            </span>
            <select
              value={assignments[agent] ?? ""}
              onChange={(e) => onAssign(agent, e.target.value)}
              className="dio-select"
              style={{ width: 130, flexShrink: 0, height: 26, fontSize: 12 }}
            >
              <option value="">Auto (General)</option>
              {roomLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12 }}>
        Unassigned agents will be placed in a General workspace room.
      </p>
    </div>
  );
}
