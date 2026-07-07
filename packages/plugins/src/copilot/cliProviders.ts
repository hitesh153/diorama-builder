import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type {
  ChatRequest,
  ChatResponse,
  CopilotProvider,
  CopilotProviderConfig,
  ProviderToolCall,
} from "./providers";

/**
 * Local-CLI copilot providers — "use the coding agent you already have".
 *
 * Instead of API keys, these spawn the user's own `claude` (Claude Code) or
 * `codex` (Codex CLI) binaries in non-interactive mode. Auth, billing, and
 * model access are whatever the user's CLI login already has.
 *
 * The CLIs have no native tool-call API, so tools ride in the prompt: the
 * model is asked to answer with a strict JSON envelope
 * `{"text": "...", "toolCalls": [{"name","input"}]}` which we parse.
 *
 * SERVER-SIDE ONLY (child_process) — import via deep path, never from the
 * plugins barrel.
 */

const CLI_TIMEOUT_MS = 180_000;

// ---------------------------------------------------------------------------
// Prompt building + response parsing (pure — unit-tested)
// ---------------------------------------------------------------------------

export function buildCliPrompt(req: ChatRequest): string {
  const lines: string[] = [req.system, ""];

  if (req.tools.length > 0) {
    lines.push(
      "You can perform actions by emitting tool calls. Available tools:",
      "",
    );
    for (const tool of req.tools) {
      lines.push(`- ${tool.name}: ${tool.description}`);
      lines.push(`  input schema: ${JSON.stringify(tool.input_schema)}`);
    }
    lines.push(
      "",
      "RESPONSE FORMAT — reply with ONLY a JSON object, no markdown fences, no prose outside it:",
      '{"text": "<short message to the user>", "toolCalls": [{"name": "<tool>", "input": {…}}]}',
      'Use "toolCalls": [] when no action is needed. Multiple calls are allowed and run in order.',
      "",
    );
  }

  lines.push("Conversation so far:");
  for (const turn of req.messages) {
    if (turn.role === "user") {
      if (turn.toolResults?.length) {
        for (const result of turn.toolResults) {
          lines.push(`[tool result ${result.id}] ${result.content}`);
        }
      }
      if (turn.text) lines.push(`User: ${turn.text}`);
    } else {
      if (turn.text) lines.push(`Assistant: ${turn.text}`);
      for (const call of turn.toolCalls ?? []) {
        lines.push(`[assistant called ${call.name} (${call.id}) with ${JSON.stringify(call.input)}]`);
      }
    }
  }
  lines.push("", "Respond now as the assistant.");
  return lines.join("\n");
}

/** Extract the first balanced JSON object from raw model output. */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

export function parseCliResponse(raw: string): ChatResponse {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const jsonText = extractJsonObject(cleaned);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as {
        text?: unknown;
        toolCalls?: Array<{ name?: unknown; input?: unknown }>;
      };
      if (typeof parsed.text === "string" || Array.isArray(parsed.toolCalls)) {
        const toolCalls: ProviderToolCall[] = (parsed.toolCalls ?? [])
          .filter((c) => typeof c?.name === "string")
          .map((c, i) => ({
            id: `cli_${i + 1}`,
            name: c.name as string,
            input: (c.input && typeof c.input === "object" ? c.input : {}) as Record<string, unknown>,
          }));
        return { text: typeof parsed.text === "string" ? parsed.text : "", toolCalls };
      }
    } catch {
      // fall through to plain-text handling
    }
  }
  // Model ignored the contract — treat the whole output as text.
  return { text: cleaned, toolCalls: [] };
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: options.timeoutMs ?? CLI_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr || stdout || err.message).toString().slice(0, 400);
          reject(new Error(`${command} failed: ${detail}`));
        } else {
          resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
        }
      },
    );
  });
}

export function createClaudeCliProvider(cfg: CopilotProviderConfig): CopilotProvider {
  const binary = cfg.baseUrl || resolveBinary("claude") || "claude"; // baseUrl doubles as a binary-path override
  return {
    id: "claude-cli",
    async chat(req) {
      const prompt = buildCliPrompt(req);
      const args = ["-p", prompt, "--output-format", "json"];
      if (cfg.model) args.push("--model", cfg.model);
      const { stdout } = await run(binary, args);
      let result = stdout;
      try {
        const envelope = JSON.parse(stdout) as { result?: string; is_error?: boolean; subtype?: string };
        if (envelope.is_error) throw new Error(`claude CLI error: ${envelope.subtype ?? "unknown"}`);
        result = envelope.result ?? "";
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("claude CLI error")) throw err;
        // Non-JSON stdout — parse it directly below.
      }
      return parseCliResponse(result);
    },
  };
}

export function createCodexCliProvider(cfg: CopilotProviderConfig): CopilotProvider {
  const binary = cfg.baseUrl || resolveBinary("codex") || "codex";
  return {
    id: "codex-cli",
    async chat(req) {
      const prompt = buildCliPrompt(req);
      const outFile = path.join(
        os.tmpdir(),
        `diorama-codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`,
      );
      const args = ["exec", "--skip-git-repo-check", "-s", "read-only", "-o", outFile];
      if (cfg.model) args.push("-m", cfg.model);
      args.push(prompt);
      try {
        await run(binary, args);
        const result = fs.readFileSync(outFile, "utf-8");
        return parseCliResponse(result);
      } finally {
        try {
          fs.unlinkSync(outFile);
        } catch {
          // already gone
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Detection (for the settings card)
// ---------------------------------------------------------------------------

/** Full path of a binary, searching PATH plus common install dirs GUI-launched processes miss. */
export function resolveBinary(name: string): string | null {
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter);
  pathDirs.push(path.join(os.homedir(), ".local", "bin"), "/usr/local/bin", "/opt/homebrew/bin");
  for (const dir of pathDirs) {
    if (!dir) continue;
    const full = path.join(dir, name);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch {
      // keep looking
    }
  }
  return null;
}

export function detectCliProviders(): { claude: boolean; codex: boolean } {
  return { claude: resolveBinary("claude") !== null, codex: resolveBinary("codex") !== null };
}
