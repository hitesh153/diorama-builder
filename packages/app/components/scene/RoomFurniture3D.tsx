"use client";

import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { FurnitureItem } from "@diorama/engine";
import { GLBFurniture } from "./GLBFurniture";

interface RoomFurniture3DProps {
  items: FurnitureItem[];
  roomCenter: [number, number, number];
  /** Index of the selected item (renders a ring highlight), or null */
  selectedIndex?: number | null;
  /** Accent color used for the selection ring */
  accentColor?: string;
  /** Live drag preview — overrides the position of one item without touching the store */
  previewOverride?: { index: number; position: [number, number, number] } | null;
  /** When set, items become clickable/draggable (selected room only) */
  onItemPointerDown?: (index: number, e: ThreeEvent<PointerEvent>) => void;
}

export function RoomFurniture3D({
  items,
  roomCenter,
  selectedIndex = null,
  accentColor = "#8090c0",
  previewOverride = null,
  onItemPointerDown,
}: RoomFurniture3DProps) {
  return (
    <group position={roomCenter}>
      {items.map((item, i) => (
        <FurnitureMesh
          key={i}
          item={item}
          selected={selectedIndex === i}
          accentColor={accentColor}
          overridePosition={previewOverride?.index === i ? previewOverride.position : null}
          onPointerDown={onItemPointerDown ? (e) => onItemPointerDown(i, e) : undefined}
        />
      ))}
    </group>
  );
}

function FurnitureMesh({
  item,
  selected,
  accentColor,
  overridePosition,
  onPointerDown,
}: {
  item: FurnitureItem;
  selected?: boolean;
  accentColor?: string;
  overridePosition?: [number, number, number] | null;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const pos = overridePosition ?? (item.position as [number, number, number]);
  const rot = item.rotation as [number, number, number] | undefined;

  // Thin ring under the item marks selection (subtle, matches accent)
  const ringInner = Math.max(item.size[0], item.size[2]) * 0.7 + 0.12;
  const ring = selected ? (
    <mesh position={[pos[0], 0.09, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[ringInner, ringInner + 0.06, 32]} />
      <meshBasicMaterial color={accentColor} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  ) : null;

  // Prefer real GLB model when available
  if (item.glbPath) {
    return (
      <group onPointerDown={onPointerDown}>
        <GLBFurniture
          path={item.glbPath}
          position={pos}
          rotation={rot}
          scale={item.glbScale ?? 1}
          fallbackSize={item.size}
        />
        {ring}
      </group>
    );
  }

  return (
    <group onPointerDown={onPointerDown}>
      <mesh position={pos} rotation={rot}>
        <GeometryForType type={item.geometry} size={item.size} />
        <meshStandardMaterial
          color={item.material.color}
          emissive={item.material.emissive ?? "#000000"}
          emissiveIntensity={item.material.emissive ? (selected ? 0.7 : 0.4) : 0}
          wireframe={item.material.wireframe ?? false}
          transparent={item.material.opacity != null && item.material.opacity < 1}
          opacity={item.material.opacity ?? 1}
          side={item.geometry === "plane" ? THREE.DoubleSide : THREE.FrontSide}
        />
      </mesh>
      {ring}
    </group>
  );
}

function GeometryForType({ type, size }: { type: FurnitureItem["geometry"]; size: [number, number, number] }) {
  switch (type) {
    case "box":
      return <boxGeometry args={size} />;
    case "cylinder":
      return <cylinderGeometry args={[size[0], size[0], size[1], 16]} />;
    case "sphere":
      return <sphereGeometry args={[size[0], 16, 16]} />;
    case "plane":
      return <planeGeometry args={[size[0], size[1]]} />;
    default:
      return <boxGeometry args={size} />;
  }
}
