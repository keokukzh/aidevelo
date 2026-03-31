import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeAgent } from "../core/types";
import type { AnimationEntry } from "../hooks/useOfficeAnimations";
import { deskIndexToWorld, walkingPathForAgent } from "../core/geometry";
import { getAnimationBob, ANIM } from "../hooks/useOfficeAnimations";
import { derivePersonality } from "../core/personality";

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

function AgentArms({ state, walkProgress, personality, isActiveRun }: {
  state: string;
  walkProgress: number;
  personality?: { armSwingAmplitude: number; typeSpeed: number };
  isActiveRun?: boolean;
}) {
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const isTyping = state === "sitting" || state === "working";
    const isWalking = state === "walking" || state === "patrol";

    if (isWalking) {
      const swingAmp = (personality?.armSwingAmplitude ?? 1) * 0.4;
      const swing = Math.sin(walkProgress * Math.PI * 6) * swingAmp;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = swing;
        leftArmRef.current.position.z = 0.15 + Math.abs(swing) * 0.1;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -swing;
        rightArmRef.current.position.z = 0.15 + Math.abs(swing) * 0.1;
      }
    } else if (isTyping) {
      const typeSpd = personality?.typeSpeed ?? 1;
      const activeMultiplier = isActiveRun ? 1.2 : 1.0;
      const oscillate = Math.sin(Date.now() * 0.008 * typeSpd * activeMultiplier) * 0.03;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -0.5 + oscillate;
        leftArmRef.current.position.z = 0.35 + oscillate;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.5 - oscillate;
        rightArmRef.current.position.z = 0.35 - oscillate;
      }
    } else {
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -0.15;
        leftArmRef.current.position.z = 0.2;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.15;
        rightArmRef.current.position.z = 0.2;
      }
    }
  });

  return (
    <group position={[0, 0.6, 0]}>
      <group ref={leftArmRef} position={[-0.25, 0.1, 0.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
        <mesh position={[-0.15, -0.05, 0.05]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.25, 0.1, 0.2]}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
        <mesh position={[0.15, -0.05, 0.05]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 8]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
      </group>
    </group>
  );
}

function AgentFace({ state, personality }: { state: string; personality?: { headSway: number } }) {
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);
  const blinkProgressRef = useRef(0);
  const headRef = useRef<THREE.Group>(null);

  const isSleeping = state === "away";
  const isWalking = state === "walking";

  useFrame((_, delta) => {
    if (isSleeping) return;

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

    // Head sway micro-movement
    if (headRef?.current) {
      const swayAmt = 0.02 * (personality?.headSway ?? 1);
      headRef.current.rotation.y = Math.sin(Date.now() * 0.001 * 0.7) * swayAmt;
      headRef.current.rotation.x = Math.sin(Date.now() * 0.001 * 0.5) * swayAmt * 0.5;
    }
  });

  const mouthShape = () => {
    if (state === "working" || state === "sitting") return "neutral";
    if (state === "idle" || state === "patrol") return "smile";
    if (state === "error") return "frown";
    if (state === "walking") return "open";
    return "neutral";
  };

  return (
    <group ref={headRef} position={[0, 1.1, 0]}>
      {isSleeping ? (
        <>
          <mesh position={[-0.06, 0.02, 0.15]} scale={[1, 0.1, 1]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
          <mesh position={[0.06, 0.02, 0.15]} scale={[1, 0.1, 1]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
          <mesh position={[0, -0.04, 0.16]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.04, 0.01, 0.01]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
        </>
      ) : (
        <>
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
        </>
      )}
      {mouthShape() === "neutral" && (
        <mesh position={[0, -0.04, 0.16]}>
          <boxGeometry args={[0.06, 0.015, 0.01]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      )}
      {mouthShape() === "smile" && (
        <mesh position={[0, -0.045, 0.16]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.06, 0.015, 0.01]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      )}
      {mouthShape() === "frown" && (
        <mesh position={[0, -0.035, 0.16]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.06, 0.015, 0.01]} />
          <meshStandardMaterial color="#EF4444" />
        </mesh>
      )}
      {mouthShape() === "open" && (
        <mesh position={[0, -0.04, 0.16]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      )}
    </group>
  );
}

function AwayZZZ({ color }: { color: string }) {
  const zzzRef = useRef([
    { char: "Z", y: 1.3, opacity: 0.8 },
    { char: "z", y: 1.5, opacity: 0.5 },
    { char: "z", y: 1.7, opacity: 0.2 },
  ]);

  useFrame(() => {
    const t = Date.now() * 0.001;
    zzzRef.current = [
      { char: "Z", y: 1.3 + Math.sin(t * 1.5) * 0.05, opacity: 0.8 },
      { char: "z", y: 1.5 + Math.sin(t * 1.5 + 0.5) * 0.08, opacity: 0.5 },
      { char: "z", y: 1.7 + Math.sin(t * 1.5 + 1) * 0.1, opacity: 0.2 },
    ];
  });

  return (
    <group position={[0.3, 0, 0]}>
      {zzzRef.current.map((z, i) => (
        <Html key={i} position={[i * 0.12, z.y, 0]} center>
          <div style={{
            color,
            fontSize: `${10 - i * 2}px`,
            fontWeight: "bold",
            opacity: z.opacity,
            textShadow: `0 0 5px ${color}`,
          }}>
            {z.char}
          </div>
        </Html>
      ))}
    </group>
  );
}

function NameBadge({ name, color, isSelected }: { name: string; color: string; isSelected: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Html position={[0, -0.5, 0]} center distanceFactor={8} zIndexRange={[50, 0]}>
      <div
        style={{
          backgroundColor: isSelected ? color : `${color}cc`,
          color: "#FFFFFF",
          padding: "2px 8px",
          borderRadius: "10px",
          fontSize: "10px",
          fontWeight: 600,
          fontFamily: "system-ui, -apple-system, sans-serif",
          whiteSpace: "nowrap",
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          border: isSelected ? "2px solid #FFFFFF" : "none",
        }}
      >
        {name}
      </div>
    </Html>
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
  const bodyRef = useRef<THREE.Group>(null);

  const isError = agent.state === "error";
  const isAway = agent.state === "away";

  const deskPos = useMemo(() => deskIndexToWorld(agent.deskIndex), [agent.deskIndex]);
  const idlePath = useMemo(() => walkingPathForAgent(agent.id), [agent.id]);
  const personality = useMemo(() => derivePersonality(agent.id), [agent.id]);

  const targetPosition = animState?.toPosition ?? deskPos;
  const startPosition = animState?.fromPosition ?? deskPos;
  const currentAnimState = animState?.state ?? "idle";

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    elapsedRef.current += delta;

    if (currentAnimState === "walking" && walkProgressRef.current < 1) {
      const walkDuration = ANIM.WALK_DURATION / (animState?.personality?.walkSpeed ?? 1);
      walkProgressRef.current = Math.min(1, walkProgressRef.current + delta / walkDuration);
      const t = walkProgressRef.current;
      const eased = 1 - Math.pow(1 - t, 3);
      groupRef.current.position.x = startPosition[0] + (targetPosition[0] - startPosition[0]) * eased;
      groupRef.current.position.z = startPosition[2] + (targetPosition[2] - startPosition[2]) * eased;
      const bobAmp = animState?.personality?.bobAmplitude ?? 1;
      const bob = Math.sin(elapsedRef.current * Math.PI * 4) * 0.05 * bobAmp;
      groupRef.current.position.y = bob;
    } else if (currentAnimState === "patrol") {
      const path = idlePath;
      const idx = idlePathRef.current.index;
      const nextIdx = (idx + 1) % path.length;
      const t = idlePathRef.current.t;

      const current = path[idx];
      const next = path[nextIdx];

      groupRef.current.position.x = current[0] + (next[0] - current[0]) * t;
      groupRef.current.position.z = current[2] + (next[2] - current[2]) * t;

      const bob = getAnimationBob("patrol", elapsedRef.current);
      groupRef.current.position.y = bob;

      idlePathRef.current.t += delta * 0.8;
      walkProgressRef.current = idlePathRef.current.t;
      if (idlePathRef.current.t >= 1) {
        idlePathRef.current.t = 0;
        idlePathRef.current.index = nextIdx;
      }
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

      idlePathRef.current.t += delta * 0.15;
      walkProgressRef.current = idlePathRef.current.t;
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

    // Apply breathing to body group Y scale (subtle chest expansion)
    if (bodyRef.current) {
      const breatheCycle = Math.sin(elapsedRef.current * Math.PI * 0.5); // ~4 second cycle
      const breatheScale = 1 + breatheCycle * 0.015; // ±1.5% chest expansion
      bodyRef.current.scale.y = breatheScale;
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
      <group ref={bodyRef}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
          <meshStandardMaterial color={isAway ? "#6B7280" : agent.color} />
        </mesh>
        <mesh position={[0, 1.1, 0]} castShadow>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color={isAway ? "#6B7280" : agent.color} />
        </mesh>
        <AgentFace state={currentAnimState} personality={personality} />
        <AgentArms state={currentAnimState} walkProgress={walkProgressRef.current} personality={personality} isActiveRun={agent.hasActiveRun} />
      </group>
      {isError && <ErrorGlow color={agent.color} />}
      {isAway && <AwayZZZ color={agent.color} />}
      {isSelected && <SelectionRing />}
      {agent.hasActiveRun && <ActiveRunRing />}
      <NameBadge name={agent.name} color={agent.color} isSelected={isSelected} />
    </group>
  );
}
