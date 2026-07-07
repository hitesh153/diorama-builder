import fs from "fs";
import os from "os";
import path from "path";
import type { DioramaEvent } from "@diorama/engine";
import { tailJsonlDirectory, type JsonlTailHandle } from "./jsonlTail";
import {
  ATTENTION_THRESHOLD_MS,
  createAttentionState,
  detectAttention,
  noteRecord,
  type AttentionCause,
  type AttentionState,
} from "./attention";

/**
 * Claude Code connector — visualizes Claude Code sessions as Diorama
 * agents by tailing the transcripts under ~/.claude/projects/<slug>/*.jsonl.
 *
 * Each project becomes one agent ("claude/<project>"). Assistant records
 * map to message.sent / tool.call; other record types are ignored.
 *
 * Attention ("the agent needs you"): an assistant record whose content ends
 * in a tool_use block is normally followed by the tool_result within
 * seconds. When nothing follows for ATTENTION_THRESHOLD_MS, the session is
 * blocked on the user — a permission prompt, AskUserQuestion, or plan
 * approval — and we emit attention.requested / attention.resolved.
 */

export function claudeProjectsDir(): string {
  return process.env.DIORAMA_CLAUDE_PROJECTS ?? path.join(os.homedir(), ".claude", "projects");
}

interface ClaudeRecord {
  type?: string;
  subtype?: string;
  timestamp?: string;
  isSidechain?: boolean;
  message?: {
    content?: Array<{ type?: string; name?: string; text?: string }> | string;
  };
}

/** Tools that always hand control to the user (never plain latency). */
const USER_FACING_TOOLS: Record<string, string> = {
  AskUserQuestion: "waiting for your answer",
  ExitPlanMode: "waiting for plan approval",
};

/**
 * Is this record the blocked-on-user signature? An assistant record whose
 * message content ENDS in a tool_use block — the paired tool_result record
 * only appears after the tool runs, which for a permission prompt means
 * after the user approves. Pure; exported for tests.
 */
export function claudeBlockingSignature(record: unknown): AttentionCause | null {
  const rec = record as ClaudeRecord;
  if (!rec || typeof rec !== "object" || rec.type !== "assistant") return null;
  if (rec.isSidechain) return null;
  const content = rec.message?.content;
  if (!Array.isArray(content) || content.length === 0) return null;
  const last = content[content.length - 1];
  if (last?.type !== "tool_use") return null;
  const tool = last.name ?? "a tool";
  return {
    label: USER_FACING_TOOLS[tool] ?? "waiting for your approval",
    reason: `${tool} call pending`,
  };
}

/** "…/projects/-Users-me-Desktop-my-app/<session>.jsonl" → "claude/my-app" */
export function agentNameFromProjectPath(filePath: string): string {
  const slug = path.basename(path.dirname(filePath));
  const parts = slug.split("-").filter(Boolean);
  return `claude/${parts[parts.length - 1] ?? "project"}`;
}

/** Map one Claude Code transcript record to a DioramaEvent, or null. Pure. */
export function mapClaudeRecord(record: unknown, filePath: string): DioramaEvent | null {
  const rec = record as ClaudeRecord;
  if (!rec || typeof rec !== "object") return null;

  const ts = rec.timestamp ? Date.parse(rec.timestamp) : Date.now();
  const timestamp = Number.isFinite(ts) ? ts : Date.now();
  const agent = agentNameFromProjectPath(filePath);

  // turn_duration is written when a turn ends — the session is idle,
  // waiting for the user's next prompt.
  if (rec.type === "system" && rec.subtype === "turn_duration") {
    return {
      type: "session.idle",
      room: "",
      agent,
      payload: { source: "claude-code", label: "finished a turn" },
      timestamp,
    };
  }

  if (rec.type !== "assistant") return null;
  if (rec.isSidechain) return null; // subagent chatter — too noisy

  const content = rec.message?.content;
  if (Array.isArray(content)) {
    const toolUse = content.find((b) => b?.type === "tool_use");
    if (toolUse) {
      return {
        type: "tool.call",
        room: "",
        agent,
        payload: { source: "claude-code", label: `used ${toolUse.name ?? "a tool"}` },
        timestamp,
      };
    }
    const text = content.find((b) => b?.type === "text");
    if (text?.text) {
      return {
        type: "message.sent",
        room: "",
        agent,
        payload: { source: "claude-code", label: "replied", preview: text.text.slice(0, 80) },
        timestamp,
      };
    }
  }
  return null;
}

export interface ClaudeCodeConnectorOptions {
  dir?: string;
  intervalMs?: number;
  /** How long a blocking record must sit unanswered before attention.requested (tests). */
  attentionThresholdMs?: number;
  onEvent: (event: DioramaEvent) => void;
}

export function connectClaudeCode(options: ClaudeCodeConnectorOptions): JsonlTailHandle {
  const dir = options.dir ?? claudeProjectsDir();
  const thresholdMs = options.attentionThresholdMs ?? ATTENTION_THRESHOLD_MS;
  const attention = new Map<string, AttentionState>();

  return tailJsonlDirectory({
    dir,
    intervalMs: options.intervalMs ?? 1500,
    onRecord: (record, filePath) => {
      const now = Date.now();
      let att = attention.get(filePath);
      if (!att) {
        att = createAttentionState(now);
        attention.set(filePath, att);
      }
      // Any new record ends a previously-announced block on this file.
      if (noteRecord(att, claudeBlockingSignature(record), now) === "resolved") {
        options.onEvent({
          type: "attention.resolved",
          room: "",
          agent: agentNameFromProjectPath(filePath),
          payload: { source: "claude-code", label: "resumed" },
          timestamp: now,
        });
      }
      const event = mapClaudeRecord(record, filePath);
      if (event) options.onEvent(event);
    },
    onScan: () => {
      const now = Date.now();
      for (const [filePath, att] of attention) {
        if (detectAttention(att, now, thresholdMs) === "pending" && att.pending) {
          options.onEvent({
            type: "attention.requested",
            room: "",
            agent: agentNameFromProjectPath(filePath),
            payload: {
              source: "claude-code",
              label: att.pending.label,
              reason: att.pending.reason,
            },
            timestamp: now,
          });
        }
      }
    },
  });
}

/** Detection for the wizard: recent Claude Code activity on this machine? */
export function detectClaudeCode(maxAgeMs = 7 * 24 * 60 * 60 * 1000): {
  available: boolean;
  recentProjects: number;
} {
  const dir = claudeProjectsDir();
  const now = Date.now();
  const projects = new Set<string>();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { available: false, recentProjects: 0 };
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = path.join(dir, entry.name);
    let files: string[];
    try {
      files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        if (now - fs.statSync(path.join(projectDir, file)).mtimeMs <= maxAgeMs) {
          projects.add(entry.name);
          break;
        }
      } catch {
        // unreadable — skip
      }
    }
  }
  return { available: projects.size > 0, recentProjects: projects.size };
}
