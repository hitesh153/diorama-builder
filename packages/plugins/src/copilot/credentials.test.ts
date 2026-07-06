import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  credentialsPath,
  credentialsStatus,
  resolveProviderConfig,
} from "./credentials";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diorama-creds-"));
  process.env.DIORAMA_HOME = tmpDir;
});

afterEach(() => {
  delete process.env.DIORAMA_HOME;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("credentials storage", () => {
  it("round-trips credentials with 0600 mode", () => {
    saveCredentials({ provider: "anthropic", apiKey: "sk-secret", model: "claude-sonnet-5" });
    const loaded = loadCredentials();
    expect(loaded).toMatchObject({ provider: "anthropic", apiKey: "sk-secret" });
    const mode = fs.statSync(credentialsPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("returns null when nothing stored", () => {
    expect(loadCredentials()).toBeNull();
  });

  it("clearCredentials removes the file", () => {
    saveCredentials({ provider: "ollama" });
    clearCredentials();
    expect(loadCredentials()).toBeNull();
  });

  it("status never exposes the key", () => {
    saveCredentials({ provider: "anthropic", apiKey: "sk-secret", model: "m" });
    const status = credentialsStatus();
    expect(status).toEqual({ configured: true, provider: "anthropic", model: "m", baseUrl: undefined });
    expect(JSON.stringify(status)).not.toContain("sk-secret");
  });
});

describe("resolveProviderConfig", () => {
  it("passes non-codex configs through", () => {
    const cfg = { provider: "anthropic" as const, apiKey: "k" };
    expect(resolveProviderConfig(cfg)).toBe(cfg);
  });

  it("throws a helpful error when codex auth.json is missing", () => {
    // point HOME at the temp dir so ~/.codex/auth.json is absent
    const prevHome = process.env.HOME;
    process.env.HOME = tmpDir;
    try {
      expect(() => resolveProviderConfig({ provider: "codex-auth" })).toThrow(/Codex CLI/);
    } finally {
      process.env.HOME = prevHome;
    }
  });
});
