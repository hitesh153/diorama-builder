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
        // Preselect everything that's actually available (except raw ingest)
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

  const anythingConnected = selected.size > 0 || (gatewayOk && Boolean(url));

  return (
    <div style={{ maxWidth: 520, width: "100%" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Connect your agents</h2>
      <p style={{ color: "#999", marginBottom: 20, fontSize: 14 }}>
        Diorama found these agent runtimes on your machine. Pick what to visualize — or push
        events from anything over HTTP.
      </p>

      {/* Detected source cards */}
      {detected === null ? (
        <p style={{ color: "#666", fontSize: 13 }}>Scanning for agent runtimes…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {detected.map((source) => {
            const isOn = selected.has(source.type);
            return (
              <button
                key={source.type}
                onClick={() => source.available && toggle(source.type)}
                disabled={!source.available}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  padding: "12px 14px",
                  background: isOn ? "#16233a" : "#111827",
                  border: isOn ? "1px solid #8090c0" : "1px solid #1a2535",
                  borderRadius: 10,
                  cursor: source.available ? "pointer" : "default",
                  opacity: source.available ? 1 : 0.45,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    background: isOn ? "#8090c0" : "transparent",
                    border: isOn ? "none" : "1px solid #2a3a50",
                    color: "#fff",
                  }}
                >
                  {isOn ? "✓" : ""}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14, color: "#e0e0e0", fontWeight: 600 }}>
                    {source.label}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: source.available ? "#7a8" : "#666", marginTop: 2 }}>
                    {source.available ? "✓ " : ""}{source.detail}
                  </span>
                </span>
              </button>
            );
          })}

          {/* OpenClaw gateway card (expandable form) */}
          <div
            style={{
              padding: "12px 14px",
              background: gatewayOk ? "#16233a" : "#111827",
              border: gatewayOk ? "1px solid #8090c0" : "1px solid #1a2535",
              borderRadius: 10,
            }}
          >
            <button
              onClick={() => setShowGatewayForm((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  background: gatewayOk ? "#8090c0" : "transparent",
                  border: gatewayOk ? "none" : "1px solid #2a3a50",
                  color: "#fff",
                }}
              >
                {gatewayOk ? "✓" : ""}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, color: "#e0e0e0", fontWeight: 600 }}>
                  OpenClaw gateway
                </span>
                <span style={{ display: "block", fontSize: 12, color: gatewayOk ? "#7a8" : "#666", marginTop: 2 }}>
                  {gatewayOk ? `✓ connected to ${url}` : "connect over WebSocket"}
                </span>
              </span>
              <span style={{ color: "#556", fontSize: 12 }}>{showGatewayForm ? "▴" : "▾"}</span>
            </button>

            {showGatewayForm && (
              <div style={{ marginTop: 12 }}>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setGatewayOk(false);
                  }}
                  placeholder="ws://localhost:4040"
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="token (optional, $OPENCLAW_TOKEN)"
                  style={{ ...inputStyle, marginTop: 8 }}
                />
                <button
                  onClick={testConnection}
                  disabled={testing || !url}
                  style={{ ...buttonSecondary, marginTop: 10, fontSize: 13, padding: "8px 16px" }}
                >
                  {testing ? "Testing…" : "Test connection"}
                </button>
                {error && <p style={{ color: "#ff6b6b", fontSize: 12, marginTop: 8 }}>{error}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          onClick={() => onNext({ url: gatewayOk ? url : "", token: gatewayOk ? token : "", useDemoData: false, sources: buildSources() })}
          disabled={!anythingConnected}
          style={anythingConnected ? buttonPrimary : buttonDisabled}
        >
          Continue with {selected.size + (gatewayOk ? 1 : 0)} source{selected.size + (gatewayOk ? 1 : 0) === 1 ? "" : "s"}
        </button>
      </div>

      <div style={{ marginTop: 24, borderTop: "1px solid #1a2535", paddingTop: 14 }}>
        <button
          onClick={() => onNext({ url: "", token: "", useDemoData: true, sources: [] })}
          style={{ ...buttonSecondary, fontSize: 13 }}
        >
          Use Demo Data Instead
        </button>
        <p style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
          Skip connections and preview with sample agents.
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  background: "#0a111c",
  border: "1px solid #1a2535",
  borderRadius: 6,
  color: "#e0e0e0",
  fontSize: 14,
  outline: "none",
};

const buttonPrimary: React.CSSProperties = {
  padding: "10px 24px",
  background: "#8090c0",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const buttonSecondary: React.CSSProperties = {
  padding: "10px 24px",
  background: "transparent",
  color: "#8090c0",
  border: "1px solid #8090c0",
  borderRadius: 6,
  fontSize: 14,
  cursor: "pointer",
};

const buttonDisabled: React.CSSProperties = {
  padding: "10px 24px",
  background: "#1a2030",
  color: "#555",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
};
