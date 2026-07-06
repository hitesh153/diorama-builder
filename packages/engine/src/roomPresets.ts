export interface FurnitureItem {
  geometry: "box" | "cylinder" | "sphere" | "plane";
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  label?: string;
  material: {
    color: string;
    emissive?: string;
    wireframe?: boolean;
    opacity?: number;
  };
  /** Path to a GLB model (relative to /public). When present, rendered as a real 3D model. */
  glbPath?: string;
  /** Uniform scale applied to the GLB model (default 1). */
  glbScale?: number;
}

import type { FloorStyle } from "./floorTexture";

export interface ThemeFloorWall {
  floorStyle: FloorStyle;
  floorColor: string;
  wallColor: string;
}

/** Relative door position within a room (fractions of room size). */
export interface RelativeDoor {
  /** Fraction of room width (0 = left edge, 1 = right edge). */
  rx: number;
  /** Fraction of room height (0 = top edge, 1 = bottom edge). */
  ry: number;
  /** Door facing direction: 0=north, 90=east, 180=south, 270=west. */
  facing: number;
}

export interface RoomPreset {
  id: string;
  label: string;
  defaultSize: [number, number];
  /** Default door positions (relative to room size). Used for pathfinding and wall cutouts. */
  doors: RelativeDoor[];
  furnitureByTheme: Record<string, FurnitureItem[]>;
  floorWallByTheme: Record<string, ThemeFloorWall>;
}

// Theme IDs matching the 4 themes in plugins/themes
export const THEME_IDS = ["neon-dark", "warm-office", "cyberpunk", "minimal"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

const KF = "/models/kenney-furniture/";

// ---------- Meeting Room ----------
const meetingFurniture: Record<string, FurnitureItem[]> = {
  "neon-dark": [
    { geometry: "box", size: [2.4, 0.08, 1.2], position: [0, 0, 0], material: { color: "#1a2a40", emissive: "#8090c0" }, glbPath: `${KF}table.glb`, glbScale: 1.4 },
    ...chairRing(6, 1.4, 0.7, { color: "#2a3a55", emissive: "#8090c0" }),
  ],
  "warm-office": [
    { geometry: "box", size: [2.4, 0.1, 1.2], position: [0, 0, 0], material: { color: "#8b6b4a" }, glbPath: `${KF}table.glb`, glbScale: 1.4 },
    ...chairRing(6, 1.4, 0.7, { color: "#5a4030" }),
  ],
  cyberpunk: [
    { geometry: "box", size: [2.4, 0.06, 1.2], position: [0, 0, 0], material: { color: "#1a0025", emissive: "#ff2d95" }, glbPath: `${KF}table.glb`, glbScale: 1.4 },
    ...chairRing(6, 1.4, 0.7, { color: "#220033", wireframe: true }),
  ],
  minimal: [
    { geometry: "box", size: [2.4, 0.1, 1.2], position: [0, 0, 0], material: { color: "#e8e8e8" }, glbPath: `${KF}table.glb`, glbScale: 1.4 },
    ...chairRing(6, 1.4, 0.7, { color: "#cccccc" }),
  ],
};

// ---------- Workspace ----------
const workspaceFurniture: Record<string, FurnitureItem[]> = {
  "neon-dark": [
    ...deskRow(3, { color: "#1a2a40", emissive: "#8090c0" }),
  ],
  "warm-office": [
    ...deskRow(3, { color: "#8b6b4a" }),
  ],
  cyberpunk: [
    ...deskRow(3, { color: "#1a0025", emissive: "#ff2d95" }),
  ],
  minimal: [
    ...deskRow(3, { color: "#e0e0e0" }),
  ],
};

// ---------- Private ----------
const privateFurniture: Record<string, FurnitureItem[]> = {
  "neon-dark": [
    { geometry: "box", size: [1.0, 0.08, 0.6], position: [0, 0, 0], material: { color: "#1a2a40", emissive: "#8090c0" }, glbPath: `${KF}desk.glb`, glbScale: 1.0 },
    { geometry: "cylinder", size: [0.2, 0.7, 0.2], position: [0, 0, -0.5], rotation: [0, Math.PI, 0], material: { color: "#2a3a55" }, glbPath: `${KF}chairDesk.glb`, glbScale: 1.0 },
  ],
  "warm-office": [
    { geometry: "box", size: [1.0, 0.08, 0.6], position: [0, 0, 0], material: { color: "#8b6b4a" }, glbPath: `${KF}desk.glb`, glbScale: 1.0 },
    { geometry: "cylinder", size: [0.2, 0.7, 0.2], position: [0, 0, -0.5], rotation: [0, Math.PI, 0], material: { color: "#5a4030" }, glbPath: `${KF}chairDesk.glb`, glbScale: 1.0 },
  ],
  cyberpunk: [
    { geometry: "box", size: [1.0, 0.06, 0.6], position: [0, 0, 0], material: { color: "#1a0025", emissive: "#ff2d95" }, glbPath: `${KF}desk.glb`, glbScale: 1.0 },
    { geometry: "cylinder", size: [0.25, 0.8, 0.25], position: [0, 0, -0.5], rotation: [0, Math.PI, 0], material: { color: "#220033", wireframe: true }, glbPath: `${KF}chairDesk.glb`, glbScale: 1.0 },
  ],
  minimal: [
    { geometry: "box", size: [1.0, 0.08, 0.6], position: [0, 0, 0], material: { color: "#e8e8e8" }, glbPath: `${KF}desk.glb`, glbScale: 1.0 },
    { geometry: "cylinder", size: [0.2, 0.7, 0.2], position: [0, 0, -0.5], rotation: [0, Math.PI, 0], material: { color: "#cccccc" }, glbPath: `${KF}chairDesk.glb`, glbScale: 1.0 },
  ],
};

// ---------- Social ----------
const socialFurniture: Record<string, FurnitureItem[]> = {
  "neon-dark": [
    { geometry: "box", size: [1.6, 0.4, 0.7], position: [-0.5, 0, 0], material: { color: "#2a3a55", emissive: "#8090c0" }, glbPath: `${KF}loungeSofa.glb`, glbScale: 1.0 },
    { geometry: "box", size: [0.6, 0.35, 0.6], position: [0.8, 0, 0], material: { color: "#1a2a40" }, glbPath: `${KF}tableCoffee.glb`, glbScale: 1.0 },
  ],
  "warm-office": [
    { geometry: "box", size: [1.6, 0.45, 0.7], position: [-0.5, 0, 0], material: { color: "#7a5a3a" }, glbPath: `${KF}loungeSofa.glb`, glbScale: 1.0 },
    { geometry: "box", size: [0.6, 0.35, 0.6], position: [0.8, 0, 0], material: { color: "#8b6b4a" }, glbPath: `${KF}tableCoffee.glb`, glbScale: 1.0 },
  ],
  cyberpunk: [
    { geometry: "box", size: [1.6, 0.35, 0.7], position: [-0.5, 0, 0], material: { color: "#220033", emissive: "#ff2d95" }, glbPath: `${KF}loungeSofa.glb`, glbScale: 1.0 },
    { geometry: "box", size: [0.8, 1.2, 0.1], position: [1.0, 0, -0.5], material: { color: "#1a0025", emissive: "#ff2d95" }, glbPath: `${KF}tableCoffee.glb`, glbScale: 1.0 },
  ],
  minimal: [
    { geometry: "box", size: [1.6, 0.4, 0.7], position: [-0.5, 0, 0], material: { color: "#d0d0d0" }, glbPath: `${KF}loungeSofa.glb`, glbScale: 1.0 },
    { geometry: "box", size: [0.6, 0.35, 0.6], position: [0.8, 0, 0], material: { color: "#e8e8e8" }, glbPath: `${KF}tableCoffee.glb`, glbScale: 1.0 },
  ],
};

// ---------- Lab ----------
const labFurniture: Record<string, FurnitureItem[]> = {
  "neon-dark": [
    { geometry: "box", size: [2.0, 0.08, 0.8], position: [0, 0.9, -0.8], material: { color: "#1a2a40", emissive: "#8090c0" } },
    { geometry: "plane", size: [1.8, 1.2, 1], position: [0, 1.4, -1.3], material: { color: "#8090c0", emissive: "#8090c0", opacity: 0.3 } },
  ],
  "warm-office": [
    { geometry: "box", size: [2.0, 0.08, 0.8], position: [0, 0.9, -0.8], material: { color: "#8b6b4a" } },
    { geometry: "plane", size: [1.8, 1.2, 1], position: [0, 1.4, -1.3], material: { color: "#f5f0e8", opacity: 0.9 } },
  ],
  cyberpunk: [
    { geometry: "box", size: [2.0, 0.06, 0.8], position: [0, 0.9, -0.8], material: { color: "#1a0025", emissive: "#ff2d95" } },
    { geometry: "plane", size: [1.8, 1.2, 1], position: [0, 1.4, -1.3], material: { color: "#ff2d95", emissive: "#ff2d95", opacity: 0.2 } },
    { geometry: "plane", size: [0.8, 1.0, 1], position: [-1.2, 1.2, -1.0], material: { color: "#00ffaa", emissive: "#00ffaa", opacity: 0.15 } },
  ],
  minimal: [
    { geometry: "box", size: [2.0, 0.08, 0.8], position: [0, 0.9, -0.8], material: { color: "#e0e0e0" } },
    { geometry: "plane", size: [1.8, 1.2, 1], position: [0, 1.4, -1.3], material: { color: "#ffffff", opacity: 0.5 } },
  ],
};

// ---------- Helpers ----------

function chairRing(
  count: number,
  radiusX: number,
  radiusZ: number,
  mat: FurnitureItem["material"],
): FurnitureItem[] {
  const chairs: FurnitureItem[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const px = Math.round(Math.cos(angle) * radiusX * 100) / 100;
    const pz = Math.round(Math.sin(angle) * radiusZ * 100) / 100;
    chairs.push({
      geometry: "cylinder",
      size: [0.2, 0.7, 0.2],
      position: [px, 0, pz],
      rotation: [0, angle + Math.PI, 0],
      material: mat,
      glbPath: `${KF}chair.glb`,
      glbScale: 1.0,
    });
  }
  return chairs;
}

function deskRow(
  count: number,
  mat: FurnitureItem["material"],
): FurnitureItem[] {
  const items: FurnitureItem[] = [];
  const spacing = 1.8;
  const startX = -((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing;
    items.push({
      geometry: "box",
      size: [1.2, 0.08, 0.6],
      position: [x, 0, 0],
      material: mat,
      glbPath: `${KF}desk.glb`,
      glbScale: 1.0,
    });
    items.push({
      geometry: "cylinder",
      size: [0.2, 0.7, 0.2],
      position: [x, 0, -0.5],
      rotation: [0, Math.PI, 0],
      material: { ...mat, emissive: undefined },
      glbPath: `${KF}chairDesk.glb`,
      glbScale: 1.0,
    });
  }
  return items;
}

// ---------- Floor + Wall defaults by theme ----------

const meetingFloorWall: Record<string, ThemeFloorWall> = {
  "neon-dark":   { floorStyle: "grid-tiles",  floorColor: "#0e1a2e", wallColor: "#1a2a45" },
  "warm-office": { floorStyle: "grid-tiles",  floorColor: "#c4a882", wallColor: "#d4c4a8" },
  "cyberpunk":   { floorStyle: "grid-tiles",  floorColor: "#150020", wallColor: "#200030" },
  "minimal":     { floorStyle: "grid-tiles",  floorColor: "#f0f0f0", wallColor: "#e0e0e0" },
};

const workspaceFloorWall: Record<string, ThemeFloorWall> = {
  "neon-dark":   { floorStyle: "carpet",      floorColor: "#0a1520", wallColor: "#0e2030" },
  "warm-office": { floorStyle: "carpet",      floorColor: "#8a7060", wallColor: "#b0a090" },
  "cyberpunk":   { floorStyle: "carpet",      floorColor: "#0f0018", wallColor: "#1a0028" },
  "minimal":     { floorStyle: "carpet",      floorColor: "#e8e8e8", wallColor: "#d8d8d8" },
};

const privateFloorWall: Record<string, ThemeFloorWall> = {
  "neon-dark":   { floorStyle: "wood-planks", floorColor: "#0d1c28", wallColor: "#162030" },
  "warm-office": { floorStyle: "wood-planks", floorColor: "#6b4f1d", wallColor: "#c8b898" },
  "cyberpunk":   { floorStyle: "wood-planks", floorColor: "#100018", wallColor: "#180025" },
  "minimal":     { floorStyle: "solid",       floorColor: "#f5f5f5", wallColor: "#f0f0f0" },
};

const socialFloorWall: Record<string, ThemeFloorWall> = {
  "neon-dark":   { floorStyle: "hex-tiles",   floorColor: "#0e1828", wallColor: "#0a1525" },
  "warm-office": { floorStyle: "hex-tiles",   floorColor: "#c8a878", wallColor: "#d0b890" },
  "cyberpunk":   { floorStyle: "hex-tiles",   floorColor: "#0f0018", wallColor: "#200030" },
  "minimal":     { floorStyle: "hex-tiles",   floorColor: "#e5e5e5", wallColor: "#ebebeb" },
};

const labFloorWall: Record<string, ThemeFloorWall> = {
  "neon-dark":   { floorStyle: "grid-tiles",  floorColor: "#0a1520", wallColor: "#111d2e" },
  "warm-office": { floorStyle: "grid-tiles",  floorColor: "#9a9080", wallColor: "#c0b8a8" },
  "cyberpunk":   { floorStyle: "solid",       floorColor: "#050008", wallColor: "#0f0018" },
  "minimal":     { floorStyle: "grid-tiles",  floorColor: "#f8f8f8", wallColor: "#e8e8e8" },
};

// ---------- Presets ----------

/** Default door: south wall center */
const SOUTH_CENTER_DOOR: RelativeDoor[] = [{ rx: 0.5, ry: 1.0, facing: 180 }];

export const ROOM_PRESETS: RoomPreset[] = [
  { id: "meeting",   label: "Meeting Room",   defaultSize: [4, 3], doors: SOUTH_CENTER_DOOR, furnitureByTheme: meetingFurniture,   floorWallByTheme: meetingFloorWall },
  { id: "workspace", label: "Workspace",      defaultSize: [5, 4], doors: SOUTH_CENTER_DOOR, furnitureByTheme: workspaceFurniture, floorWallByTheme: workspaceFloorWall },
  { id: "private",   label: "Private Office", defaultSize: [2, 2], doors: SOUTH_CENTER_DOOR, furnitureByTheme: privateFurniture,   floorWallByTheme: privateFloorWall },
  { id: "social",    label: "Social Lounge",  defaultSize: [3, 3], doors: [{ rx: 1.0, ry: 0.5, facing: 90 }], furnitureByTheme: socialFurniture,    floorWallByTheme: socialFloorWall },
  { id: "lab",       label: "Lab",            defaultSize: [4, 4], doors: SOUTH_CENTER_DOOR, furnitureByTheme: labFurniture,       floorWallByTheme: labFloorWall },
];

export function getPreset(id: string): RoomPreset | undefined {
  return ROOM_PRESETS.find((p) => p.id === id);
}

export function getFurniture(presetId: string, themeId: string): FurnitureItem[] {
  const preset = getPreset(presetId);
  if (!preset) return [];
  return preset.furnitureByTheme[themeId] ?? preset.furnitureByTheme["neon-dark"] ?? [];
}

export function getFloorWall(presetId: string, themeId: string): ThemeFloorWall | null {
  const preset = getPreset(presetId);
  if (!preset) return null;
  return preset.floorWallByTheme[themeId] ?? preset.floorWallByTheme["neon-dark"] ?? null;
}
