import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCopilotProvider,
  createAnthropicProvider,
  createOpenAICompatProvider,
  type ChatRequest,
} from "./providers";

const TOOLS = [
  { name: "add_room", description: "Add a room", input_schema: { type: "object", properties: {} } },
];

const REQ: ChatRequest = {
  system: "You are a copilot.",
  messages: [{ role: "user", text: "add a lab" }],
  tools: TOOLS,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("anthropic provider", () => {
  it("sends the Messages API shape and parses text + tool_use", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [
          { type: "text", text: "Adding a lab." },
          { type: "tool_use", id: "tc_1", name: "add_room", input: { preset: "lab" } },
        ],
      }),
    );
    const p = createAnthropicProvider({ provider: "anthropic", apiKey: "sk-test" });
    const res = await p.chat(REQ);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-api-key"]).toBe("sk-test");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.system).toBe("You are a copilot.");
    expect(body.tools).toHaveLength(1);
    expect(body.messages[0]).toEqual({ role: "user", content: "add a lab" });

    expect(res.text).toBe("Adding a lab.");
    expect(res.toolCalls).toEqual([{ id: "tc_1", name: "add_room", input: { preset: "lab" } }]);
  });

  it("round-trips tool results as tool_result blocks", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "Done" }] }));
    const p = createAnthropicProvider({ provider: "anthropic", apiKey: "k" });
    await p.chat({
      ...REQ,
      messages: [
        { role: "user", text: "add a lab" },
        { role: "assistant", text: "", toolCalls: [{ id: "tc_1", name: "add_room", input: {} }] },
        { role: "user", toolResults: [{ id: "tc_1", content: "Added Lab" }] },
      ],
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tc_1" });
  });

  it("throws with status on API errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "bad key" }, 401));
    const p = createAnthropicProvider({ provider: "anthropic", apiKey: "bad" });
    await expect(p.chat(REQ)).rejects.toThrow(/Anthropic 401/);
  });
});

describe("openai-compatible provider", () => {
  it("sends chat/completions shape and parses tool_calls", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: "On it.",
              tool_calls: [
                { id: "call_1", function: { name: "add_room", arguments: '{"preset":"lab"}' } },
              ],
            },
          },
        ],
      }),
    );
    const p = createOpenAICompatProvider({ provider: "openai-compatible", apiKey: "sk" });
    const res = await p.chat(REQ);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init as { headers: Record<string, string> }).headers.authorization).toBe("Bearer sk");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a copilot." });
    expect(body.tools[0].function.name).toBe("add_room");

    expect(res.text).toBe("On it.");
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "add_room", input: { preset: "lab" } }]);
  });

  it("tolerates malformed tool arguments", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          { message: { content: null, tool_calls: [{ id: "c", function: { name: "add_room", arguments: "{oops" } }] } },
        ],
      }),
    );
    const p = createOpenAICompatProvider({ provider: "openai-compatible", apiKey: "sk" });
    const res = await p.chat(REQ);
    expect(res.toolCalls[0].input).toEqual({});
  });

  it("respects custom baseUrl", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hi" } }] }));
    const p = createOpenAICompatProvider({
      provider: "openai-compatible",
      apiKey: "sk",
      baseUrl: "https://openrouter.ai/api/v1/",
    });
    await p.chat(REQ);
    expect(fetchMock.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("maps tool results to role:tool messages", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "done" } }] }));
    const p = createOpenAICompatProvider({ provider: "openai-compatible", apiKey: "sk" });
    await p.chat({
      ...REQ,
      messages: [
        { role: "user", text: "add a lab" },
        { role: "assistant", toolCalls: [{ id: "call_1", name: "add_room", input: {} }] },
        { role: "user", toolResults: [{ id: "call_1", content: "Added Lab" }] },
      ],
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    const toolMsg = body.messages.find((m: { role: string }) => m.role === "tool");
    expect(toolMsg).toMatchObject({ tool_call_id: "call_1", content: "Added Lab" });
  });
});

describe("createCopilotProvider factory", () => {
  it("ollama defaults to the local endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hi" } }] }));
    const p = createCopilotProvider({ provider: "ollama" });
    await p.chat(REQ);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("builds each provider kind", () => {
    expect(createCopilotProvider({ provider: "anthropic", apiKey: "k" }).id).toBe("anthropic");
    expect(createCopilotProvider({ provider: "openai-compatible", apiKey: "k" }).id).toBe("openai-compatible");
    expect(createCopilotProvider({ provider: "ollama" }).id).toBe("ollama");
    expect(createCopilotProvider({ provider: "codex-auth", apiKey: "t" }).id).toBe("codex-auth");
  });
});
