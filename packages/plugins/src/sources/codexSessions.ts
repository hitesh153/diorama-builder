import fs from "fs";
import os from "os";
import path from "path";
import type { DioramaEvent } from "@diorama/engine";
import { tailJsonlDirectory, type JsonlTailHandle } from "./jsonlTail";

/**
 * Codex CLI connector — visualizes Codex sessions as Diorama agents by
 * tailing the rollout files the CLI writes to ~/.codex/sessions/**.jsonl.
 *
 * Each session file becomes one agent, named after the project directory
 * the session ran in (from its session_meta record). Events are normalized
 * to generic types (task.started, message.sent, tool.call, task.completed)
 * so the standard activity derivation applies.
 */

export function codexSessionsDir(): string {
  return process.env.DIORAMA_CODEX_SESSIONS ?? path.join(os.homedir(), ".codex", "sessions");
}

interface CodexRecord {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    cwd?: string;
    message?: string;
    name?: string;
    [key: string]: unknown;
  };
}

/** Per-file agent naming state (session_meta carries the cwd). */
export interface CodexFileState {
  agent: string;
}

export function agentNameFromCwd(cwd: string | undefined, filePath: string): string {
  if (cwd) {
    const base = path.basename(cwd);
    if (base) return `codex/${base}`;
  }
  // Fallback: shortened session id from the filename
  const m = path.basename(filePath).match(/rollout-.*-([0-9a-f]{4,8})/);
  return `codex/${m?.[1] ?? "session"}`;
}

/**
 * Map one Codex rollout record to a DioramaEvent, or null for records that
 * aren't agent activity (reasoning, token counts, context…). Pure.
 */
export function mapCodexRecord(
  record: unknown,
  state: CodexFileState,
  filePath: string,
): DioramaEvent | null {
  const rec = record as CodexRecord;
  if (!rec || typeof rec !== "object" || !rec.type) return null;

  const ts = rec.timestamp ? Date.parse(rec.timestamp) : Date.now();
  const timestamp = Number.isFinite(ts) ? ts : Date.now();
  const p = rec.payload ?? {};

  if (rec.type === "session_meta") {
    state.agent = agentNameFromCwd(typeof p.cwd === "string" ? p.cwd : undefined, filePath);
    return {
      type: "session.started",
      room: "",
      agent: state.agent,
      payload: { source: "codex", label: "started a session" },
      timestamp,
    };
  }

  const make = (type: string, label: string, extra: Record<string, unknown> = {}): DioramaEvent => ({
    type,
    room: "",
    agent: state.agent,
    payload: { source: "codex", label, ...extra },
    timestamp,
  });

  if (rec.type === "event_msg") {
    switch (p.type) {
      case "task_started":
        return make("task.started", "started a task");
      case "agent_message":
        return make("message.sent", "replied", {
          preview: typeof p.message === "string" ? p.message.slice(0, 80) : undefined,
        });
      case "web_search_end":
        return make("search.completed", "searched the web");
      case "task_complete":
        return make("task.completed", "completed a task");
      default:
        return null;
    }
  }

  if (rec.type === "response_item") {
    switch (p.type) {
      case "function_call":
      case "custom_tool_call":
      case "local_shell_call":
        return make("tool.call", `used ${typeof p.name === "string" ? p.name : "a tool"}`);
      default:
        return null;
    }
  }

  return null;
}

export interface CodexConnectorOptions {
  dir?: string;
  intervalMs?: number;
  onEvent: (event: DioramaEvent) => void;
}

export function connectCodexSessions(options: CodexConnectorOptions): JsonlTailHandle {
  const dir = options.dir ?? codexSessionsDir();
  const states = new Map<string, CodexFileState>();
  return tailJsonlDirectory({
    dir,
    intervalMs: options.intervalMs ?? 1500,
    onRecord: (record, filePath) => {
      let state = states.get(filePath);
      if (!state) {
        state = { agent: agentNameFromCwd(undefined, filePath) };
        states.set(filePath, state);
      }
      const event = mapCodexRecord(record, state, filePath);
      if (event) options.onEvent(event);
    },
  });
}

/** Detection for the wizard: are there recent Codex sessions on this machine? */
export function detectCodexSessions(maxAgeMs = 7 * 24 * 60 * 60 * 1000): {
  available: boolean;
  recentSessions: number;
} {
  const dir = codexSessionsDir();
  let count = 0;
  const now = Date.now();
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".jsonl")) {
        try {
          if (now - fs.statSync(full).mtimeMs <= maxAgeMs) count++;
        } catch {
          // unreadable file — skip
        }
      }
    }
  };
  walk(dir);
  return { available: count > 0, recentSessions: count };
}
