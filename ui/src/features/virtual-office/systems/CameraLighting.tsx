import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraLightingProps {
  theme?: "dark" | "light";
}

export function CameraLighting({ theme = "dark" }: CameraLightingProps) {
  const isDark = theme === "dark";
  const ambientIntensity = isDark ? 0.3 : 0.8;
  const ambientColor = isDark ? "#1E293B" : "#F3F4F6";
  const directionalIntensity = isDark ? 0.5 : 1.2;
  const directionalColor = isDark ? "#818CF8" : "#FDE68A";

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={directionalIntensity}
        color={directionalColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {isDark && (
        <>
          <pointLight position={[-3, 2, 0]} color="#3B82F6" intensity={0.5} />
          <pointLight position={[3, 2, 0]} color="#8B5CF6" intensity={0.5} />
        </>
      )}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={20}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}
