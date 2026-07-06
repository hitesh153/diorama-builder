/**
 * LLM provider adapters for the Diorama copilot. Bring-your-own-LLM:
 * every provider implements the same minimal chat contract, so the
 * copilot works with an Anthropic key, any OpenAI-compatible endpoint
 * (OpenAI, OpenRouter, Groq, LM Studio, vLLM…), a local Ollama, or a
 * ChatGPT-subscription token from the Codex CLI.
 *
 * Dependency-free (fetch only). Server-side ONLY — keys never reach the
 * browser; the app's /api/copilot/chat route calls this.
 */

export interface ProviderToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text?: string;
  /** Assistant turns may carry tool calls */
  toolCalls?: ProviderToolCall[];
  /** User turns may carry results for the previous assistant tool calls */
  toolResults?: Array<{ id: string; content: string }>;
}

export interface ChatRequest {
  system: string;
  messages: ChatTurn[];
  tools: ProviderToolDef[];
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  toolCalls: ProviderToolCall[];
}

export interface CopilotProviderConfig {
  provider: "anthropic" | "openai-compatible" | "ollama" | "codex-auth";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface CopilotProvider {
  id: CopilotProviderConfig["provider"];
  chat(req: ChatRequest): Promise<ChatResponse>;
}

class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

// ---------------------------------------------------------------------------
// Anthropic Messages API
// ---------------------------------------------------------------------------

const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";

function anthropicMessages(messages: ChatTurn[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant") {
      const content: unknown[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const tc of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      return { role: "assistant", content };
    }
    // user turn — may carry tool results
    if (m.toolResults?.length) {
      return {
        role: "user",
        content: [
          ...m.toolResults.map((r) => ({
            type: "tool_result",
            tool_use_id: r.id,
            content: r.content,
          })),
          ...(m.text ? [{ type: "text", text: m.text }] : []),
        ],
      };
    }
    return { role: "user", content: m.text ?? "" };
  });
}

export function createAnthropicProvider(cfg: CopilotProviderConfig): CopilotProvider {
  const baseUrl = (cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const model = cfg.model || ANTHROPIC_DEFAULT_MODEL;
  return {
    id: "anthropic",
    async chat(req) {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens ?? 2048,
          system: req.system,
          messages: anthropicMessages(req.messages),
          ...(req.tools.length ? { tools: req.tools } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ProviderError(`Anthropic ${res.status}: ${body.slice(0, 300)}`, res.status);
      }
      const data = (await res.json()) as {
        content: Array<
          | { type: "text"; text: string }
          | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
        >;
      };
      const text = data.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");
      const toolCalls = data.content
        .filter((b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, input: b.input }));
      return { text, toolCalls };
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible chat/completions (OpenAI, OpenRouter, Groq, vLLM, Ollama…)
// ---------------------------------------------------------------------------

const OPENAI_DEFAULT_MODEL = "gpt-5";

function openaiMessages(system: string, messages: ChatTurn[]): unknown[] {
  const out: unknown[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.text ?? null,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.input) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of m.toolResults ?? []) {
        out.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
      if (m.text || !m.toolResults?.length) {
        out.push({ role: "user", content: m.text ?? "" });
      }
    }
  }
  return out;
}

export function createOpenAICompatProvider(
  cfg: CopilotProviderConfig,
  id: CopilotProviderConfig["provider"] = "openai-compatible",
): CopilotProvider {
  const baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = cfg.model || OPENAI_DEFAULT_MODEL;
  return {
    id,
    async chat(req) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: openaiMessages(req.system, req.messages),
          ...(req.tools.length
            ? {
                tools: req.tools.map((t) => ({
                  type: "function",
                  function: { name: t.name, description: t.description, parameters: t.input_schema },
                })),
              }
            : {}),
          max_tokens: req.maxTokens ?? 2048,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ProviderError(`${id} ${res.status}: ${body.slice(0, 300)}`, res.status);
      }
      const data = (await res.json()) as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
          };
        }>;
      };
      const msg = data.choices?.[0]?.message;
      const toolCalls: ProviderToolCall[] = (msg?.tool_calls ?? []).map((tc) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments || "{}");
        } catch {
          // tolerate malformed JSON args — pass empty input
        }
        return { id: tc.id, name: tc.function.name, input };
      });
      return { text: msg?.content ?? "", toolCalls };
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const PROVIDER_LABELS: Record<CopilotProviderConfig["provider"], string> = {
  anthropic: "Anthropic (Claude)",
  "openai-compatible": "OpenAI-compatible (OpenAI, OpenRouter, Groq…)",
  ollama: "Ollama (local)",
  "codex-auth": "Codex CLI login (ChatGPT subscription)",
};

/**
 * Build a provider from config. For `ollama`, baseUrl defaults to the local
 * server; for `codex-auth` the caller must pre-resolve the token from
 * ~/.codex/auth.json into cfg.apiKey (see credentials.ts).
 */
export function createCopilotProvider(cfg: CopilotProviderConfig): CopilotProvider {
  switch (cfg.provider) {
    case "anthropic":
      return createAnthropicProvider(cfg);
    case "openai-compatible":
      return createOpenAICompatProvider(cfg);
    case "ollama":
      return createOpenAICompatProvider(
        { ...cfg, baseUrl: cfg.baseUrl ?? "http://localhost:11434/v1", model: cfg.model || "llama3.1" },
        "ollama",
      );
    case "codex-auth":
      return createOpenAICompatProvider(cfg, "codex-auth");
    default:
      throw new ProviderError(`Unknown provider "${(cfg as { provider: string }).provider}"`);
  }
}
