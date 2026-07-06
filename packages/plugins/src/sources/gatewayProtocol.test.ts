import { describe, it, expect } from "vitest";
import {
  createConnectRequest,
  generateDeviceIdentity,
  parseFrame,
  serializeFrame,
  isEventFrame,
  isResponseFrame,
  type EventFrame,
  type ResponseFrame,
  type RequestFrame,
} from "./gatewayProtocol";

describe("serializeFrame", () => {
  it("serializes a request frame to JSON", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "test-123",
      method: "connect",
      params: { token: "abc" },
    };
    const json = serializeFrame(frame);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("req");
    expect(parsed.id).toBe("test-123");
    expect(parsed.method).toBe("connect");
  });
});

describe("parseFrame", () => {
  it("parses an event frame", () => {
    const raw = JSON.stringify({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "abc123" },
      seq: 1,
    });
    const frame = parseFrame(raw);
    expect(frame.type).toBe("event");
    expect(isEventFrame(frame)).toBe(true);
    expect((frame as EventFrame).event).toBe("connect.challenge");
    expect((frame as EventFrame).payload.nonce).toBe("abc123");
  });

  it("parses a response frame (ok)", () => {
    const raw = JSON.stringify({
      type: "res",
      id: "req-1",
      ok: true,
      payload: { type: "hello-ok", protocol: 3 },
    });
    const frame = parseFrame(raw);
    expect(frame.type).toBe("res");
    expect(isResponseFrame(frame)).toBe(true);
    expect((frame as ResponseFrame).ok).toBe(true);
  });

  it("parses a response frame (error)", () => {
    const raw = JSON.stringify({
      type: "res",
      id: "req-1",
      ok: false,
      error: { code: "auth.failed", message: "Bad token" },
    });
    const frame = parseFrame(raw);
    expect(isResponseFrame(frame)).toBe(true);
    expect((frame as ResponseFrame).ok).toBe(false);
    expect((frame as ResponseFrame).error?.code).toBe("auth.failed");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseFrame("not json")).toThrow();
  });

  it("throws on missing type field", () => {
    expect(() => parseFrame(JSON.stringify({ foo: "bar" }))).toThrow();
  });
});

describe("createConnectRequest", () => {
  it("creates a connect request with token auth", async () => {
    const req = await createConnectRequest({ token: "localdev", nonce: "abc" });
    expect(req.type).toBe("req");
    expect(req.method).toBe("connect");
    expect(req.params.auth.token).toBe("localdev");
    expect(req.params.role).toBe("operator");
    expect(req.params.client.id).toBe("openclaw-control-ui");
  });

  it("token-only auth has no device field", async () => {
    const req = await createConnectRequest({ token: "test", nonce: "xyz" });
    expect(req.params.device).toBeUndefined();
    expect(req.params.auth.token).toBe("test");
  });

  it("generates a unique request id", async () => {
    const req1 = await createConnectRequest({ token: "a", nonce: "1" });
    const req2 = await createConnectRequest({ token: "a", nonce: "2" });
    expect(req1.id).not.toBe(req2.id);
  });

  it("includes device auth when device identity provided", async () => {
    const device = await generateDeviceIdentity();
    const req = await createConnectRequest({ token: "test", nonce: "abc", device });
    expect(req.params.device).toBeDefined();
    const d = req.params.device as Record<string, unknown>;
    expect(d.id).toBe(device.deviceId);
    expect(typeof d.publicKey).toBe("string");
    expect(typeof d.signature).toBe("string");
  });
});

describe("isEventFrame / isResponseFrame", () => {
  it("correctly identifies event frames", () => {
    expect(isEventFrame({ type: "event", event: "x", payload: {} })).toBe(true);
    expect(isEventFrame({ type: "res", id: "1", ok: true })).toBe(false);
  });

  it("correctly identifies response frames", () => {
    expect(isResponseFrame({ type: "res", id: "1", ok: true })).toBe(true);
    expect(isResponseFrame({ type: "event", event: "x", payload: {} })).toBe(false);
  });
});
