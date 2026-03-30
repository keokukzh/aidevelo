import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { OfficeAgent } from "../core/types";
import { OfficeFurniture } from "../objects/OfficeFurniture";
import { AgentModel } from "../objects/AgentModel";
import { CameraLighting } from "../systems/CameraLighting";
import { FPS, QUALITY_DPR } from "../core/constants";

interface RetroOfficeSceneProps {
  agents: OfficeAgent[];
  theme?: "dark" | "light";
  quality?: "low" | "medium" | "high";
  maxFps?: number;
  onAgentClick?: (agentId: string) => void;
}

export function RetroOfficeScene({
  agents,
  theme = "dark",
  quality = "high",
  maxFps = FPS.HIGH,
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
        <CameraLighting theme={theme} />
        <OfficeFurniture theme={theme} />
        {agents.map((agent) => (
          <group
            key={agent.id}
            onClick={() => onAgentClick?.(agent.id)}
            style={{ cursor: "pointer" }}
          >
            <AgentModel agent={agent} />
          </group>
        ))}
        {agents.length === 0 && (
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
        )}
      </Suspense>
    </Canvas>
  );
}
