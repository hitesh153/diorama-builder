import { NextResponse } from "next/server";
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  credentialsStatus,
} from "@diorama/plugins/copilot/credentials";
import type { CopilotProviderConfig } from "@diorama/plugins/copilot/providers";
import { detectCliProviders } from "@diorama/plugins/copilot/cliProviders";

export async function GET() {
  return NextResponse.json({ ...credentialsStatus(), clis: detectCliProviders() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CopilotProviderConfig>;
    if (!body.provider) {
      return NextResponse.json({ error: "provider is required" }, { status: 400 });
    }
    const existing = loadCredentials();
    // Merge: keep the stored key when the form left it blank for the same provider
    const apiKey =
      body.apiKey && body.apiKey.trim()
        ? body.apiKey.trim()
        : existing?.provider === body.provider
          ? existing.apiKey
          : undefined;
    saveCredentials({
      provider: body.provider,
      ...(apiKey ? { apiKey } : {}),
      ...(body.baseUrl?.trim() ? { baseUrl: body.baseUrl.trim() } : {}),
      ...(body.model?.trim() ? { model: body.model.trim() } : {}),
    });
    return NextResponse.json(credentialsStatus());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE() {
  clearCredentials();
  return NextResponse.json({ configured: false });
}
