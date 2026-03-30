import { useRef, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OfficeAgent } from "../core/types";
import { getAnimationBob, ANIM } from "../hooks/useOfficeAnimations";

interface AgentModelProps {
  agent: OfficeAgent;
  animState?: "idle" | "walking" | "sitting" | "standing";
  fromPosition?: [number, number, number];
  toPosition?: [number, number, number];
  isSelected?: boolean;
  onClick?: (agentId: string) => void;
}

function AgentBody({
  color,
  animState,
  elapsed,
}: {
  color: string;
  animState: "idle" | "walking" | "sitting" | "standing";
  elapsed: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3(0, 0, 0));
  const [startPos] = useState(() => new THREE.Vector3(0, 0, 0));
  const [targetPos] = useState(() => new THREE.Vector3(0, 0, 0));
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (animState === "walking" && progressRef.current < 1) {
      // Lerp position
      progressRef.current = Math.min(1, progressRef.current + delta / ANIM.WALK_DURATION);
      positionRef.current.lerpVectors(startPos, targetPos, progressRef.current);
    } else if (animState === "idle" || animState === "sitting") {
      // Bob animation
      const bob = getAnimationBob(animState, elapsed);
      groupRef.current.position.y = bob;
    } else {
      groupRef.current.position.y = 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ErrorGlow({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.8, 0]}>
      <sphereGeometry args={[0.4, 8, 8]} />
      <meshStandardMaterial color={color} emissive="#EF4444" emissiveIntensity={1} transparent opacity={0.3} />
    </mesh>
  );
}

function SelectionRing() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial color="#3B82F6" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function AgentModel({
  agent,
  animState = "idle",
  fromPosition,
  toPosition,
  isSelected = false,
  onClick,
}: AgentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const isError = agent.state === "error";
  const isAway = agent.state === "away";

  // Set initial position from agent's desk
  const [initX, initY, initZ] = toPosition
    ? toPosition
    : (() => {
        const pos = deskIndexToWorld(agent.deskIndex);
        return pos;
      })();

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onClick?.(agent.id);
    },
    [agent.id, onClick]
  );

  return (
    <group
      ref={groupRef}
      position={[initX, initY, initZ]}
      onClick={handleClick}
    >
      <AgentBody
        color={isAway ? "#6B7280" : agent.color}
        animState={animState}
        elapsed={elapsedRef.current}
      />
      {isError && <ErrorGlow color={agent.color} />}
      {isSelected && <SelectionRing />}
    </group>
  );
}

function deskIndexToWorld(deskIndex: number): [number, number, number] {
  const GRID_COLS = 4;
  const DESK_SPACING_X = 2.5;
  const DESK_SPACING_Z = 2.5;
  const GRID_ORIGIN_X = -(GRID_COLS * DESK_SPACING_X) / 2;

  const row = Math.floor(deskIndex / GRID_COLS);
  const col = deskIndex % GRID_COLS;
  return [
    GRID_ORIGIN_X + col * DESK_SPACING_X,
    0,
    -2 + row * DESK_SPACING_Z,
  ];
}