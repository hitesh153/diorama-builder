import { describe, it, expect } from "vitest";
import {
  generateFloor,
  generateWalls,
  generateDoor,
} from "./roomPrimitives";

describe("generateFloor", () => {
  it("creates a floor plane from room dimensions", () => {
    const floor = generateFloor({ x: 0, y: 0, w: 300, h: 200 });
    expect(floor.width).toBeCloseTo(300 * 0.018, 3);
    expect(floor.depth).toBeCloseTo(200 * 0.018, 3);
    expect(floor.position).toHaveLength(3);
    expect(floor.position[1]).toBe(0); // floor is at y=0
  });

  it("centers the floor at the room's canvas center", () => {
    const floor = generateFloor({ x: 100, y: 100, w: 200, h: 200 });
    // Center of room in canvas: (200, 200)
    // That should map through toWorld
    expect(floor.position[1]).toBe(0);
  });

  it("applies color when provided", () => {
    const floor = generateFloor({ x: 0, y: 0, w: 100, h: 100, color: "#302c26" });
    expect(floor.color).toBe("#302c26");
  });

  it("uses default color when none provided", () => {
    const floor = generateFloor({ x: 0, y: 0, w: 100, h: 100 });
    expect(floor.color).toBe("#1a1a2e");
  });
});

describe("generateWalls", () => {
  it("creates 4 wall segments for a room without doors", () => {
    const walls = generateWalls({ x: 0, y: 0, w: 300, h: 200 }, []);
    expect(walls).toHaveLength(4);
  });

  it("each wall has position, dimensions, and rotation", () => {
    const walls = generateWalls({ x: 0, y: 0, w: 300, h: 200 }, []);
    for (const wall of walls) {
      expect(wall.position).toHaveLength(3);
      expect(wall.width).toBeGreaterThan(0);
      expect(wall.height).toBeGreaterThan(0);
      expect(typeof wall.rotation).toBe("number");
    }
  });

  it("marks walls as glass when glassWalls is true", () => {
    const walls = generateWalls({ x: 0, y: 0, w: 300, h: 200, glassWalls: true }, []);
    for (const wall of walls) {
      expect(wall.glass).toBe(true);
    }
  });

  it("splits a wall when a door is present on that side", () => {
    // Door on the north wall (facing: 0)
    const doors = [{ x: 150, y: 0, facing: 0 as const }];
    const walls = generateWalls({ x: 0, y: 0, w: 300, h: 200 }, doors);
    // North wall should be split into 2 segments + gap
    expect(walls.length).toBeGreaterThan(4);
  });
});

describe("generateDoor", () => {
  it("creates a door geometry from door config", () => {
    const door = generateDoor({ x: 150, y: 0, facing: 0 });
    expect(door.position).toHaveLength(3);
    expect(door.width).toBeGreaterThan(0);
    expect(door.height).toBeGreaterThan(0);
  });

  it("has a doorway width of approximately 1.2 world units", () => {
    const door = generateDoor({ x: 150, y: 0, facing: 0 });
    expect(door.width).toBeCloseTo(1.2, 1);
  });
});
