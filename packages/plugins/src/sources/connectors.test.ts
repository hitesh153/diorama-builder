import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { DioramaEvent } from "@diorama/engine";
import {
  mapCodexRecord,
  agentNameFromCwd,
  connectCodexSessions,
  detectCodexSessions,
  type CodexFileState,
} from "./codexSessions";
import {
  mapClaudeRecord,
  agentNameFromProjectPath,
  connectClaudeCode,
  detectClaudeCode,
} from "./claudeCode";

const CODEX_FILE = "/x/sessions/2026/07/06/rollout-2026-07-06T10-00-00-019eff21-d755.jsonl";

describe("codex mapping", () => {
  const state: CodexFileState = { agent: "codex/unknown" };

  it("session_meta sets the agent from cwd and emits session.started", () => {
    const event = mapCodexRecord(
      {
        timestamp: "2026-07-06T10:00:00.000Z",
        type: "session_meta",
        payload: { id: "abc", cwd: "/Users/me/Projects/my-app" },
      },
      state,
      CODEX_FILE,
    );
    expect(event).toMatchObject({ type: "session.started", agent: "codex/my-app" });
    expect(state.agent).toBe("codex/my-app");
  });

  it("maps task/message/search/tool records with the tracked agent", () => {
    const cases: Array<[unknown, string]> = [
      [{ type: "event_msg", payload: { type: "task_started" } }, "task.started"],
      [{ type: "event_msg", payload: { type: "agent_message", message: "hi there" } }, "message.sent"],
      [{ type: "event_msg", payload: { type: "web_search_end" } }, "search.completed"],
      [{ type: "event_msg", payload: { type: "task_complete" } }, "task.completed"],
      [{ type: "response_item", payload: { type: "function_call", name: "shell" } }, "tool.call"],
    ];
    for (const [record, expected] of cases) {
      const event = mapCodexRecord(record, state, CODEX_FILE);
      expect(event?.type).toBe(expected);
      expect(event?.agent).toBe("codex/my-app");
      expect((event?.payload as { source: string }).source).toBe("codex");
    }
  });

  it("ignores noise records", () => {
    for (const record of [
      { type: "event_msg", payload: { type: "token_count" } },
      { type: "response_item", payload: { type: "reasoning" } },
      { type: "turn_context", payload: {} },
      null,
      "junk",
    ]) {
      expect(mapCodexRecord(record, state, CODEX_FILE)).toBeNull();
    }
  });

  it("falls back to a session-id agent name without cwd", () => {
    expect(agentNameFromCwd(undefined, CODEX_FILE)).toMatch(/^codex\/[0-9a-f]{4,8}$/);
  });
});

describe("claude-code mapping", () => {
  const FILE = "/home/.claude/projects/-Users-me-Desktop-diorama-builder/session-1.jsonl";

  it("derives the agent from the project slug", () => {
    expect(agentNameFromProjectPath(FILE)).toBe("claude/builder");
  });

  it("maps assistant text to message.sent", () => {
    const event = mapClaudeRecord(
      {
        type: "assistant",
        timestamp: "2026-07-06T10:00:00.000Z",
        message: { content: [{ type: "text", text: "Here's the fix" }] },
      },
      FILE,
    );
    expect(event).toMatchObject({ type: "message.sent", agent: "claude/builder" });
  });

  it("maps assistant tool_use to tool.call with the tool name", () => {
    const event = mapClaudeRecord(
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }] } },
      FILE,
    );
    expect(event?.type).toBe("tool.call");
    expect((event?.payload as { label: string }).label).toBe("used Bash");
  });

  it("ignores user/system/sidechain records", () => {
    expect(mapClaudeRecord({ type: "user" }, FILE)).toBeNull();
    expect(mapClaudeRecord({ type: "system" }, FILE)).toBeNull();
    expect(mapClaudeRecord({ type: "ai-title" }, FILE)).toBeNull();
    expect(
      mapClaudeRecord({ type: "assistant", isSidechain: true, message: { content: [{ type: "text", text: "x" }] } }, FILE),
    ).toBeNull();
  });
});

describe("connectors over real files (temp fixtures)", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diorama-conn-"));
  });
  afterEach(() => {
    delete process.env.DIORAMA_CODEX_SESSIONS;
    delete process.env.DIORAMA_CLAUDE_PROJECTS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("codex connector tails a session end-to-end", () => {
    const sessionsDir = path.join(tmpDir, "sessions/2026/07/06");
    fs.mkdirSync(sessionsDir, { recursive: true });
    const file = path.join(sessionsDir, "rollout-2026-07-06T10-00-00-aabbccdd.jsonl");
    fs.writeFileSync(file, "");

    const events: DioramaEvent[] = [];
    const handle = connectCodexSessions({
      dir: path.join(tmpDir, "sessions"),
      intervalMs: 60_000,
      onEvent: (e) => events.push(e),
    });
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "session_meta", payload: { cwd: "/p/webapp" } }) +
        "\n" +
        JSON.stringify({ type: "event_msg", payload: { type: "task_started" } }) +
        "\n",
    );
    handle.scan();
    handle.stop();

    expect(events.map((e) => e.type)).toEqual(["session.started", "task.started"]);
    expect(events[1].agent).toBe("codex/webapp");
  });

  it("claude connector tails a transcript end-to-end", () => {
    const projDir = path.join(tmpDir, "projects/-Users-me-my-app");
    fs.mkdirSync(projDir, { recursive: true });
    const file = path.join(projDir, "sess.jsonl");
    fs.writeFileSync(file, "");

    const events: DioramaEvent[] = [];
    const handle = connectClaudeCode({
      dir: path.join(tmpDir, "projects"),
      intervalMs: 60_000,
      onEvent: (e) => events.push(e),
    });
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit" }] } }) + "\n",
    );
    handle.scan();
    handle.stop();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "tool.call", agent: "claude/app" });
  });

  it("detection respects env overrides and age filtering", () => {
    process.env.DIORAMA_CODEX_SESSIONS = path.join(tmpDir, "none");
    process.env.DIORAMA_CLAUDE_PROJECTS = path.join(tmpDir, "none");
    expect(detectCodexSessions().available).toBe(false);
    expect(detectClaudeCode().available).toBe(false);

    const codexDir = path.join(tmpDir, "codex-sessions/2026");
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, "rollout-x.jsonl"), "{}\n");
    process.env.DIORAMA_CODEX_SESSIONS = path.join(tmpDir, "codex-sessions");
    const codex = detectCodexSessions();
    expect(codex).toEqual({ available: true, recentSessions: 1 });

    const claudeDir = path.join(tmpDir, "claude-projects/-Users-me-app");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "s.jsonl"), "{}\n");
    process.env.DIORAMA_CLAUDE_PROJECTS = path.join(tmpDir, "claude-projects");
    expect(detectClaudeCode()).toEqual({ available: true, recentProjects: 1 });
  });
});
