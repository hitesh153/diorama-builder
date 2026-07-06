import fs from "fs";
import os from "os";
import path from "path";
import type { DioramaEvent } from "@diorama/engine";
import { tailJsonlDirectory, type JsonlTailHandle } from "./jsonlTail";

/**
 * Claude Code connector — visualizes Claude Code sessions as Diorama
 * agents by tailing the transcripts under ~/.claude/projects/<slug>/*.jsonl.
 *
 * Each project becomes one agent ("claude/<project>"). Assistant records
 * map to message.sent / tool.call; other record types are ignored.
 */

export function claudeProjectsDir(): string {
  return process.env.DIORAMA_CLAUDE_PROJECTS ?? path.join(os.homedir(), ".claude", "projects");
}

interface ClaudeRecord {
  type?: string;
  timestamp?: string;
  isSidechain?: boolean;
  message?: {
    content?: Array<{ type?: string; name?: string; text?: string }> | string;
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
  if (!rec || typeof rec !== "object" || rec.type !== "assistant") return null;
  if (rec.isSidechain) return null; // subagent chatter — too noisy

  const ts = rec.timestamp ? Date.parse(rec.timestamp) : Date.now();
  const timestamp = Number.isFinite(ts) ? ts : Date.now();
  const agent = agentNameFromProjectPath(filePath);

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
  onEvent: (event: DioramaEvent) => void;
}

export function connectClaudeCode(options: ClaudeCodeConnectorOptions): JsonlTailHandle {
  const dir = options.dir ?? claudeProjectsDir();
  return tailJsonlDirectory({
    dir,
    intervalMs: options.intervalMs ?? 1500,
    onRecord: (record, filePath) => {
      const event = mapClaudeRecord(record, filePath);
      if (event) options.onEvent(event);
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
