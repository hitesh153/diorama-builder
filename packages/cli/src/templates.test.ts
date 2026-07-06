import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseConfig } from "@diorama/engine";

const TEMPLATES_DIR = path.resolve(__dirname, "../../../templates");

describe("template validation", () => {
  const templates = ["starter", "full-office", "minimal"];

  for (const name of templates) {
    describe(`${name} template`, () => {
      const configPath = path.join(TEMPLATES_DIR, name, "diorama.config.json");

      it("has a diorama.config.json file", () => {
        expect(fs.existsSync(configPath)).toBe(true);
      });

      it("parses successfully with parseConfig", () => {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const config = parseConfig(raw);
        expect(config.name).toBeTruthy();
        // v3 templates ship without a fake gateway URL — sources[] is the
        // connection mechanism; gateway stays configurable but empty.
        expect(typeof config.gateway.url).toBe("string");
        expect(Array.isArray(config.sources)).toBe(true);
        expect(config.view).toBeTruthy();
        expect(config.theme).toBeTruthy();
      });

      it("has at least one room", () => {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const config = parseConfig(raw);
        expect(config.rooms.length).toBeGreaterThanOrEqual(1);
      });

      it("rooms have no overlapping positions", () => {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const config = parseConfig(raw);
        for (let i = 0; i < config.rooms.length; i++) {
          for (let j = i + 1; j < config.rooms.length; j++) {
            const a = config.rooms[i];
            const b = config.rooms[j];
            const overlaps =
              a.position[0] < b.position[0] + b.size[0] &&
              a.position[0] + a.size[0] > b.position[0] &&
              a.position[1] < b.position[1] + b.size[1] &&
              a.position[1] + a.size[1] > b.position[1];
            expect(overlaps, `Rooms "${a.label}" and "${b.label}" overlap`).toBe(false);
          }
        }
      });
    });
  }

  it("starter has 3 rooms", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, "starter/diorama.config.json"), "utf-8"));
    expect(parseConfig(raw).rooms).toHaveLength(3);
  });

  it("full-office has 7 rooms", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, "full-office/diorama.config.json"), "utf-8"));
    expect(parseConfig(raw).rooms).toHaveLength(7);
  });

  it("minimal has 1 room with dashboard view", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, "minimal/diorama.config.json"), "utf-8"));
    const config = parseConfig(raw);
    expect(config.rooms).toHaveLength(1);
    expect(config.rooms[0].preset).toBe("workspace");
    expect(config.view).toBe("dashboard");
  });
});
