import { NextResponse } from "next/server";
import { detectCodexSessions } from "@diorama/plugins/sources/codexSessions";
import { detectClaudeCode } from "@diorama/plugins/sources/claudeCode";

export const dynamic = "force-dynamic";

/**
 * "Detect my agents" — scans this machine for known agent runtimes so the
 * wizard can offer one-click connections.
 */
export async function GET() {
  const codex = detectCodexSessions();
  const claude = detectClaudeCode();
  return NextResponse.json({
    sources: [
      {
        type: "codex",
        label: "Codex CLI",
        available: codex.available,
        detail: codex.available
          ? `${codex.recentSessions} session${codex.recentSessions === 1 ? "" : "s"} this week`
          : "no recent sessions found",
      },
      {
        type: "claude-code",
        label: "Claude Code",
        available: claude.available,
        detail: claude.available
          ? `${claude.recentProjects} active project${claude.recentProjects === 1 ? "" : "s"}`
          : "no recent projects found",
      },
      {
        type: "ingest",
        label: "Push events (HTTP)",
        available: true,
        detail: "POST /api/ingest — works with anything",
      },
    ],
  });
}
