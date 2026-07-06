import { describe, it, expect, vi } from "vitest";
import {
  OpenClawGatewayClient,
  type GatewayConnectionState,
} from "./openclawGateway";

describe("OpenClawGatewayClient", () => {
  it("initializes in disconnected state", () => {
    const client = new OpenClawGatewayClient({
      url: "ws://localhost:9999",
      token: "test",
    });
    expect(client.getState()).toBe("disconnected");
  });

  it("exposes the configured URL", () => {
    const client = new OpenClawGatewayClient({
      url: "ws://100.74.232.125:18789",
      token: "localdev",
    });
    expect(client.url).toBe("ws://100.74.232.125:18789");
  });

  it("emits state change events", () => {
    const client = new OpenClawGatewayClient({
      url: "ws://localhost:9999",
      token: "test",
    });
    const states: GatewayConnectionState[] = [];
    client.onStateChange((s) => states.push(s));

    // Simulate internal state transitions
    client._setState("connecting");
    client._setState("connected");

    expect(states).toEqual(["connecting", "connected"]);
  });

  it("registers event handlers", () => {
    const client = new OpenClawGatewayClient({
      url: "ws://localhost:9999",
      token: "test",
    });
    const handler = vi.fn();
    const unsub = client.onEvent(handler);
    expect(typeof unsub).toBe("function");
  });

  it("accepts reconnect options", () => {
    const client = new OpenClawGatewayClient({
      url: "ws://localhost:9999",
      token: "test",
      reconnect: { maxAttempts: 5, initialDelayMs: 1000, maxDelayMs: 10000 },
    });
    expect(client.getState()).toBe("disconnected");
  });
});
