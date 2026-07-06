import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { codexSessionsDir } from "@diorama/plugins/sources/codexSessions";
import { claudeProjectsDir } from "@diorama/plugins/sources/claudeCode";

export const dynamic = "force-dynamic";

/**
 * Agent roster for local sources — the agent names that will appear in the
 * world, derived the same way the connectors derive them (project names).
 * ?types=codex,claude-code
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const types = new Set(
    (url.searchParams.get("types") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const agents: string[] = [];

  if (types.has("codex")) {
    // Agent per recently-active project — read cwd from each session_meta head line
    const seen = new Set<string>();
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".jsonl")) {
          try {
            if (now - fs.statSync(full).mtimeMs > maxAgeMs) continue;
            const head = fs.readFileSync(full, "utf-8").slice(0, 4096).split("\n")[0];
            const meta = JSON.parse(head) as { type?: string; payload?: { cwd?: string } };
            if (meta.type === "session_meta" && meta.payload?.cwd) {
              seen.add(`codex/${path.basename(meta.payload.cwd)}`);
            }
          } catch {
            // unreadable/partial head — skip
          }
        }
      }
    };
    walk(codexSessionsDir());
    agents.push(...seen);
  }

  if (types.has("claude-code")) {
    const dir = claudeProjectsDir();
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      // no claude dir
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectDir = path.join(dir, entry.name);
      let recent = false;
      try {
        recent = fs
          .readdirSync(projectDir)
          .filter((f) => f.endsWith(".jsonl"))
          .some((f) => now - fs.statSync(path.join(projectDir, f)).mtimeMs <= maxAgeMs);
      } catch {
        continue;
      }
      if (recent) {
        const parts = entry.name.split("-").filter(Boolean);
        agents.push(`claude/${parts[parts.length - 1] ?? "project"}`);
      }
    }
  }

  return NextResponse.json({ agents: [...new Set(agents)].sort() });
}
