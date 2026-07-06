"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyToolCall,
  describeWorld,
  type CopilotEffect,
} from "@diorama/ui/src/copilotTools";
import { builderReducer, type BuilderState, type BuilderAction } from "@diorama/ui/src/builderStore";
import { PROVIDER_LABELS, type CopilotProviderConfig } from "@diorama/plugins/copilot/providers";

const MONO = "'SF Mono', 'Fira Code', monospace";
const MAX_TOOL_ROUNDS = 5;

// Wire types matching the /api/copilot/chat contract
interface WireToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface WireTurn {
  role: "user" | "assistant";
  text?: string;
  toolCalls?: WireToolCall[];
  toolResults?: Array<{ id: string; content: string }>;
}

// Display transcript (what the user sees)
interface ChipInfo {
  ok: boolean;
  label: string;
}
interface DisplayMsg {
  role: "user" | "assistant" | "system";
  text: string;
  chips?: ChipInfo[];
  didBatch?: boolean;
}

interface CopilotPanelProps {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  theme: string;
  agents: string[];
  onThemeChange: (theme: string) => void;
  onAssignAgent: (agent: string, room: string) => void;
  makeId: () => string;
}

const QUICK_PROMPTS = [
  "Design an office for my team",
  "Make it feel cyberpunk",
  "Add a meeting room with 6 chairs",
];

const MODEL_PLACEHOLDERS: Record<CopilotProviderConfig["provider"], string> = {
  anthropic: "claude-sonnet-5",
  "openai-compatible": "gpt-5",
  ollama: "llama3.1",
  "codex-auth": "gpt-5",
};

export function CopilotPanel({
  state,
  dispatch,
  theme,
  agents,
  onThemeChange,
  onAssignAgent,
  makeId,
}: CopilotPanelProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Latest world state via ref — the agentic loop spans awaits and must
  // see fresh state without re-subscribing (repo's ref-based pattern).
  const worldRef = useRef({ state, theme, agents });
  worldRef.current = { state, theme, agents };

  useEffect(() => {
    fetch("/api/copilot/config")
      .then((r) => r.json())
      .then((s: { configured: boolean }) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);

    // Wire transcript for this run (display transcript is separate)
    const wire: WireTurn[] = [{ role: "user", text }];

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const { state: curState, theme: curTheme, agents: curAgents } = worldRef.current;
        const system =
          "You are Diorama's office-building copilot. You edit a 3D office world for AI agents using the provided tools. Be concise. Current world:\n" +
          describeWorld(curState, curTheme, curAgents) +
          "\nWhen the user asks for changes, call tools. Prefer generate_layout for whole-team requests. Never invent room labels — use the ones listed.";

        const res = await fetch("/api/copilot/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ system, messages: wire }),
        });
        const data = (await res.json()) as { text?: string; toolCalls?: WireToolCall[]; error?: string };

        if (!res.ok) {
          if (data.error === "not_configured") {
            setConfigured(false);
            setMessages((m) => [...m, { role: "system", text: "Connect an AI provider first (⚙ settings)." }]);
          } else {
            setMessages((m) => [...m, { role: "system", text: data.error ?? `Request failed (${res.status})` }]);
          }
          return;
        }

        const toolCalls = data.toolCalls ?? [];
        if (toolCalls.length === 0) {
          // Final answer
          setMessages((m) => [...m, { role: "assistant", text: data.text || "(done)" }]);
          return;
        }

        // Apply tool calls in order against a working state so later calls
        // see earlier results (e.g. add_room then assign_agent to it).
        let working = worldRef.current.state;
        const batch: BuilderAction[] = [];
        const effects: CopilotEffect[] = [];
        const chips: ChipInfo[] = [];
        const toolResults: Array<{ id: string; content: string }> = [];

        for (const call of toolCalls) {
          const result = applyToolCall(working, { name: call.name, input: call.input }, makeId);
          if (result.error) {
            chips.push({ ok: false, label: result.error });
            toolResults.push({ id: call.id, content: `Error: ${result.error}` });
            continue;
          }
          for (const action of result.actions) {
            working = builderReducer(working, action);
          }
          batch.push(...result.actions);
          effects.push(...result.effects);
          chips.push({ ok: true, label: result.summary });
          toolResults.push({ id: call.id, content: result.summary });
        }

        if (batch.length > 0) {
          dispatch({ type: "BATCH", actions: batch });
        }
        for (const effect of effects) {
          if (effect.kind === "set_theme") onThemeChange(effect.theme);
          else if (effect.kind === "assign_agent") onAssignAgent(effect.agent, effect.room);
        }

        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.text || "", chips, didBatch: batch.length > 0 },
        ]);

        wire.push({ role: "assistant", text: data.text, toolCalls });
        wire.push({ role: "user", toolResults });
      }
      setMessages((m) => [...m, { role: "system", text: "Stopped after 5 tool rounds." }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "system", text: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setBusy(false);
    }
  };

  if (configured === null) {
    return <div style={{ padding: 16, fontSize: 12, color: "#666", fontFamily: MONO }}>Loading…</div>;
  }

  if (!configured || showSettings) {
    return (
      <SettingsCard
        onDone={() => {
          setConfigured(true);
          setShowSettings(false);
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px 6px",
        }}
      >
        <h4 style={{ margin: 0, fontSize: 11, color: "#8090c0", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: MONO }}>
          ✦ Copilot
        </h4>
        <button
          onClick={() => setShowSettings(true)}
          title="Provider settings"
          style={{ background: "transparent", border: "none", color: "#556", cursor: "pointer", fontSize: 14 }}
        >
          ⚙
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px" }}>
        {messages.length === 0 && (
          <div style={{ padding: "12px 4px" }}>
            <p style={{ fontSize: 12, color: "#667", margin: "0 0 10px" }}>
              Describe what you want and I&apos;ll build it — rooms, themes, layouts, agent seating.
            </p>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: 6,
                  padding: "8px 10px",
                  background: "#111a28",
                  border: "1px solid #1a2535",
                  borderRadius: 8,
                  color: "#a0b0d0",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            {msg.role === "system" ? (
              <p style={{ fontSize: 11, color: "#ff6b6b", fontFamily: MONO, margin: 0, padding: "4px 6px" }}>
                {msg.text}
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {(msg.text || msg.role === "user") && (
                  <div
                    style={{
                      maxWidth: "88%",
                      padding: "8px 10px",
                      borderRadius: 10,
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      background: msg.role === "user" ? "#26355a" : "#131c2b",
                      border: msg.role === "user" ? "1px solid #35476f" : "1px solid #1a2535",
                      color: "#dde4f0",
                    }}
                  >
                    {msg.text}
                  </div>
                )}
                {msg.chips && msg.chips.length > 0 && (
                  <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 3, maxWidth: "92%" }}>
                    {msg.chips.map((chip, j) => (
                      <span
                        key={j}
                        style={{
                          fontSize: 10.5,
                          fontFamily: MONO,
                          padding: "3px 8px",
                          borderRadius: 5,
                          background: chip.ok ? "#12281c" : "#2b1518",
                          border: chip.ok ? "1px solid #1d4029" : "1px solid #57272c",
                          color: chip.ok ? "#6bd694" : "#ff8a8a",
                        }}
                      >
                        {chip.ok ? "✓" : "✗"} {chip.label}
                      </span>
                    ))}
                    {msg.didBatch && (
                      <button
                        onClick={() => dispatch({ type: "UNDO" })}
                        style={{
                          alignSelf: "flex-start",
                          background: "transparent",
                          border: "none",
                          color: "#667",
                          fontSize: 10.5,
                          fontFamily: MONO,
                          cursor: "pointer",
                          padding: "2px 0",
                          textDecoration: "underline",
                        }}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <p style={{ fontSize: 11.5, color: "#8090c0", fontFamily: MONO, padding: "2px 6px" }}>
            <ThinkingDots /> thinking
          </p>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #1a2535" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          style={{ display: "flex", gap: 6 }}
        >
          <input
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "Working…" : "Ask the copilot…"}
            style={{
              flex: 1,
              padding: "9px 10px",
              background: "#0a111c",
              border: "1px solid #1a2535",
              borderRadius: 8,
              color: "#e0e0e0",
              fontSize: 12.5,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              padding: "0 14px",
              background: busy || !input.trim() ? "#1a2535" : "#8090c0",
              color: busy || !input.trim() ? "#556" : "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              cursor: busy || !input.trim() ? "default" : "pointer",
            }}
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}

function ThinkingDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v % 3) + 1), 350);
    return () => clearInterval(t);
  }, []);
  return <span>{"·".repeat(n)}</span>;
}

// ---- Provider settings card ----

const PROVIDERS = Object.keys(PROVIDER_LABELS) as Array<CopilotProviderConfig["provider"]>;

function SettingsCard({ onDone }: { onDone: () => void }) {
  const [provider, setProvider] = useState<CopilotProviderConfig["provider"]>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; error?: string }>(null);

  const needsKey = provider !== "ollama" && provider !== "codex-auth";
  const needsBaseUrl = provider === "openai-compatible" || provider === "ollama";

  const label: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    color: "#556",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    margin: "10px 0 4px",
    fontFamily: MONO,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    background: "#0a111c",
    border: "1px solid #1a2535",
    borderRadius: 6,
    color: "#e0e0e0",
    fontSize: 12,
    fontFamily: MONO,
    outline: "none",
  };

  const save = async (thenTest: boolean) => {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/copilot/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, baseUrl }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setTestResult({ ok: false, error: data.error ?? "Save failed" });
        return;
      }
      if (thenTest) {
        const t = (await (await fetch("/api/copilot/test", { method: "POST" })).json()) as {
          ok: boolean;
          error?: string;
        };
        setTestResult(t);
        if (t.ok) setTimeout(onDone, 600);
      } else {
        onDone();
      }
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16, overflowY: "auto" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 11, color: "#8090c0", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: MONO }}>
        Connect your AI
      </h4>
      <p style={{ fontSize: 11.5, color: "#667", margin: "0 0 6px", lineHeight: 1.5 }}>
        Bring your own LLM — keys are stored locally in ~/.diorama and never leave your machine.
      </p>

      <label style={label}>Provider</label>
      <select
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value as CopilotProviderConfig["provider"]);
          setTestResult(null);
        }}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        {PROVIDERS.map((p) => (
          <option key={p} value={p}>
            {PROVIDER_LABELS[p]}
          </option>
        ))}
      </select>

      {needsKey && (
        <>
          <label style={label}>API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
            style={inputStyle}
          />
        </>
      )}
      {provider === "codex-auth" && (
        <p style={{ fontSize: 11, color: "#667", margin: "8px 0 0", lineHeight: 1.5 }}>
          Uses your Codex CLI login (~/.codex/auth.json). Run <code style={{ fontFamily: MONO }}>codex login</code> first.
        </p>
      )}

      <label style={label}>Model</label>
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={MODEL_PLACEHOLDERS[provider]}
        style={inputStyle}
      />

      {needsBaseUrl && (
        <>
          <label style={label}>Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === "ollama" ? "http://localhost:11434/v1" : "https://api.openai.com/v1"}
            style={inputStyle}
          />
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={() => save(true)}
          disabled={saving}
          style={{
            flex: 1,
            padding: "9px 0",
            background: "#8090c0",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save & test"}
        </button>
        <button
          onClick={() => save(false)}
          disabled={saving}
          style={{
            padding: "9px 14px",
            background: "transparent",
            color: "#889",
            border: "1px solid #2a3545",
            borderRadius: 7,
            fontSize: 12.5,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          Save
        </button>
      </div>

      {testResult && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11.5,
            fontFamily: MONO,
            color: testResult.ok ? "#6bd694" : "#ff8a8a",
            wordBreak: "break-word",
          }}
        >
          {testResult.ok ? "✓ Connected" : `✗ ${testResult.error}`}
        </p>
      )}
    </div>
  );
}
