"use client";

import { useEffect, useState } from "react";
import type { SourceConfig } from "@diorama/engine";

export interface ConnectResult {
  url: string;
  token: string;
  useDemoData: boolean;
  sources: SourceConfig[];
}

interface ConnectStepProps {
  onNext: (data: ConnectResult) => void;
}

interface DetectedSource {
  type: "codex" | "claude-code" | "ingest";
  label: string;
  available: boolean;
  detail: string;
}

const SOURCE_GLYPHS: Record<string, string> = {
  codex: "⌘",
  "claude-code": "✳",
  ingest: "→",
};

function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
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

export function ConnectStep({ onNext }: ConnectStepProps) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayOk, setGatewayOk] = useState(false);
  const [showGatewayForm, setShowGatewayForm] = useState(false);

  const [detected, setDetected] = useState<DetectedSource[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/sources/detect")
      .then((r) => r.json())
      .then((data: { sources: DetectedSource[] }) => {
        setDetected(data.sources);
        setSelected(new Set(data.sources.filter((s) => s.available && s.type !== "ingest").map((s) => s.type)));
      })
      .catch(() => setDetected([]));
  }, []);

  async function testConnection() {
    setTesting(true);
    setError(null);
    setGatewayOk(false);
    try {
      const res = await fetch("/api/gateway/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token }),
      });
      const data = await res.json();
      if (data.ok) setGatewayOk(true);
      else setError(data.error ?? "Connection failed");
    } catch {
      setError("Failed to reach test endpoint");
    } finally {
      setTesting(false);
    }
  }

  const toggle = (type: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const buildSources = (): SourceConfig[] => {
    const sources: SourceConfig[] = [...selected].map((type) => ({ type }) as SourceConfig);
    if (gatewayOk && url) sources.unshift({ type: "openclaw", target: url });
    return sources;
  };

  const count = selected.size + (gatewayOk ? 1 : 0);

  const cardBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
  };

  return (
    <div style={{ maxWidth: 480, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 650, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Connect your agents
      </h1>
      <p style={{ color: "var(--ink-2)", margin: "0 0 28px", maxWidth: "44ch" }}>
        Diorama scanned this machine for agent runtimes. Pick what to visualize; you can also
        push events from anything over HTTP.
      </p>

      {detected === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="dio-card dio-pulse" style={{ height: 62 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {detected.map((source) => {
            const isOn = selected.has(source.type);
            return (
              <button
                key={source.type}
                onClick={() => source.available && toggle(source.type)}
                disabled={!source.available}
                className="dio-card dio-card-interactive"
                data-selected={isOn}
                style={cardBase}
              >
                <Checkbox on={isOn} />
                <span
                  aria-hidden
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--ink-2)",
                    fontSize: 13,
                  }}
                >
                  {SOURCE_GLYPHS[source.type] ?? "•"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 550, color: "var(--ink)" }}>
                    {source.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      marginTop: 1,
                      color: source.available ? "var(--ok)" : "var(--ink-3)",
                    }}
                  >
                    {source.detail}
                  </span>
                </span>
              </button>
            );
          })}

          {/* OpenClaw gateway — expandable */}
          <div className="dio-card" data-selected={gatewayOk} style={{ overflow: "hidden" }}>
            <button
              onClick={() => setShowGatewayForm((v) => !v)}
              style={{ ...cardBase, background: "none", border: "none", color: "inherit" }}
            >
              <Checkbox on={gatewayOk} />
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--ink-2)",
                  fontSize: 13,
                }}
              >
                ⇄
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 550 }}>OpenClaw gateway</span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginTop: 1,
                    color: gatewayOk ? "var(--ok)" : "var(--ink-3)",
                  }}
                >
                  {gatewayOk ? `connected to ${url}` : "connect over WebSocket"}
                </span>
              </span>
              <span style={{ color: "var(--ink-3)", fontSize: 11 }}>{showGatewayForm ? "▲" : "▼"}</span>
            </button>

            {showGatewayForm && (
              <div style={{ padding: "0 14px 14px 56px", display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  className="dio-input dio-mono"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setGatewayOk(false);
                  }}
                  placeholder="ws://localhost:4040"
                />
                <input
                  type="password"
                  className="dio-input dio-mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="token (optional)"
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={testConnection} disabled={testing || !url} className="dio-btn dio-btn-sm">
                    {testing ? "Testing…" : "Test connection"}
                  </button>
                  {error && <span style={{ color: "var(--err)", fontSize: 12 }}>{error}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
        <button
          onClick={() => onNext({ url: "", token: "", useDemoData: true, sources: [] })}
          className="dio-btn dio-btn-ghost"
        >
          Preview with demo agents
        </button>
        <button
          onClick={() =>
            onNext({ url: gatewayOk ? url : "", token: gatewayOk ? token : "", useDemoData: false, sources: buildSources() })
          }
          disabled={count === 0}
          className="dio-btn dio-btn-primary"
        >
          Continue with {count} source{count === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
