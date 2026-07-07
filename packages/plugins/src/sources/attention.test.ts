import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { DioramaEvent } from "@diorama/engine";
import {
  ATTENTION_THRESHOLD_MS,
  createAttentionState,
  detectAttention,
  noteRecord,
} from "./attention";
import { claudeBlockingSignature, connectClaudeCode, mapClaudeRecord } from "./claudeCode";
import { connectCodexSessions, updateCodexPendingCalls } from "./codexSessions";

const CLAUDE_FILE = "/home/.claude/projects/-Users-me-Desktop-my-app/session-1.jsonl";

describe("attention state machine", () => {
  it("announces a block only after the threshold, and only once", () => {
    const state = createAttentionState(1000);
    noteRecord(state, { label: "waiting for your approval", reason: "Bash call pending" }, 1000);

    expect(detectAttention(state, 1000 + ATTENTION_THRESHOLD_MS - 1)).toBeNull();
    expect(detectAttention(state, 1000 + ATTENTION_THRESHOLD_MS)).toBe("pending");
    // No re-announcement on later scans
    expect(detectAttention(state, 1000 + ATTENTION_THRESHOLD_MS + 5000)).toBeNull();
  });

  it("resolves an announced block when any record arrives", () => {
    const state = createAttentionState(0);
    noteRecord(state, { label: "waiting", reason: "x" }, 0);
    detectAttention(state, ATTENTION_THRESHOLD_MS);
    expect(noteRecord(state, null, ATTENTION_THRESHOLD_MS + 100)).toBe("resolved");
    // Nothing pending anymore
    expect(detectAttention(state, ATTENTION_THRESHOLD_MS * 3)).toBeNull();
  });

  it("does not resolve when the block was never announced", () => {
    const state = createAttentionState(0);
    noteRecord(state, { label: "waiting", reason: "x" }, 0);
    // Follow-up record arrives within normal tool latency
    expect(noteRecord(state, null, 3000)).toBeNull();
    expect(detectAttention(state, ATTENTION_THRESHOLD_MS * 2)).toBeNull();
  });

  it("restarts the clock when a new blocking record replaces the old one", () => {
    const state = createAttentionState(0);
    noteRecord(state, { label: "a", reason: "a" }, 0);
    noteRecord(state, { label: "b", reason: "b" }, 15_000);
    expect(detectAttention(state, 20_000)).toBeNull(); // only 5s since last record
    expect(detectAttention(state, 15_000 + ATTENTION_THRESHOLD_MS)).toBe("pending");
    expect(state.pending?.label).toBe("b");
  });
});

describe("claude blocking signature", () => {
  it("flags an assistant record ending in tool_use", () => {
    const cause = claudeBlockingSignature({
      type: "assistant",
      message: { content: [{ type: "text", text: "Running it" }, { type: "tool_use", name: "Bash" }] },
    });
    expect(cause).toEqual({ label: "waiting for your approval", reason: "Bash call pending" });
  });

  it("labels user-facing tools specifically", () => {
    const ask = claudeBlockingSignature({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "AskUserQuestion" }] },
    });
    expect(ask?.label).toBe("waiting for your answer");
    const plan = claudeBlockingSignature({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "ExitPlanMode" }] },
    });
    expect(plan?.label).toBe("waiting for plan approval");
  });

  it("ignores non-blocking records", () => {
    expect(
      claudeBlockingSignature({ type: "assistant", message: { content: [{ type: "text", text: "done" }] } }),
    ).toBeNull();
    expect(
      claudeBlockingSignature({
        type: "assistant",
        isSidechain: true,
        message: { content: [{ type: "tool_use", name: "Bash" }] },
      }),
    ).toBeNull();
    expect(
      claudeBlockingSignature({ type: "user", message: { content: [{ type: "tool_result" }] } }),
    ).toBeNull();
    expect(claudeBlockingSignature({ type: "system", subtype: "turn_duration" })).toBeNull();
    expect(claudeBlockingSignature(null)).toBeNull();
  });
});

describe("claude session.idle derivation", () => {
  it("maps system/turn_duration to session.idle", () => {
    const event = mapClaudeRecord(
      { type: "system", subtype: "turn_duration", timestamp: "2026-07-06T10:00:00.000Z" },
      CLAUDE_FILE,
    );
    expect(event).toMatchObject({ type: "session.idle", agent: "claude/app" });
  });

  it("ignores other system subtypes", () => {
    expect(mapClaudeRecord({ type: "system", subtype: "stop_hook_summary" }, CLAUDE_FILE)).toBeNull();
  });
});

describe("codex pending-call tracking", () => {
  it("counts calls up and outputs down, floored at zero", () => {
    let n = 0;
    n = updateCodexPendingCalls(n, { type: "response_item", payload: { type: "function_call" } });
    n = updateCodexPendingCalls(n, { type: "response_item", payload: { type: "custom_tool_call" } });
    expect(n).toBe(2);
    n = updateCodexPendingCalls(n, { type: "response_item", payload: { type: "function_call_output" } });
    n = updateCodexPendingCalls(n, { type: "response_item", payload: { type: "custom_tool_call_output" } });
    n = updateCodexPendingCalls(n, { type: "response_item", payload: { type: "function_call_output" } });
    expect(n).toBe(0);
  });

  it("ignores unrelated records", () => {
    expect(updateCodexPendingCalls(1, { type: "response_item", payload: { type: "reasoning" } })).toBe(1);
    expect(updateCodexPendingCalls(1, { type: "event_msg", payload: { type: "token_count" } })).toBe(1);
    expect(updateCodexPendingCalls(1, null)).toBe(1);
  });
});

describe("attention over real files (temp fixtures)", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diorama-attn-"));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("claude connector emits attention.requested then attention.resolved", () => {
    const projDir = path.join(tmpDir, "projects/-Users-me-my-app");
    fs.mkdirSync(projDir, { recursive: true });
    const file = path.join(projDir, "sess.jsonl");
    fs.writeFileSync(file, "");

    const events: DioramaEvent[] = [];
    const handle = connectClaudeCode({
      dir: path.join(tmpDir, "projects"),
      intervalMs: 60_000,
      attentionThresholdMs: 0, // aged instantly — no waiting in tests
      onEvent: (e) => events.push(e),
    });

    // Assistant issues a tool call… and nothing follows (permission prompt).
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }] } }) + "\n",
    );
    handle.scan();
    expect(events.map((e) => e.type)).toEqual(["tool.call", "attention.requested"]);
    expect(events[1]).toMatchObject({
      agent: "claude/app",
      payload: { source: "claude-code", label: "waiting for your approval", reason: "Bash call pending" },
    });

    // User approves — the tool_result record lands, the block resolves.
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result" }] } }) + "\n",
    );
    handle.scan();
    handle.stop();
    expect(events.map((e) => e.type)).toEqual(["tool.call", "attention.requested", "attention.resolved"]);
  });

  it("claude connector stays quiet when the tool result arrives before the threshold", () => {
    const projDir = path.join(tmpDir, "projects/-Users-me-my-app");
    fs.mkdirSync(projDir, { recursive: true });
    const file = path.join(projDir, "sess.jsonl");
    fs.writeFileSync(file, "");

    const events: DioramaEvent[] = [];
    const handle = connectClaudeCode({
      dir: path.join(tmpDir, "projects"),
      intervalMs: 60_000, // default 20s threshold — a same-scan result never ages past it
      onEvent: (e) => events.push(e),
    });
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read" }] } }) +
        "\n" +
        JSON.stringify({ type: "user", message: { content: [{ type: "tool_result" }] } }) +
        "\n",
    );
    handle.scan();
    handle.stop();
    expect(events.map((e) => e.type)).toEqual(["tool.call"]);
  });

  it("codex connector emits attention.requested for a pending call and resolves on output", () => {
    const sessionsDir = path.join(tmpDir, "sessions/2026/07/06");
    fs.mkdirSync(sessionsDir, { recursive: true });
    const file = path.join(sessionsDir, "rollout-2026-07-06T10-00-00-aabbccdd.jsonl");
    fs.writeFileSync(file, "");

    const events: DioramaEvent[] = [];
    const handle = connectCodexSessions({
      dir: path.join(tmpDir, "sessions"),
      intervalMs: 60_000,
      attentionThresholdMs: 0,
      onEvent: (e) => events.push(e),
    });
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "session_meta", payload: { cwd: "/p/webapp" } }) +
        "\n" +
        JSON.stringify({ type: "response_item", payload: { type: "function_call", name: "shell" } }) +
        "\n",
    );
    handle.scan();
    expect(events.map((e) => e.type)).toEqual(["session.started", "tool.call", "attention.requested"]);
    expect(events[2]).toMatchObject({ agent: "codex/webapp", payload: { source: "codex" } });

    fs.appendFileSync(
      file,
      JSON.stringify({ type: "response_item", payload: { type: "function_call_output" } }) + "\n",
    );
    handle.scan();
    handle.stop();
    expect(events.map((e) => e.type)).toEqual([
      "session.started",
      "tool.call",
      "attention.requested",
      "attention.resolved",
    ]);
  });
});
