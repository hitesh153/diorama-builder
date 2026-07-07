import { describe, it, expect } from "vitest";
import { buildCliPrompt, parseCliResponse, detectCliProviders, resolveBinary } from "./cliProviders";
import type { ChatRequest } from "./providers";

const REQ: ChatRequest = {
  system: "You are a copilot.",
  messages: [
    { role: "user", text: "add a lab" },
    { role: "assistant", text: "Sure.", toolCalls: [{ id: "cli_1", name: "add_room", input: { preset: "lab" } }] },
    { role: "user", toolResults: [{ id: "cli_1", content: "Added Lab (4×4) at (0, 0)" }] },
  ],
  tools: [
    { name: "add_room", description: "Add a room", input_schema: { type: "object", properties: {} } },
  ],
};

describe("buildCliPrompt", () => {
  it("includes system, tools, response contract, and transcript", () => {
    const prompt = buildCliPrompt(REQ);
    expect(prompt).toContain("You are a copilot.");
    expect(prompt).toContain("- add_room: Add a room");
    expect(prompt).toContain('"toolCalls"');
    expect(prompt).toContain("User: add a lab");
    expect(prompt).toContain("[assistant called add_room (cli_1)");
    expect(prompt).toContain("[tool result cli_1] Added Lab");
  });

  it("omits the tool contract when no tools", () => {
    const prompt = buildCliPrompt({ ...REQ, tools: [] });
    expect(prompt).not.toContain("RESPONSE FORMAT");
  });
});

describe("parseCliResponse", () => {
  it("parses a clean JSON envelope", () => {
    const res = parseCliResponse('{"text":"On it","toolCalls":[{"name":"add_room","input":{"preset":"lab"}}]}');
    expect(res.text).toBe("On it");
    expect(res.toolCalls).toEqual([{ id: "cli_1", name: "add_room", input: { preset: "lab" } }]);
  });

  it("strips markdown fences and surrounding prose", () => {
    const raw = 'Here you go:\n```json\n{"text":"Done","toolCalls":[]}\n```\nAnything else?';
    const res = parseCliResponse(raw);
    expect(res.text).toBe("Done");
    expect(res.toolCalls).toEqual([]);
  });

  it("handles nested braces and strings with braces", () => {
    const raw = '{"text":"a {tricky} one","toolCalls":[{"name":"rename_room","input":{"room":"Lab","new_label":"R{&}D"}}]}';
    const res = parseCliResponse(raw);
    expect(res.text).toBe("a {tricky} one");
    expect(res.toolCalls[0].input).toEqual({ room: "Lab", new_label: "R{&}D" });
  });

  it("falls back to plain text when the contract is ignored", () => {
    const res = parseCliResponse("I added the lab for you!");
    expect(res.text).toBe("I added the lab for you!");
    expect(res.toolCalls).toEqual([]);
  });

  it("drops malformed tool entries but keeps valid ones", () => {
    const res = parseCliResponse('{"text":"ok","toolCalls":[{"input":{}},{"name":"add_room"}]}');
    expect(res.toolCalls).toEqual([{ id: "cli_1", name: "add_room", input: {} }]);
  });
});

describe("detection", () => {
  it("returns booleans and resolves real binaries to absolute paths", () => {
    const clis = detectCliProviders();
    expect(typeof clis.claude).toBe("boolean");
    expect(typeof clis.codex).toBe("boolean");
    const sh = resolveBinary("sh");
    expect(sh).toMatch(/^\//);
    expect(resolveBinary("definitely-not-a-real-binary-xyz")).toBeNull();
  });
});
