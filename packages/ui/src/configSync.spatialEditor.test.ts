import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  loadBuilderStateFromConfig,
  saveBuilderStateToConfig,
} from "./configSync";
import { builderReducer } from "./builderStore";

/**
 * Tests for config round-trip of spatial editor fields:
 * - Per-room colors
 * - Per-room furniture arrays
 * - Backward compatibility (old configs without new fields)
 */
describe("configSync: spatial editor fields", () => {
  let tmpDir: string;
  let configPath: string;

  function writeConfig(config: Record<string, unknown>) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  function readConfig(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diorama-spatial-"));
    configPath = path.join(tmpDir, "diorama.config.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Per-room colors ──────────────────────────────────────────────────

  describe("per-room colors", () => {
    it("round-trips room with all color channels", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          {
            preset: "workspace",
            position: [0, 0],
            size: [5, 4],
            label: "Floor",
            colors: { accent: "#ff0000", floor: "#00ff00", wall: "#0000ff" },
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].colors).toEqual({
        accent: "#ff0000",
        floor: "#00ff00",
        wall: "#0000ff",
      });

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<{ colors?: Record<string, string> }> };
      expect(saved.rooms[0].colors).toEqual({
        accent: "#ff0000",
        floor: "#00ff00",
        wall: "#0000ff",
      });
    });

    it("round-trips room with partial colors", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          {
            preset: "meeting",
            position: [0, 0],
            size: [4, 3],
            label: "Meeting",
            colors: { accent: "#e53e3e" },
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].colors?.accent).toBe("#e53e3e");
      expect(state.rooms[0].colors?.floor).toBeUndefined();

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<{ colors?: Record<string, string> }> };
      expect(saved.rooms[0].colors?.accent).toBe("#e53e3e");
    });

    it("saves colors added via reducer", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Floor" },
        ],
        agents: {},
      });

      let state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].colors).toBeUndefined();

      // Apply SET_ROOM_COLORS via reducer
      state = builderReducer(state, {
        type: "SET_ROOM_COLORS",
        roomId: state.rooms[0].id,
        colors: { accent: "#ff6600", wall: "#333333" },
      });

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<{ colors?: Record<string, string> }> };
      expect(saved.rooms[0].colors).toEqual({ accent: "#ff6600", wall: "#333333" });
    });

    it("omits colors key when undefined", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Floor" },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      saveBuilderStateToConfig(configPath, state);

      const saved = readConfig() as { rooms: Array<Record<string, unknown>> };
      expect(saved.rooms[0]).not.toHaveProperty("colors");
    });
  });

  // ── Per-room furniture ───────────────────────────────────────────────

  describe("per-room furniture", () => {
    const sampleFurniture = [
      {
        geometry: "box" as const,
        size: [1.0, 0.04, 0.55],
        position: [0, 0.75, 0],
        material: { color: "#8b6914" },
      },
      {
        geometry: "cylinder" as const,
        size: [0.3, 0.7, 0.3],
        position: [0.5, 0.35, 0.2],
        material: { color: "#333", emissive: "#4299e1" },
      },
    ];

    it("round-trips room with furniture array", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          {
            preset: "meeting",
            position: [0, 0],
            size: [4, 3],
            label: "Meeting",
            furniture: sampleFurniture,
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].furniture).toHaveLength(2);
      expect(state.rooms[0].furniture![0].geometry).toBe("box");
      expect(state.rooms[0].furniture![1].material.emissive).toBe("#4299e1");

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<{ furniture?: unknown[] }> };
      expect(saved.rooms[0].furniture).toHaveLength(2);
    });

    it("saves furniture added via reducer", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Floor" },
        ],
        agents: {},
      });

      let state = loadBuilderStateFromConfig(configPath);
      const roomId = state.rooms[0].id;

      state = builderReducer(state, {
        type: "ADD_FURNITURE",
        roomId,
        item: {
          geometry: "box",
          size: [1.2, 0.08, 0.6],
          position: [0, 0.75, 0],
          material: { color: "#1a2a40" },
        },
      });

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<{ furniture?: Array<{ geometry: string }> }> };
      expect(saved.rooms[0].furniture).toHaveLength(1);
      expect(saved.rooms[0].furniture![0].geometry).toBe("box");
    });

    it("omits furniture key when undefined", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Floor" },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<Record<string, unknown>> };
      expect(saved.rooms[0]).not.toHaveProperty("furniture");
    });

    it("preserves furniture material properties (emissive, wireframe, opacity)", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          {
            preset: "lab",
            position: [0, 0],
            size: [4, 4],
            label: "Lab",
            furniture: [
              {
                geometry: "box",
                size: [0.6, 1.8, 0.8],
                position: [0, 0.9, 0],
                material: { color: "#2d3748", emissive: "#48bb78", opacity: 0.9 },
              },
            ],
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      const mat = state.rooms[0].furniture![0].material;
      expect(mat.color).toBe("#2d3748");
      expect(mat.emissive).toBe("#48bb78");
      expect(mat.opacity).toBe(0.9);

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<{ furniture: Array<{ material: Record<string, unknown> }> }> };
      expect(saved.rooms[0].furniture[0].material.emissive).toBe("#48bb78");
      expect(saved.rooms[0].furniture[0].material.opacity).toBe(0.9);
    });

    it("preserves furniture rotation when present", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          {
            preset: "meeting",
            position: [0, 0],
            size: [4, 3],
            label: "Meeting",
            furniture: [
              {
                geometry: "box",
                size: [1.2, 0.9, 0.05],
                position: [0, 1.0, -1.0],
                rotation: [0, Math.PI / 4, 0],
                material: { color: "#f7fafc" },
              },
            ],
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].furniture![0].rotation).toBeDefined();
      // Note: rotation is stored in the raw object — we just check it passes through
    });
  });

  // ── Combined colors + furniture ──────────────────────────────────────

  describe("combined colors and furniture", () => {
    it("round-trips room with both colors and furniture", () => {
      writeConfig({
        name: "test",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          {
            preset: "custom",
            position: [0, 0],
            size: [6, 5],
            label: "Command Center",
            colors: { accent: "#e53e3e", floor: "#1a1a2e" },
            furniture: [
              {
                geometry: "box",
                size: [1.0, 0.04, 0.55],
                position: [0, 0.75, 0],
                material: { color: "#8b6914" },
              },
            ],
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].colors?.accent).toBe("#e53e3e");
      expect(state.rooms[0].furniture).toHaveLength(1);

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as {
        rooms: Array<{
          colors?: Record<string, string>;
          furniture?: unknown[];
        }>;
      };
      expect(saved.rooms[0].colors?.accent).toBe("#e53e3e");
      expect(saved.rooms[0].furniture).toHaveLength(1);
    });
  });

  // ── Backward compatibility ───────────────────────────────────────────

  describe("backward compatibility", () => {
    it("loads old config without colors or furniture fields", () => {
      writeConfig({
        name: "legacy-office",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Main" },
          { preset: "meeting", position: [5, 0], size: [4, 3], label: "Meeting" },
        ],
        agents: { "agent-1": { desk: "desk-1" } },
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms).toHaveLength(2);
      expect(state.rooms[0].colors).toBeUndefined();
      expect(state.rooms[0].furniture).toBeUndefined();
      expect(state.rooms[1].colors).toBeUndefined();
      expect(state.rooms[1].furniture).toBeUndefined();
    });

    it("saves old-format rooms without adding empty color/furniture keys", () => {
      writeConfig({
        name: "legacy",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Main" },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      saveBuilderStateToConfig(configPath, state);

      const raw = fs.readFileSync(configPath, "utf-8");
      // Should not contain "colors" or "furniture" keys
      expect(raw).not.toContain('"colors"');
      expect(raw).not.toContain('"furniture"');
    });

    it("mixed rooms: some with new fields, some without", () => {
      writeConfig({
        name: "mixed",
        gateway: { url: "ws://localhost:4040" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Plain" },
          {
            preset: "custom",
            position: [6, 0],
            size: [4, 4],
            label: "Custom",
            colors: { accent: "#ff0000" },
            furniture: [
              { geometry: "box", size: [1, 0.04, 0.5], position: [0, 0.75, 0], material: { color: "#999" } },
            ],
          },
        ],
        agents: {},
      });

      const state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms[0].colors).toBeUndefined();
      expect(state.rooms[0].furniture).toBeUndefined();
      expect(state.rooms[1].colors?.accent).toBe("#ff0000");
      expect(state.rooms[1].furniture).toHaveLength(1);

      saveBuilderStateToConfig(configPath, state);
      const saved = readConfig() as { rooms: Array<Record<string, unknown>> };
      expect(saved.rooms[0]).not.toHaveProperty("colors");
      expect(saved.rooms[0]).not.toHaveProperty("furniture");
      expect(saved.rooms[1]).toHaveProperty("colors");
      expect(saved.rooms[1]).toHaveProperty("furniture");
    });
  });

  // ── Full E2E: Load → Modify → Save → Reload ─────────────────────────

  describe("E2E: load → modify → save → reload", () => {
    it("full cycle: load config, add colors + furniture via reducer, save, reload", () => {
      writeConfig({
        name: "e2e-test",
        gateway: { url: "ws://localhost:4040", token: "test123" },
        rooms: [
          { preset: "workspace", position: [0, 0], size: [5, 4], label: "Main Floor" },
          { preset: "meeting", position: [6, 0], size: [4, 3], label: "Huddle" },
        ],
        agents: { "aegis": { desk: "desk-1" } },
      });

      // Load
      let state = loadBuilderStateFromConfig(configPath);
      expect(state.rooms).toHaveLength(2);

      // Modify via reducer: add colors to room 0
      state = builderReducer(state, {
        type: "SET_ROOM_COLORS",
        roomId: state.rooms[0].id,
        colors: { accent: "#ff6600", floor: "#111" },
      });

      // Add furniture to room 1
      state = builderReducer(state, {
        type: "ADD_FURNITURE",
        roomId: state.rooms[1].id,
        item: {
          geometry: "cylinder",
          size: [0.3, 0.7, 0.3],
          position: [0, 0.35, 0],
          material: { color: "#333" },
        },
      });
      state = builderReducer(state, {
        type: "ADD_FURNITURE",
        roomId: state.rooms[1].id,
        item: {
          geometry: "box",
          size: [1.0, 0.04, 0.55],
          position: [0.5, 0.75, 0],
          material: { color: "#8b6914" },
        },
      });

      // Save
      saveBuilderStateToConfig(configPath, state);

      // Reload
      const reloaded = loadBuilderStateFromConfig(configPath);
      expect(reloaded.rooms).toHaveLength(2);
      expect(reloaded.rooms[0].colors?.accent).toBe("#ff6600");
      expect(reloaded.rooms[0].colors?.floor).toBe("#111");
      expect(reloaded.rooms[0].furniture).toBeUndefined();
      expect(reloaded.rooms[1].colors).toBeUndefined();
      expect(reloaded.rooms[1].furniture).toHaveLength(2);
      expect(reloaded.rooms[1].furniture![0].geometry).toBe("cylinder");
      expect(reloaded.rooms[1].furniture![1].geometry).toBe("box");

      // Verify non-room config preserved
      const raw = readConfig() as { name: string; gateway: { token: string }; agents: Record<string, unknown> };
      expect(raw.name).toBe("e2e-test");
      expect(raw.gateway.token).toBe("test123");
      expect(raw.agents).toHaveProperty("aegis");
    });
  });
});
