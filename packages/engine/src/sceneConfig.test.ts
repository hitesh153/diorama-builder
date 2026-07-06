import { describe, it, expect } from "vitest";
import {
  createSceneConfig,
  mergeSceneConfig,
} from "./sceneConfig";

describe("createSceneConfig", () => {
  it("returns default scene configuration", () => {
    const config = createSceneConfig();
    expect(config.camera.position).toEqual([0, 32, 16]);
    expect(config.camera.fov).toBe(50);
    expect(config.camera.near).toBe(0.1);
    expect(config.camera.far).toBe(100);
  });

  it("has default ambient light", () => {
    const config = createSceneConfig();
    expect(config.ambientLight.color).toBe("#8090c0");
    expect(config.ambientLight.intensity).toBeGreaterThan(0);
  });

  it("has default directional lights", () => {
    const config = createSceneConfig();
    expect(config.directionalLights.length).toBeGreaterThanOrEqual(1);
    for (const light of config.directionalLights) {
      expect(light.position).toHaveLength(3);
      expect(light.intensity).toBeGreaterThan(0);
    }
  });

  it("has default fog settings", () => {
    const config = createSceneConfig();
    expect(config.fog.color).toBeDefined();
    expect(config.fog.near).toBeLessThan(config.fog.far);
  });

  it("has default background color", () => {
    const config = createSceneConfig();
    expect(config.background).toBe("#0e1520");
  });
});

describe("mergeSceneConfig", () => {
  it("overrides camera position", () => {
    const config = mergeSceneConfig({ camera: { position: [0, 20, 10] } });
    expect(config.camera.position).toEqual([0, 20, 10]);
    // Other camera values stay default
    expect(config.camera.fov).toBe(50);
  });

  it("overrides background color", () => {
    const config = mergeSceneConfig({ background: "#ffffff" });
    expect(config.background).toBe("#ffffff");
  });

  it("overrides ambient light", () => {
    const config = mergeSceneConfig({
      ambientLight: { color: "#ff0000", intensity: 0.5 },
    });
    expect(config.ambientLight.color).toBe("#ff0000");
    expect(config.ambientLight.intensity).toBe(0.5);
  });

  it("returns defaults when no overrides given", () => {
    const config = mergeSceneConfig({});
    const defaults = createSceneConfig();
    expect(config).toEqual(defaults);
  });

  it("overrides fog partially", () => {
    const config = mergeSceneConfig({ fog: { near: 10 } });
    expect(config.fog.near).toBe(10);
    // far stays default
    expect(config.fog.far).toBe(createSceneConfig().fog.far);
  });
});
