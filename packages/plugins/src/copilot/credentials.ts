import fs from "fs";
import path from "path";
import os from "os";
import type { CopilotProviderConfig } from "./providers";

/**
 * Copilot credentials live in ~/.diorama/credentials.json (mode 0600) and
 * are only ever read server-side. The browser sees provider/model status,
 * never the key.
 */

// DIORAMA_HOME overrides the config dir (used by tests and CI sandboxes)
function credentialsDir(): string {
  return process.env.DIORAMA_HOME ?? path.join(os.homedir(), ".diorama");
}

export type StoredCredentials = CopilotProviderConfig;

export function credentialsPath(): string {
  return path.join(credentialsDir(), "credentials.json");
}

export function loadCredentials(): StoredCredentials | null {
  try {
    const raw = fs.readFileSync(credentialsPath(), "utf-8");
    const parsed = JSON.parse(raw) as StoredCredentials;
    if (!parsed.provider) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: StoredCredentials): void {
  fs.mkdirSync(credentialsDir(), { recursive: true });
  fs.writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(credentialsPath(), 0o600);
  } catch {
    // best-effort on non-POSIX systems
  }
}

export function clearCredentials(): void {
  try {
    fs.unlinkSync(credentialsPath());
  } catch {
    // already gone
  }
}

/**
 * Resolve the effective provider config for a chat call. For codex-auth,
 * reads the ChatGPT-subscription access token from the Codex CLI's
 * auth.json at call time (the CLI refreshes it out-of-band, so we always
 * re-read rather than caching).
 */
export function resolveProviderConfig(creds: StoredCredentials): CopilotProviderConfig {
  if (creds.provider !== "codex-auth") return creds;
  const authPath = path.join(os.homedir(), ".codex", "auth.json");
  try {
    const auth = JSON.parse(fs.readFileSync(authPath, "utf-8")) as {
      OPENAI_API_KEY?: string | null;
      tokens?: { access_token?: string };
    };
    const token = auth.tokens?.access_token || auth.OPENAI_API_KEY || "";
    if (!token) throw new Error("no token");
    return { ...creds, apiKey: token };
  } catch {
    throw new Error(
      `codex-auth: could not read a token from ${authPath}. Log in with the Codex CLI first.`,
    );
  }
}

/** Public status shape — safe to send to the browser (no key material). */
export function credentialsStatus(): {
  configured: boolean;
  provider?: string;
  model?: string;
  baseUrl?: string;
} {
  const creds = loadCredentials();
  if (!creds) return { configured: false };
  return {
    configured: true,
    provider: creds.provider,
    model: creds.model,
    baseUrl: creds.baseUrl,
  };
}
