import { describe, it, expect } from "vitest";
import { toWorld, toCanvas, createCoordinateSystem } from "./geometry";

describe("default coordinate system (1800x1000, scale 0.018)", () => {
  it("converts canvas center to world origin", () => {
    const [x, y, z] = toWorld(900, 500);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0, 5);
  });

  it("converts canvas origin to negative world coords", () => {
    const [x, y, z] = toWorld(0, 0);
    expect(x).toBeCloseTo(-900 * 0.018, 5);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(-500 * 0.018, 5);
  });

  it("converts canvas bottom-right to positive world coords", () => {
    const [x, _y, z] = toWorld(1800, 1000);
    expect(x).toBeCloseTo(900 * 0.018, 5);
    expect(z).toBeCloseTo(500 * 0.018, 5);
  });

  it("round-trips canvas → world → canvas", () => {
    const cx = 450;
    const cy = 250;
    const [wx, , wz] = toWorld(cx, cy);
    const [rcx, rcy] = toCanvas(wx, wz);
    expect(rcx).toBeCloseTo(cx, 5);
    expect(rcy).toBeCloseTo(cy, 5);
  });
});

describe("createCoordinateSystem (custom canvas)", () => {
  it("creates a system with custom dimensions", () => {
    const sys = createCoordinateSystem(800, 600, 0.01);
    const [x, y, z] = sys.toWorld(400, 300);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0, 5);
  });

  it("round-trips with custom system", () => {
    const sys = createCoordinateSystem(1024, 768, 0.05);
    const [wx, , wz] = sys.toWorld(100, 200);
    const [cx, cy] = sys.toCanvas(wx, wz);
    expect(cx).toBeCloseTo(100, 5);
    expect(cy).toBeCloseTo(200, 5);
  });
});
