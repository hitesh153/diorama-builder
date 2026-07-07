"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentActivity } from "@diorama/engine";

export interface FeedEntry {
  id: string;
  label: string;
  agentColor: string;
  timestamp: number;
  activity: AgentActivity;
  /** Attention event — the agent is waiting on the user (amber dot). */
  attention?: boolean;
}

interface ActivityFeedProps {
  entries: FeedEntry[];
}

function relativeTime(ts: number, now: number): string {
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 1) return "now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(Date.now());

  // Update relative timestamps every second
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div
      className="dio-card"
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 10,
        width: 340,
        maxHeight: 280,
        background: "color-mix(in oklab, var(--surface) 85%, transparent)",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 550,
          letterSpacing: "0.02em",
          color: "var(--ink-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        Activity
      </div>

      {/* Scrollable entries */}
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto",
          padding: "6px 0",
          flex: 1,
          minHeight: 0,
        }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="dio-mono"
            style={{
              padding: "4px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            {/* Agent color dot — amber for attention events */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: entry.attention ? "var(--warn)" : entry.agentColor,
                marginTop: 4,
                flexShrink: 0,
                boxShadow: entry.attention ? "none" : `0 0 4px ${entry.agentColor}40`,
              }}
            />
            {/* Label */}
            <span style={{ color: "var(--ink-2)", flex: 1 }}>
              {entry.label}
            </span>
            {/* Timestamp */}
            <span
              style={{
                color: "var(--ink-3)",
                fontSize: 10,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {relativeTime(entry.timestamp, tick)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
