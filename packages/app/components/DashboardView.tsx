"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deriveActivity,
  formatEventLabel,
  matchRoomIndex,
  normalizeRoomName,
  ACTIVITY_TIMEOUT_MS,
  type DioramaConfig,
  type DioramaEvent,
  type AgentActivity,
} from "@diorama/engine";
import { useGatewayEvents } from "@/hooks/useGatewayEvents";
import { useMockEventSource } from "@/hooks/useMockEventSource";
import { useIngestEvents } from "@/hooks/useIngestEvents";

const MONO = "'SF Mono', 'Fira Code', monospace";
const AGENT_COLORS = ["#60a0ff", "#ff6090", "#60ffa0", "#ffa060", "#a060ff", "#ff60ff", "#60ffff"];

const ACTIVITY_ICONS: Record<AgentActivity, string> = {
  idle: "·",
  talking: "💬",
  working: "⚙",
  testing: "🔬",
  presenting: "📊",
  listening: "👂",
  sending: "📡",
  reviewing: "🔍",
};

interface AgentTile {
  id: string;
  color: string;
  activity: AgentActivity;
  lastLabel: string;
  lastAt: number | null;
  room: string;
}

interface FeedRow {
  id: string;
  label: string;
  color: string;
  at: number;
}

interface DashboardViewProps {
  config: DioramaConfig;
}

export function DashboardView({ config }: DashboardViewProps) {
  const { eventBus, connect } = useGatewayEvents();

  const sources = config.sources ?? [];
  const hasGateway = Boolean(config.gateway.url) || sources.some((s) => s.type === "openclaw");
  const localSources = sources
    .filter((s) => s.type === "codex" || s.type === "claude-code" || s.type === "ingest")
    .map((s) => s.type);
  const isDemoMode = !hasGateway && localSources.length === 0;

  useEffect(() => {
    if (hasGateway) connect();
  }, [connect, hasGateway]);
  useMockEventSource(eventBus, isDemoMode, config.rooms.map((r) => r.label));
  useIngestEvents(eventBus, localSources.length > 0, localSources);

  const [agents, setAgents] = useState<AgentTile[]>(() =>
    Object.keys(config.agents).map((id, i) => ({
      id,
      color: config.agents[id].color ?? AGENT_COLORS[i % AGENT_COLORS.length],
      activity: "idle",
      lastLabel: "—",
      lastAt: null,
      room: config.agents[id].desk?.replace(/-desk-\d+$/, "") ?? "",
    })),
  );
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [roomCounts, setRoomCounts] = useState<Map<number, number>>(new Map());
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const handleEvent = useCallback(
    (event: DioramaEvent) => {
      if (!event.agent) return;
      const roomIdx = event.room ? matchRoomIndex(config.rooms, event.room) : -1;
      const preset = roomIdx >= 0 ? config.rooms[roomIdx].preset : "workspace";
      const activity = deriveActivity(event.type, preset);
      const customLabel = (event.payload as { label?: string } | null)?.label;
      const label = customLabel
        ? `${event.agent} ${customLabel}`
        : formatEventLabel(event.type, event.agent, event.room, preset);

      setAgents((prev) => {
        // Exact id first (idempotent under batched updates), then fuzzy
        let idx = prev.findIndex((a) => a.id === event.agent);
        if (idx < 0) {
          idx = prev.findIndex(
            (a) => normalizeRoomName(a.id) === normalizeRoomName(event.agent) || normalizeRoomName(a.id).includes(normalizeRoomName(event.agent)),
          );
        }
        const next = [...prev];
        const tile: AgentTile = idx >= 0
          ? { ...next[idx] }
          : {
              id: event.agent,
              color: AGENT_COLORS[prev.length % AGENT_COLORS.length],
              activity: "idle",
              lastLabel: "—",
              lastAt: null,
              room: "",
            };
        tile.activity = activity;
        tile.lastLabel = label;
        tile.lastAt = Date.now();
        if (roomIdx >= 0) tile.room = config.rooms[roomIdx].label;
        if (idx >= 0) next[idx] = tile;
        else next.push(tile);
        return next;
      });

      if (roomIdx >= 0) {
        setRoomCounts((prev) => {
          const next = new Map(prev);
          next.set(roomIdx, (next.get(roomIdx) ?? 0) + 1);
          return next;
        });
      }

      const color = agentsRef.current.find((a) => a.id === event.agent)?.color ?? "#8090c0";
      setFeed((prev) => {
        const next = [{ id: `${Date.now()}-${Math.random()}`, label, color, at: Date.now() }, ...prev];
        return next.length > 40 ? next.slice(0, 40) : next;
      });
    },
    [config],
  );

  useEffect(() => {
    const unsub = eventBus.subscribe(handleEvent);
    return unsub;
  }, [eventBus, handleEvent]);

  // Idle timeout
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setAgents((prev) =>
        prev.some((a) => a.activity !== "idle" && a.lastAt && now - a.lastAt > ACTIVITY_TIMEOUT_MS)
          ? prev.map((a) =>
              a.activity !== "idle" && a.lastAt && now - a.lastAt > ACTIVITY_TIMEOUT_MS
                ? { ...a, activity: "idle" }
                : a,
            )
          : prev,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const ago = (t: number | null) => {
    if (!t) return "";
    const s = Math.floor((Date.now() - t) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  };

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%", background: "#0d1520" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>
        {config.name}
        <span style={{ fontSize: 12, color: "#556", marginLeft: 12, fontFamily: MONO }}>
          {isDemoMode ? "demo" : localSources.filter((s) => s !== "ingest").join(" + ") || "live"}
        </span>
      </h2>

      {/* Agent grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {agents.map((agent, i) => (
          <div
            key={`${agent.id}-${i}`}
            style={{
              background: "#111a28",
              borderRadius: 10,
              padding: 14,
              border: agent.activity !== "idle" ? `1px solid ${agent.color}55` : "1px solid #1a2535",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: agent.color }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {agent.id}
              </span>
              <span style={{ fontSize: 13 }}>{ACTIVITY_ICONS[agent.activity]}</span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: "#8090b0", fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent.lastLabel}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "#556", fontFamily: MONO }}>
              {agent.room || "—"}{agent.lastAt ? ` · ${ago(agent.lastAt)}` : ""}
            </p>
          </div>
        ))}
        {agents.length === 0 && (
          <p style={{ color: "#556", fontSize: 13 }}>No agents yet — events will populate this grid.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Activity stream */}
        <div style={{ background: "#111a28", borderRadius: 10, border: "1px solid #1a2535", padding: 16, minHeight: 220 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 11, color: "#8090c0", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: MONO }}>
            Activity
          </h4>
          {feed.length === 0 && <p style={{ color: "#556", fontSize: 12 }}>Waiting for events…</p>}
          {feed.map((row) => (
            <div key={row.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0", fontSize: 12, fontFamily: MONO }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.color, flexShrink: 0, alignSelf: "center" }} />
              <span style={{ color: "#c0cbe0", flex: 1 }}>{row.label}</span>
              <span style={{ color: "#556", fontSize: 10.5, flexShrink: 0 }}>{ago(row.at)}</span>
            </div>
          ))}
        </div>

        {/* Room occupancy */}
        <div style={{ background: "#111a28", borderRadius: 10, border: "1px solid #1a2535", padding: 16 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 11, color: "#8090c0", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: MONO }}>
            Rooms
          </h4>
          {config.rooms.map((room, i) => (
            <div key={`${room.label}-${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
              <span style={{ color: "#c0cbe0" }}>{room.label}</span>
              <span style={{ color: "#667", fontFamily: MONO, fontSize: 11.5 }}>
                {roomCounts.get(i) ?? 0} events
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
