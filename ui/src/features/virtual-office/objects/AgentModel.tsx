import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OfficeAgent } from "../core/types";
import { deskIndexToWorld } from "../core/geometry";

interface AgentModelProps {
  agent: OfficeAgent;
}

function AgentBody({ color, isWorking }: { color: string; isWorking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (isWorking) {
      groupRef.current.position.y = Math.sin(Date.now() * 0.005) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
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

export function AgentModel({ agent }: AgentModelProps) {
  const [x, y, z] = deskIndexToWorld(agent.deskIndex);
  const isWorking = agent.state === "working";
  const isError = agent.state === "error";
  const isAway = agent.state === "away";

  return (
    <group position={[x, y, z]}>
      <AgentBody color={isAway ? "#6B7280" : agent.color} isWorking={isWorking} />
      {isError && <ErrorGlow color={agent.color} />}
    </group>
  );
}
