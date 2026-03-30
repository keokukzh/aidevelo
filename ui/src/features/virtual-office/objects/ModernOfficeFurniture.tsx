import { useMemo } from "react";
import * as THREE from "three";

interface FurnitureProps {
  theme?: "dark" | "light";
}

// Color palette for modern office
const COLORS = {
  dark: {
    floor: "#E8E4DF",
    walls: "#FAFAFA",
    deskSurface: "#D4A574",
    deskLegs: "#6B7280",
    monitor: "#1E293B",
    monitorGlow: "#3B82F6",
    chair: "#475569",
    lampShade: "#FFF3E0",
    ceilingLight: "#F5F5F4",
  },
  light: {
    floor: "#E8E4DF",
    walls: "#FAFAFA",
    deskSurface: "#D4A574",
    deskLegs: "#9CA3AF",
    monitor: "#1E293B",
    monitorGlow: "#3B82F6",
    chair: "#475569",
    lampShade: "#FFF3E0",
    ceilingLight: "#F5F5F4",
  },
};

function ModernDesk({ position, theme, index }: { position: [number, number, number]; theme?: "dark" | "light"; index: number }) {
  const colors = COLORS[theme ?? "dark"];
  const hasLamp = index < 4; // First 4 desks get desk lamps

  return (
    <group position={position}>
      {/* Desk surface - warm oak */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.1]} />
        <meshStandardMaterial color={colors.deskSurface} roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Desk legs - metallic */}
      {[[-1.0, 0, -0.45], [1.0, 0, -0.45], [-1.0, 0, 0.45], [1.0, 0, 0.45]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
          <meshStandardMaterial color={colors.deskLegs} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Monitor */}
      <group position={[0, 0.95, -0.35]}>
        {/* Monitor stand */}
        <mesh position={[0, -0.08, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 0.16, 16]} />
          <meshStandardMaterial color="#1F2937" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* Monitor screen */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.7, 0.45, 0.02]} />
          <meshStandardMaterial color={colors.monitor} metalness={0.3} roughness={0.7} />
        </mesh>
        {/* Screen glow */}
        <mesh position={[0, 0.1, 0.011]}>
          <planeGeometry args={[0.65, 0.4]} />
          <meshStandardMaterial color={colors.monitorGlow} emissive={colors.monitorGlow} emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Keyboard */}
      <mesh position={[0, 0.74, 0.15]} castShadow>
        <boxGeometry args={[0.4, 0.015, 0.12]} />
        <meshStandardMaterial color="#374151" roughness={0.8} />
      </mesh>

      {/* Desk lamp */}
      {hasLamp && (
        <group position={[0.8, 0.74, -0.2]}>
          {/* Lamp base */}
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.04, 16]} />
            <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Lamp arm */}
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
            <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Lamp shade */}
          <mesh position={[0, 0.32, 0]} castShadow>
            <coneGeometry args={[0.08, 0.1, 16]} />
            <meshStandardMaterial color={colors.lampShade} emissive={colors.lampShade} emissiveIntensity={0.3} />
          </mesh>
          {/* Point light from lamp */}
          <pointLight
            position={[0, 0.35, 0]}
            color="#FFF3E0"
            intensity={0.4}
            distance={2}
            castShadow={false}
          />
        </group>
      )}
    </group>
  );
}

function ModernChair({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const colors = COLORS[theme ?? "dark"];

  return (
    <group position={position}>
      {/* Chair seat */}
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.45, 0.06, 0.42]} />
        <meshStandardMaterial color={colors.chair} roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Chair backrest */}
      <mesh position={[0, 0.72, -0.18]} castShadow>
        <boxGeometry args={[0.42, 0.4, 0.04]} />
        <meshStandardMaterial color={colors.chair} roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Chair base - star */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
        <meshStandardMaterial color="#1F2937" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Chair wheels base */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.02, 16]} />
        <meshStandardMaterial color="#1F2937" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Floor({ theme }: { theme?: "dark" | "light" }) {
  const color = COLORS[theme ?? "dark"].floor;

  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.0} />
      </mesh>
      {/* Subtle grid lines */}
      {Array.from({ length: 13 }, (_, i) => i - 6).map((x) => (
        <mesh key={`grid-x-${x}`} position={[x * 2.5, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.02, 30]} />
          <meshBasicMaterial color="#D1D5DB" transparent opacity={0.3} />
        </mesh>
      ))}
      {Array.from({ length: 13 }, (_, i) => i - 6).map((z) => (
        <mesh key={`grid-z-${z}`} position={[0, 0.001, z * 2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 0.02]} />
          <meshBasicMaterial color="#D1D5DB" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Walls({ theme }: { theme?: "dark" | "light" }) {
  const color = COLORS[theme ?? "dark"].walls;

  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 2.5, -6]} receiveShadow>
        <boxGeometry args={[18, 5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-9, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[12, 5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Right wall */}
      <mesh position={[9, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[12, 5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  );
}

function CeilingLights({ theme }: { theme?: "dark" | "light" }) {
  const color = COLORS[theme ?? "dark"].ceilingLight;

  return (
    <group position={[0, 5, 0]}>
      {[[-5, 0], [0, 0], [5, 0]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Light panel */}
          <mesh>
            <boxGeometry args={[1.5, 0.05, 0.4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
          </mesh>
          {/* Light source */}
          <pointLight color="#FFFAF0" intensity={0.3} distance={8} position={[0, -0.3, 0]} />
        </group>
      ))}
    </group>
  );
}

export function ModernOfficeFurniture({ theme = "dark" }: FurnitureProps) {
  const desks = useMemo(() => {
    const result: [number, number, number][] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        result.push([(col - 1.5) * 2.5, 0, row * 2.5 - 2]);
      }
    }
    return result;
  }, []);

  return (
    <group>
      <Floor theme={theme} />
      <Walls theme={theme} />
      <CeilingLights theme={theme} />
      {desks.map((pos, i) => (
        <ModernDesk key={i} position={pos} theme={theme} index={i} />
      ))}
      {desks.map((pos, i) => (
        <ModernChair key={`chair-${i}`} position={[pos[0], pos[1], pos[2] + 0.9]} theme={theme} />
      ))}
    </group>
  );
}

// Re-export for backwards compatibility
export { OfficeFurniture as ModernOfficeFurnitureAlias };