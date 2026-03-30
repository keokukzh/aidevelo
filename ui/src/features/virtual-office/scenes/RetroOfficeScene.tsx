import { useRef, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense } from "react";
import type { OfficeAgent } from "../core/types";
import { ModernOfficeFurniture } from "../objects/ModernOfficeFurniture";
import { AgentModel } from "../objects/AgentModel";
import { CameraLighting } from "../systems/CameraLighting";
import { CameraController, CameraControllerHandle } from "../systems/CameraController";
import { AgentTooltip } from "../components/AgentTooltip";
import { PostProcessing } from "../systems/PostProcessing";
import { FPS, QUALITY_DPR } from "../core/constants";
import { deskIndexToWorld } from "../core/geometry";

interface RetroOfficeSceneProps {
  agents: OfficeAgent[];
  theme?: "dark" | "light";
  quality?: "low" | "medium" | "high";
  maxFps?: number;
  selectedAgentId?: string | null;
  onAgentClick?: (agentId: string) => void;
}

function SceneContent({
  agents,
  theme,
  selectedAgentId,
  onAgentClick,
  quality,
}: {
  agents: OfficeAgent[];
  theme: "dark" | "light";
  selectedAgentId: string | null;
  onAgentClick?: (agentId: string) => void;
  quality?: "low" | "medium" | "high";
}) {
  const cameraControllerRef = useRef<CameraControllerHandle>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const { camera } = useThree();

  // Fly-in animation on mount
  useEffect(() => {
    const startPos = { x: 0, y: 12, z: 16 };
    const endPos = { x: 0, y: 6, z: 10 };
    const startLookAt = { x: 0, y: 0, z: 0 };
    const endLookAt = { x: 0, y: 0, z: 0 };

    let t = 0;
    let animationFrame: number;

    const animate = () => {
      t += 0.016; // ~60fps
      const progress = Math.min(1, t / 1.2); // 1.2s animation

      // Smooth easing
      const ease = 1 - Math.pow(1 - progress, 3);

      camera.position.x = startPos.x + (endPos.x - startPos.x) * ease;
      camera.position.y = startPos.y + (endPos.y - startPos.y) * ease;
      camera.position.z = startPos.z + (endPos.z - startPos.z) * ease;

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [camera]);

  const handleAgentClick = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent && cameraControllerRef.current) {
      const pos = deskIndexToWorld(agent.deskIndex);
      cameraControllerRef.current.focusOnAgent(pos, agentId);
    }
    onAgentClick?.(agentId);
  };

  return (
    <>
      <CameraController ref={cameraControllerRef} />
      <CameraLighting theme={theme} />
      <ModernOfficeFurniture theme={theme} />
      {agents.map((agent) => {
        const pos = deskIndexToWorld(agent.deskIndex);
        return (
          <group key={agent.id}>
            <AgentModel
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onClick={handleAgentClick}
            />
            <AgentTooltip
              agent={agent}
              position={pos}
            />
          </group>
        );
      })}
      {agents.length === 0 && (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
      )}
      <PostProcessing quality={quality} theme={theme} />
    </>
  );
}

export function RetroOfficeScene({
  agents,
  theme = "dark",
  quality = "high",
  maxFps = FPS.HIGH,
  selectedAgentId = null,
  onAgentClick,
}: RetroOfficeSceneProps) {
  const dpr = QUALITY_DPR[quality];
  const enableShadows = quality !== "low";

  return (
    <Canvas
      dpr={dpr}
      shadows={enableShadows}
      camera={{ position: [0, 6, 10], fov: 50 }}
      frameloop={maxFps < FPS.HIGH ? "demand" : "always"}
      style={{ width: "100%", height: "100%", background: theme === "dark" ? "#0F172A" : "#F8FAFC" }}
    >
      <Suspense fallback={null}>
        <SceneContent
          agents={agents}
          theme={theme}
          quality={quality}
          selectedAgentId={selectedAgentId}
          onAgentClick={onAgentClick}
        />
      </Suspense>
    </Canvas>
  );
}