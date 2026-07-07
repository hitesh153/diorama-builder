import { createCopilotProvider, type CopilotProvider, type CopilotProviderConfig } from "./providers";
import { createClaudeCliProvider, createCodexCliProvider } from "./cliProviders";

/**
 * Server-side provider factory — the ONLY place that can build every
 * provider kind, including the local-CLI ones (child_process). API routes
 * use this; the browser only ever sees providers.ts (labels/types).
 */
export function createProvider(cfg: CopilotProviderConfig): CopilotProvider {
  switch (cfg.provider) {
    case "claude-cli":
      return createClaudeCliProvider(cfg);
    case "codex-cli":
      return createCodexCliProvider(cfg);
    default:
      return createCopilotProvider(cfg);
  }
}
