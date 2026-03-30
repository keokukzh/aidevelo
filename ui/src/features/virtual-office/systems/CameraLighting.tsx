import * as THREE from "three";

interface CameraLightingProps {
  theme?: "dark" | "light";
}

export function CameraLighting({ theme = "dark" }: CameraLightingProps) {
  const isDark = theme === "dark";

  // Warm modern office lighting palette
  const warmAmbient = isDark ? "#FFF8F0" : "#FFFAF0";
  const warmDirectional = isDark ? "#FFFAF0" : "#FFF5E6";
  const accentBlue = isDark ? "#3B82F6" : "#60A5FA";
  const accentViolet = isDark ? "#8B5CF6" : "#A78BFA";

  return (
    <>
      {/* Ambient - warm base light */}
      <ambientLight intensity={isDark ? 0.4 : 0.9} color={warmAmbient} />

      {/* Main directional light - simulates window light */}
      <directionalLight
        position={[8, 12, 6]}
        intensity={isDark ? 0.6 : 1.0}
        color={warmDirectional}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0001}
      />

      {/* Fill light from opposite side - softer */}
      <directionalLight
        position={[-5, 8, -3]}
        intensity={isDark ? 0.2 : 0.4}
        color={isDark ? "#F0F4F8" : "#FDE68A"}
      />

      {/* Accent lights - subtle blue/violet from monitors */}
      {isDark && (
        <>
          <pointLight position={[-4, 1.5, -2]} color={accentBlue} intensity={0.3} distance={6} />
          <pointLight position={[4, 1.5, -2]} color={accentViolet} intensity={0.2} distance={6} />
          <pointLight position={[0, 1.5, 3]} color={accentBlue} intensity={0.15} distance={5} />
        </>
      )}

      {/* Subtle fog for depth */}
      {isDark && (
        <fog attach="fog" args={["#0F172A", 15, 40]} />
      )}
    </>
  );
}