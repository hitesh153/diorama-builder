"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { DioramaScene } from "./scene/DioramaScene";
import { Room3D } from "./scene/Room3D";
import { AgentFigure3D } from "./scene/AgentFigure3D";
import { useGatewayEvents } from "@/hooks/useGatewayEvents";
import { useMockEventSource } from "@/hooks/useMockEventSource";
import { useIngestEvents } from "@/hooks/useIngestEvents";
import {
  createAgentState,
  toWorld,
  deriveActivity,
  formatEventLabel,
  resolveRoomFurniture,
  isSeatingItem,
  resolveSeatRef,
  matchRoomIndex,
  normalizeRoomName,
  ACTIVITY_TIMEOUT_MS,
  type DioramaConfig,
  type AgentState,
  type ActivityRecord,
  type DioramaEvent,
  type FurnitureItem,
} from "@diorama/engine";
import { ActivityFeed, type FeedEntry } from "./ActivityFeed";

const THEME_COLORS: Record<string, { accent: string; floor: string }> = {
  "neon-dark": { accent: "#8090c0", floor: "#1a1a2e" },
  "warm-office": { accent: "#d4a574", floor: "#2a2420" },
  cyberpunk: { accent: "#ff2d95", floor: "#1a0028" },
  minimal: { accent: "#666666", floor: "#e0e0e0" },
};

const AGENT_COLORS = ["#60a0ff", "#ff6090", "#60ffa0", "#ffa060", "#a060ff", "#ff60ff", "#60ffff"];
const GRID_UNIT = 200;
/** World units per grid cell (GRID_UNIT canvas units × 0.018 world scale). */
const GRID_WORLD = 3.6;
/** Golden angle — spreads standing agents evenly around the room center. */
const GOLDEN_ANGLE = 2.399963;

/**
 * Get the world-space center of a room. Room3D uses generateFloor which calls
 * toWorld(cx, cy) where cx = room.position[0]*GRID_UNIT + w/2, cy = room.position[1]*GRID_UNIT + h/2.
 * We replicate that logic here.
 */
function getRoomWorldCenter(room: { position: [number, number]; size: [number, number] }): [number, number, number] {
  const cx = (room.position[0] + room.size[0] / 2) * GRID_UNIT;
  const cy = (room.position[1] + room.size[1] / 2) * GRID_UNIT;
  return toWorld(cx, cy);
}

/**
 * Get a seat position in world coordinates.
 * Furniture positions in presets are relative to room center.
 */
function getSeatWorldPos(
  roomCenter: [number, number, number],
  furniture: FurnitureItem,
): [number, number, number] {
  return [
    roomCenter[0] + furniture.position[0],
    0,
    roomCenter[2] + furniture.position[2],
  ];
}

interface LiveViewProps {
  config: DioramaConfig;
  onSelectRoom?: (roomLabel: string | null) => void;
  selectedRoom?: string | null;
}

export function LiveView({ config, onSelectRoom, selectedRoom }: LiveViewProps) {
  const { eventBus, status, connect } = useGatewayEvents();
  const colors = THEME_COLORS[config.theme] ?? THEME_COLORS["neon-dark"];

  // Track room glow intensity (event pulse)
  const [roomGlows, setRoomGlows] = useState<Record<number, number>>({});
  const glowTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const sources = config.sources ?? [];
  const hasGateway = Boolean(config.gateway.url) || sources.some((s) => s.type === "openclaw");
  const localSources = sources
    .filter((s) => s.type === "codex" || s.type === "claude-code" || s.type === "ingest")
    .map((s) => s.type);
  // Demo mode only when NOTHING is connected
  const isDemoMode = !hasGateway && localSources.length === 0;

  useEffect(() => {
    if (hasGateway) connect();
  }, [connect, hasGateway]);

  useMockEventSource(eventBus, isDemoMode, config.rooms.map((r) => r.label));
  // Local connectors + pushed events arrive via the server's SSE stream.
  // "ingest" costs nothing to include; codex/claude-code start their tailers.
  useIngestEvents(eventBus, localSources.length > 0, localSources);

  // Rooms centroid + bounding radius for camera framing
  const { roomsCenter, fitRadius } = useMemo<{
    roomsCenter: [number, number, number];
    fitRadius: number;
  }>(() => {
    if (config.rooms.length === 0) return { roomsCenter: [0, 0, 0], fitRadius: 12 };
    let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (const r of config.rooms) {
      minGx = Math.min(minGx, r.position[0]);
      minGy = Math.min(minGy, r.position[1]);
      maxGx = Math.max(maxGx, r.position[0] + r.size[0]);
      maxGy = Math.max(maxGy, r.position[1] + r.size[1]);
    }
    const cx = ((minGx + maxGx) / 2) * GRID_UNIT;
    const cy = ((minGy + maxGy) / 2) * GRID_UNIT;
    const [wx, , wz] = toWorld(cx, cy);
    // Half-diagonal of the world bounding box, in world units
    const halfW = ((maxGx - minGx) / 2) * GRID_WORLD;
    const halfH = ((maxGy - minGy) / 2) * GRID_WORLD;
    const radius = Math.max(Math.hypot(halfW, halfH), 6);
    return { roomsCenter: [wx, 0, wz], fitRadius: radius };
  }, [config.rooms]);

  // Agent states
  const [agentSnapshot, setAgentSnapshot] = useState<Array<{
    id: string; state: AgentState; color: string; energy: number;
  }>>([]);

  // Activity tracking
  const agentActivitiesRef = useRef<Map<string, ActivityRecord>>(new Map());
  const [activitySnapshot, setActivitySnapshot] = useState<Map<string, ActivityRecord>>(new Map());
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);

  // Initialize agents — explicit seats first, then auto-seat, then stand
  useEffect(() => {
    const agentEntries = Object.entries(config.agents);

    // Seat pool per room over *resolved* furniture (explicit or preset),
    // keyed by furniture index so explicit refs and auto-assignment never
    // double-book the same chair.
    const seatPool = new Map<number, Array<{ furnitureIndex: number; pos: [number, number, number]; rotation: number }>>();
    config.rooms.forEach((room, roomIdx) => {
      const furniture = resolveRoomFurniture(room, config.theme);
      const roomCenter = getRoomWorldCenter(room);
      const seats: Array<{ furnitureIndex: number; pos: [number, number, number]; rotation: number }> = [];
      furniture.forEach((item, furnitureIndex) => {
        if (isSeatingItem(item)) {
          seats.push({
            furnitureIndex,
            pos: getSeatWorldPos(roomCenter, item),
            rotation: item.rotation ? item.rotation[1] : 0,
          });
        }
      });
      seatPool.set(roomIdx, seats);
    });

    const taken = new Set<string>(); // "roomIdx::furnitureIndex"
    const standingCount = new Map<number, number>();

    type Placement = { x: number; z: number; seatRotation: number | null };

    const takeSeat = (roomIdx: number, furnitureIndex: number): Placement | null => {
      const key = `${roomIdx}::${furnitureIndex}`;
      if (taken.has(key)) return null;
      const seat = seatPool.get(roomIdx)?.find((s) => s.furnitureIndex === furnitureIndex);
      if (!seat) return null;
      taken.add(key);
      return { x: seat.pos[0], z: seat.pos[2], seatRotation: seat.rotation };
    };

    const takeNextFreeSeat = (roomIdx: number): Placement | null => {
      for (const seat of seatPool.get(roomIdx) ?? []) {
        const placed = takeSeat(roomIdx, seat.furnitureIndex);
        if (placed) return placed;
      }
      return null;
    };

    const standInRoom = (roomIdx: number): Placement => {
      const room = config.rooms[roomIdx];
      const center = getRoomWorldCenter(room);
      const n = standingCount.get(roomIdx) ?? 0;
      standingCount.set(roomIdx, n + 1);
      // Golden-angle ring inside the room — no two agents share a spot.
      const maxRadius = (Math.min(room.size[0], room.size[1]) * GRID_WORLD) / 2 - 0.9;
      const radius = Math.min(0.9 + 0.35 * Math.floor(n / 6), Math.max(maxRadius, 0.6));
      const angle = n * GOLDEN_ANGLE;
      return {
        x: center[0] + Math.cos(angle) * radius,
        z: center[2] + Math.sin(angle) * radius,
        seatRotation: null,
      };
    };

    // Pass 1: agents with an explicit seat reference claim their chair.
    const placements = new Map<string, Placement>();
    for (const [agentId, assignment] of agentEntries) {
      if (!assignment.seat) continue;
      const resolved = resolveSeatRef(config.rooms, config.theme, assignment.seat);
      if (!resolved) continue;
      const placed = takeSeat(resolved.roomIndex, resolved.furnitureIndex);
      if (placed) placements.set(agentId, placed);
    }

    // Pass 2: everyone else — room from desk assignment (fuzzy), else
    // round-robin across all rooms; free chair first, standing ring after.
    let rr = 0;
    for (const [agentId, assignment] of agentEntries) {
      if (placements.has(agentId)) continue;
      const deskPrefix = assignment.desk.replace(/-desk-\d+$/, "");
      let roomIdx = matchRoomIndex(config.rooms, deskPrefix);
      if (roomIdx < 0) roomIdx = rr++ % config.rooms.length;

      const placed = takeNextFreeSeat(roomIdx) ?? standInRoom(roomIdx);
      placements.set(agentId, placed);
    }

    const agents = agentEntries.map(([agentId, assignment], i) => {
      const placed = placements.get(agentId)!;
      const state = createAgentState({
        x: placed.x,
        z: placed.z,
        seatRotation: placed.seatRotation ?? 0,
      });
      if (placed.seatRotation !== null) {
        state.mode = "seated" as const;
        state.seatRotation = placed.seatRotation;
      }
      return {
        id: agentId,
        state,
        color: assignment.color ?? AGENT_COLORS[i % AGENT_COLORS.length],
        energy: assignment.energy ?? 0.5,
      };
    });

    setAgentSnapshot(agents);
  }, [config]);

  // Handle events — activity + glow only, no movement
  const handleEvent = useCallback((event: DioramaEvent) => {
    // Glow the matching room; unknown rooms glow nothing (feed still records)
    if (event.room) {
      const roomIdx = matchRoomIndex(config.rooms, event.room);
      if (roomIdx >= 0) {
        setRoomGlows((prev) => ({ ...prev, [roomIdx]: 1 }));
        const existing = glowTimers.current.get(roomIdx);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setRoomGlows((prev) => ({ ...prev, [roomIdx]: 0 }));
        }, 1200);
        glowTimers.current.set(roomIdx, timer);
      }
    }

    if (!event.agent) return;

    // Find the agent — or materialize an unknown one (live sources can
    // introduce agents that aren't in the saved config)
    let agentId = agentSnapshot.find(
      (a) => normalizeRoomName(a.id) === normalizeRoomName(event.agent) || normalizeRoomName(a.id).includes(normalizeRoomName(event.agent)),
    )?.id;
    if (!agentId) {
      const roomIdx = Math.max(matchRoomIndex(config.rooms, event.room ?? ""), 0);
      const room = config.rooms[roomIdx];
      if (!room) return;
      const center = getRoomWorldCenter(room);
      const n = agentSnapshot.length;
      const state = createAgentState({
        x: center[0] + Math.cos(n * GOLDEN_ANGLE) * 1.1,
        z: center[2] + Math.sin(n * GOLDEN_ANGLE) * 1.1,
        seatRotation: 0,
      });
      agentId = event.agent;
      setAgentSnapshot((prev) => [
        ...prev,
        { id: event.agent, state, color: AGENT_COLORS[prev.length % AGENT_COLORS.length], energy: 0.5 },
      ]);
    }
    // Roomless events (local connectors don't know rooms) fall back to the
    // agent's assigned room so activity + feed still work.
    let roomIdx = event.room ? matchRoomIndex(config.rooms, event.room) : -1;
    if (roomIdx < 0) {
      const desk = config.agents[agentId]?.desk?.replace(/-desk-\d+$/, "") ?? "";
      roomIdx = matchRoomIndex(config.rooms, desk);
    }
    const targetRoom = roomIdx >= 0 ? config.rooms[roomIdx] : config.rooms[0];
    const preset = targetRoom?.preset ?? "workspace";

    // Set activity
    const activity = deriveActivity(event.type, preset);
    const customLabel = (event.payload as { label?: string } | null)?.label;
    const label = customLabel
      ? `${event.agent} ${customLabel}`
      : formatEventLabel(event.type, event.agent, event.room || (targetRoom?.label ?? ""), preset);

    agentActivitiesRef.current.set(agentId, {
      activity,
      startedAt: Date.now(),
      eventType: event.type,
      eventLabel: label,
      roomPreset: preset,
    });
    setActivitySnapshot(new Map(agentActivitiesRef.current));

    // Add to feed
    const agentColor = agentSnapshot.find((a) => a.id === agentId)?.color ?? "#8090c0";
    setFeedEntries((prev) => {
      const entry: FeedEntry = {
        id: `${Date.now()}-${agentId}`,
        label,
        agentColor,
        timestamp: Date.now(),
        activity,
      };
      const next = [...prev, entry];
      return next.length > 15 ? next.slice(-15) : next;
    });
  }, [config, agentSnapshot]);

  // Subscribe to events
  useEffect(() => {
    if (!eventBus) return;
    const unsub = eventBus.subscribe(handleEvent);
    return unsub;
  }, [eventBus, handleEvent]);

  // Activity timeout loop
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const now = Date.now();
      let changed = false;
      for (const [id, record] of agentActivitiesRef.current.entries()) {
        if (record.activity !== "idle" && now - record.startedAt > ACTIVITY_TIMEOUT_MS) {
          agentActivitiesRef.current.set(id, { ...record, activity: "idle" });
          changed = true;
        }
      }
      if (changed) setActivitySnapshot(new Map(agentActivitiesRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Connection status badge */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          padding: "6px 12px",
          background: "rgba(0,0,0,0.6)",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isDemoMode
              ? "#ffdd6b"
              : !hasGateway
                ? "#6bff6b"
                : status === "connected"
                  ? "#6bff6b"
                  : status === "connecting"
                    ? "#ffdd6b"
                    : "#ff6b6b",
          }}
        />
        {isDemoMode
          ? "Demo"
          : !hasGateway
            ? `Live · ${localSources.filter((s) => s !== "ingest").join(" + ") || "ingest"}`
            : status === "connected"
              ? "Live"
              : status === "connecting"
                ? "Connecting..."
                : "Disconnected"}
      </div>

      {/* Activity feed */}
      <ActivityFeed entries={feedEntries} />

      <DioramaScene theme={config.theme} center={roomsCenter} fitRadius={fitRadius}>
        {config.rooms.map((room, i) => (
          <Room3D
            key={`${room.preset}-${i}`}
            room={room}
            accentColor={colors.accent}
            floorColor={colors.floor}
            themeId={config.theme}
            selected={selectedRoom === room.label}
            glowIntensity={roomGlows[i] ?? 0}
            onPointerUp={() => onSelectRoom?.(room.label === selectedRoom ? null : room.label)}
          />
        ))}
        {agentSnapshot.map((agent, i) => (
          <AgentFigure3D
            key={agent.id}
            state={agent.state}
            color={agent.color}
            label={agent.id}
            phase={i * 3.7}
            energy={agent.energy}
            activity={activitySnapshot.get(agent.id)?.activity ?? "idle"}
          />
        ))}
      </DioramaScene>
    </div>
  );
}
