import { NextResponse } from "next/server";
import {
  loadCredentials,
  resolveProviderConfig,
} from "@diorama/plugins/copilot/credentials";
import type { ChatTurn } from "@diorama/plugins/copilot/providers";
import { createProvider } from "@diorama/plugins/copilot/factory";
import { COPILOT_TOOLS } from "@diorama/ui/src/copilotTools";

export async function POST(request: Request) {
  const creds = loadCredentials();
  if (!creds) {
    return NextResponse.json({ error: "not_configured" }, { status: 400 });
  }

  let body: { messages: ChatTurn[]; system: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || typeof body.system !== "string") {
    return NextResponse.json({ error: "messages[] and system are required" }, { status: 400 });
  }

  try {
    const provider = createProvider(resolveProviderConfig(creds));
    const res = await provider.chat({
      system: body.system,
      messages: body.messages,
      tools: COPILOT_TOOLS,
    });
    return NextResponse.json(res);
  } catch (err) {
    // Provider errors carry useful messages (bad key, model name, quota…)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
