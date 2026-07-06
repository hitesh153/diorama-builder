import { NextResponse } from "next/server";
import {
  loadCredentials,
  resolveProviderConfig,
} from "@diorama/plugins/copilot/credentials";
import { createCopilotProvider } from "@diorama/plugins/copilot/providers";

export async function POST() {
  const creds = loadCredentials();
  if (!creds) {
    return NextResponse.json({ ok: false, error: "not_configured" });
  }
  try {
    const provider = createCopilotProvider(resolveProviderConfig(creds));
    await provider.chat({
      system: "Reply with OK",
      messages: [{ role: "user", text: "ping" }],
      tools: [],
      maxTokens: 8,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
