"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyToolCall,
  describeWorld,
  type CopilotEffect,
} from "@diorama/ui/src/copilotTools";
import { builderReducer, type BuilderState, type BuilderAction } from "@diorama/ui/src/builderStore";
import { PROVIDER_LABELS, type CopilotProviderConfig } from "@diorama/plugins/copilot/providers";

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
  "claude-cli": "(your CLI default — or e.g. sonnet)",
  "codex-cli": "(your CLI default)",
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

  const [clis, setClis] = useState<{ claude: boolean; codex: boolean }>({ claude: false, codex: false });

  useEffect(() => {
    fetch("/api/copilot/config")
      .then((r) => r.json())
      .then((s: { configured: boolean; clis?: { claude: boolean; codex: boolean } }) => {
        setConfigured(s.configured);
        if (s.clis) setClis(s.clis);
      })
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
    return <div style={{ padding: 16, fontSize: 12, color: "var(--ink-3)" }}>Loading…</div>;
  }

  if (!configured || showSettings) {
    return (
      <SettingsCard
        clis={clis}
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
        <h4 style={{ margin: 0, fontSize: 11, fontWeight: 550, letterSpacing: "0.02em", color: "var(--ink-2)" }}>
          ✦ Copilot
        </h4>
        <button
          onClick={() => setShowSettings(true)}
          title="Provider settings"
          className="dio-btn dio-btn-ghost dio-btn-sm"
          style={{ width: 26, padding: 0, fontSize: 14 }}
        >
          ⚙
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px" }}>
        {messages.length === 0 && (
          <div style={{ padding: "12px 4px" }}>
            <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "0 0 10px" }}>
              Describe what you want and I&apos;ll build it — rooms, themes, layouts, agent seating.
            </p>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="dio-card dio-card-interactive"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: 6,
                  padding: "8px 10px",
                  color: "var(--ink-2)",
                  fontSize: 12,
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
              <p className="dio-mono" style={{ fontSize: 11, color: "var(--err)", margin: 0, padding: "4px 6px" }}>
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
                      background: msg.role === "user" ? "var(--accent-soft)" : "var(--surface-2)",
                      border:
                        msg.role === "user"
                          ? "1px solid color-mix(in oklab, var(--accent) 30%, transparent)"
                          : "1px solid var(--border)",
                      color: "var(--ink)",
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
                        className="dio-mono"
                        style={{
                          fontSize: 10.5,
                          padding: "3px 8px",
                          borderRadius: 5,
                          background: chip.ok ? "var(--ok-soft)" : "var(--err-soft)",
                          border: chip.ok
                            ? "1px solid var(--ok-soft)"
                            : "1px solid var(--err-soft)",
                          color: chip.ok ? "var(--ok)" : "var(--err)",
                        }}
                      >
                        {chip.ok ? "✓" : "✗"} {chip.label}
                      </span>
                    ))}
                    {msg.didBatch && (
                      <button
                        onClick={() => dispatch({ type: "UNDO" })}
                        className="dio-mono"
                        style={{
                          alignSelf: "flex-start",
                          background: "transparent",
                          border: "none",
                          color: "var(--ink-3)",
                          fontSize: 10.5,
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
          <p className="dio-mono" style={{ fontSize: 11.5, color: "var(--ink-2)", padding: "2px 6px" }}>
            <ThinkingDots /> thinking
          </p>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)" }}>
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
            className="dio-input"
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="dio-btn dio-btn-primary"
            style={{ width: 32, padding: 0, flexShrink: 0 }}
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

function SettingsCard({ clis, onDone }: { clis: { claude: boolean; codex: boolean }; onDone: () => void }) {
  // Default to a detected local CLI — zero-setup path
  const [provider, setProvider] = useState<CopilotProviderConfig["provider"]>(
    clis.claude ? "claude-cli" : clis.codex ? "codex-cli" : "anthropic",
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; error?: string }>(null);

  const isCli = provider === "claude-cli" || provider === "codex-cli";
  const needsKey = !isCli && provider !== "ollama";
  const needsBaseUrl = provider === "openai-compatible" || provider === "ollama";

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
      <h4 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 550, letterSpacing: "0.02em", color: "var(--ink-2)" }}>
        Connect your AI
      </h4>
      <p style={{ fontSize: 11.5, color: "var(--ink-2)", margin: "0 0 6px", lineHeight: 1.5 }}>
        Bring your own LLM — keys are stored locally in ~/.diorama and never leave your machine.
      </p>

      <label className="dio-label" style={{ margin: "10px 0 4px" }}>Provider</label>
      <select
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value as CopilotProviderConfig["provider"]);
          setTestResult(null);
        }}
        className="dio-select"
      >
        {PROVIDERS.map((p) => {
          const detected =
            (p === "claude-cli" && clis.claude) || (p === "codex-cli" && clis.codex);
          return (
            <option key={p} value={p}>
              {detected ? "✓ " : ""}{PROVIDER_LABELS[p]}
            </option>
          );
        })}
      </select>

      {needsKey && (
        <>
          <label className="dio-label" style={{ margin: "10px 0 4px" }}>API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
            className="dio-input dio-mono"
          />
        </>
      )}
      {isCli && (
        <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.5 }}>
          {provider === "claude-cli"
            ? "Runs your local `claude` CLI — uses the login and plan you already have. No key needed."
            : "Runs your local `codex` CLI — uses your ChatGPT login. No key needed."}
          {" "}Replies take a bit longer than a direct API.
        </p>
      )}
      {provider === "codex-auth" && (
        <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Advanced: raw token from ~/.codex/auth.json against a custom OpenAI-compatible base URL.
        </p>
      )}

      <label className="dio-label" style={{ margin: "10px 0 4px" }}>Model</label>
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={MODEL_PLACEHOLDERS[provider]}
        className="dio-input dio-mono"
      />

      {needsBaseUrl && (
        <>
          <label className="dio-label" style={{ margin: "10px 0 4px" }}>Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === "ollama" ? "http://localhost:11434/v1" : "https://api.openai.com/v1"}
            className="dio-input dio-mono"
          />
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={() => save(true)}
          disabled={saving}
          className="dio-btn dio-btn-primary"
          style={{ flex: 1 }}
        >
          {saving ? "Saving…" : "Save & test"}
        </button>
        <button onClick={() => save(false)} disabled={saving} className="dio-btn">
          Save
        </button>
      </div>

      {testResult && (
        <p
          className="dio-mono"
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: testResult.ok ? "var(--ok)" : "var(--err)",
            wordBreak: "break-word",
          }}
        >
          {testResult.ok ? "✓ Connected" : `✗ ${testResult.error}`}
        </p>
      )}
    </div>
  );
}
