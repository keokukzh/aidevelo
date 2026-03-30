import { useRef, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeAgent } from "../core/types";
import type { AnimationEntry } from "../hooks/useOfficeAnimations";
import { deskIndexToWorld, walkingPathForAgent } from "../core/geometry";
import { getAnimationBob, ANIM } from "../hooks/useOfficeAnimations";

interface AgentModelProps {
  agent: OfficeAgent;
  animState?: AnimationEntry;
  isSelected?: boolean;
  onClick?: (agentId: string) => void;
}

function ErrorGlow({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.3 + Math.random() * 0.4;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color={color} emissive="#EF4444" emissiveIntensity={1} transparent opacity={0.3} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1.2, 0]} color="#EF4444" intensity={0.5} distance={3} />
      <Html position={[0, 1.6, 0]} center>
        <div style={{
          color: "#EF4444",
          fontSize: "24px",
          fontWeight: "bold",
          textShadow: "0 0 10px #EF4444",
          animation: "pulse 0.5s infinite"
        }}>
          !
        </div>
      </Html>
    </group>
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

function ActiveRunRing() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ringRef.current) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulse;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.6, 32]} />
      <meshBasicMaterial color="#10B981" transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

function AgentShadow() {
  return (
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.35, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.15} />
    </mesh>
  );
}

function TypingArms({ state }: { state: string }) {
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const isTyping = state === "sitting" || state === "working";
    const oscillate = isTyping ? Math.sin(Date.now() * 0.008) * 0.03 : 0;

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = isTyping ? -0.5 + oscillate : -0.2;
      leftArmRef.current.position.z = isTyping ? 0.35 + oscillate : 0.25;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = isTyping ? -0.5 - oscillate : -0.2;
      rightArmRef.current.position.z = isTyping ? 0.35 - oscillate : 0.25;
    }
  });

  return (
    <group position={[0, 0.6, 0]}>
      <group ref={leftArmRef} position={[-0.25, 0.1, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
        <mesh position={[-0.15, -0.05, 0.1]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.25, 0.1, 0]}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
        <mesh position={[0.15, -0.05, 0.1]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
      </group>
    </group>
  );
}

function AgentFace({ state }: { state: string }) {
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);
  const blinkProgressRef = useRef(0);

  useFrame((_, delta) => {
    blinkTimerRef.current += delta;

    if (blinkTimerRef.current > 4 && !isBlinkingRef.current) {
      isBlinkingRef.current = true;
      blinkProgressRef.current = 0;
    }

    if (isBlinkingRef.current) {
      blinkProgressRef.current += delta * 10;
      const blinkScale = blinkProgressRef.current < 0.5
        ? 1 - blinkProgressRef.current * 1.8
        : 0.1 + (blinkProgressRef.current - 0.5) * 1.8;

      if (leftEyeRef.current) leftEyeRef.current.scale.y = Math.max(0.1, blinkScale);
      if (rightEyeRef.current) rightEyeRef.current.scale.y = Math.max(0.1, blinkScale);

      if (blinkProgressRef.current >= 1) {
        isBlinkingRef.current = false;
        blinkTimerRef.current = 0;
        if (leftEyeRef.current) leftEyeRef.current.scale.y = 1;
        if (rightEyeRef.current) rightEyeRef.current.scale.y = 1;
      }
    }
  });

  const mouthShape = () => {
    if (state === "working" || state === "sitting") return "typing";
    if (state === "error") return "x";
    return "neutral";
  };

  return (
    <group position={[0, 1.1, 0]}>
      <group ref={leftEyeRef} position={[-0.06, 0.02, 0.15]}>
        <mesh>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      </group>
      <group ref={rightEyeRef} position={[0.06, 0.02, 0.15]}>
        <mesh>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      </group>
      {mouthShape() === "neutral" && (
        <mesh position={[0, -0.04, 0.16]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.06, 0.015, 0.01]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      )}
      {mouthShape() === "typing" && (
        <mesh position={[0, -0.04, 0.16]}>
          <boxGeometry args={[0.05, 0.025, 0.01]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      )}
      {mouthShape() === "x" && (
        <group position={[0, -0.04, 0.16]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.05, 0.015, 0.01]} />
            <meshStandardMaterial color="#EF4444" />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.05, 0.015, 0.01]} />
            <meshStandardMaterial color="#EF4444" />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function AgentModel({
  agent,
  animState,
  isSelected = false,
  onClick,
}: AgentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const walkProgressRef = useRef(0);
  const idlePathRef = useRef({ index: 0, t: 0 });

  const isError = agent.state === "error";
  const isAway = agent.state === "away";

  const deskPos = useMemo(() => deskIndexToWorld(agent.deskIndex), [agent.deskIndex]);
  const idlePath = useMemo(() => walkingPathForAgent(agent.id), [agent.id]);

  const targetPosition = animState?.toPosition ?? deskPos;
  const startPosition = animState?.fromPosition ?? deskPos;
  const currentAnimState = animState?.state ?? "idle";

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    elapsedRef.current += delta;

    if (currentAnimState === "walking" && walkProgressRef.current < 1) {
      walkProgressRef.current = Math.min(1, walkProgressRef.current + delta / ANIM.WALK_DURATION);
      const t = walkProgressRef.current;
      const eased = 1 - Math.pow(1 - t, 3);
      groupRef.current.position.x = startPosition[0] + (targetPosition[0] - startPosition[0]) * eased;
      groupRef.current.position.z = startPosition[2] + (targetPosition[2] - startPosition[2]) * eased;
      const bob = Math.sin(elapsedRef.current * Math.PI * 4) * 0.05;
      groupRef.current.position.y = bob;
    } else if (currentAnimState === "idle") {
      const path = idlePath;
      const idx = idlePathRef.current.index;
      const nextIdx = (idx + 1) % path.length;
      const t = idlePathRef.current.t;

      const current = path[idx];
      const next = path[nextIdx];

      groupRef.current.position.x = current[0] + (next[0] - current[0]) * t;
      groupRef.current.position.z = current[2] + (next[2] - current[2]) * t;

      const bob = getAnimationBob("idle", elapsedRef.current);
      groupRef.current.position.y = bob;

      idlePathRef.current.t += delta * 0.3;
      if (idlePathRef.current.t >= 1) {
        idlePathRef.current.t = 0;
        idlePathRef.current.index = nextIdx;
      }
    } else if (currentAnimState === "sitting") {
      groupRef.current.position.x = targetPosition[0];
      groupRef.current.position.z = targetPosition[2];
      const bob = getAnimationBob("sitting", elapsedRef.current);
      groupRef.current.position.y = bob;
    } else {
      groupRef.current.position.x = targetPosition[0];
      groupRef.current.position.z = targetPosition[2];
      groupRef.current.position.y = 0;
    }

    if (isError) {
      const shake = Math.sin(Date.now() * 0.03) * 0.03;
      groupRef.current.position.x += shake;
    }
  });

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
      position={[startPosition[0], startPosition[1] || 0, startPosition[2]]}
      onClick={handleClick}
    >
      <AgentShadow />
      <group>
        <mesh position={[0, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
          <meshStandardMaterial color={isAway ? "#6B7280" : agent.color} />
        </mesh>
        <mesh position={[0, 1.1, 0]} castShadow>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color={isAway ? "#6B7280" : agent.color} />
        </mesh>
        <AgentFace state={currentAnimState} />
        <TypingArms state={currentAnimState} />
      </group>
      {isError && <ErrorGlow color={agent.color} />}
      {isSelected && <SelectionRing />}
      {agent.hasActiveRun && <ActiveRunRing />}
    </group>
  );
}
