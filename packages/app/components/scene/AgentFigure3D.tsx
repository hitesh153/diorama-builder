"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { computeIdlePose, type AgentState, type AgentActivity } from "@diorama/engine";
import { ActivityIndicator3D } from "./ActivityIndicator3D";
import type { Group } from "three";

interface AgentFigure3DProps {
  state: AgentState;
  color: string;
  label: string;
  phase?: number;
  /** Energy level 0 (calm) to 1 (restless). Controls idle animation speed/intensity. */
  energy?: number;
  /** Current activity for visual indicator above head. */
  activity?: AgentActivity;
  /** Agent is blocked waiting for the user — shows the amber attention pill. */
  attention?: boolean;
  /** Label for the attention pill. */
  attentionLabel?: string;
}

export function AgentFigure3D({
  state,
  color,
  label,
  phase = 0,
  energy = 0.5,
  activity = "idle",
  attention = false,
  attentionLabel,
}: AgentFigure3DProps) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Position from agent state
    groupRef.current.position.set(state.x, 0, state.z);
    groupRef.current.rotation.y = state.facing;

    // Idle animation
    if (state.mode === "idle" || state.mode === "seated") {
      const pose = computeIdlePose(clock.getElapsedTime(), phase, energy);
      if (bodyRef.current) {
        bodyRef.current.position.x = pose.bodySwayX;
        bodyRef.current.position.z = pose.bodySwayZ;
        bodyRef.current.rotation.x = pose.torsoLean;
        bodyRef.current.rotation.y = pose.chairTurn;
      }
    }
  });

  const yOffset = state.mode === "seated" ? 0.3 : 0;

  return (
    <group ref={groupRef}>
      {/* Activity indicator + name label above head */}
      <group position={[0, 1.5 + yOffset, 0]}>
        <ActivityIndicator3D
          activity={activity}
          agentLabel={label}
          color={color}
          attention={attention}
          attentionLabel={attentionLabel}
        />
      </group>
      <group ref={bodyRef} position={[0, yOffset, 0]}>
        {/* Body - capsule shape */}
        <mesh position={[0, 0.7, 0]}>
          <capsuleGeometry args={[0.15, 0.5, 8, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>

        {/* Badge glow */}
        <mesh position={[0, 0.9, 0.16]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1}
          />
        </mesh>
      </group>
    </group>
  );
}
