import { useMemo } from "react";
import * as THREE from "three";

interface FurnitureProps {
  theme?: "dark" | "light";
}

function Desk({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const color = theme === "dark" ? "#1F2937" : "#D1D5DB";
  return (
    <group position={position}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[[-0.5, 0, -0.25], [0.5, 0, -0.25], [-0.5, 0, 0.25], [0.5, 0, 0.25]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.05, 0.7, 0.05]} />
          <meshStandardMaterial color={theme === "dark" ? "#374151" : "#9CA3AF"} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, -0.2]}>
        <boxGeometry args={[0.5, 0.35, 0.02]} />
        <meshStandardMaterial color="#111827" emissive="#3B82F6" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Chair({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const seatColor = theme === "dark" ? "#4B5563" : "#E5E7EB";
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
      <mesh position={[0, 0.65, -0.18]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.03]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
    </group>
  );
}

export function OfficeFurniture({ theme = "dark" }: FurnitureProps) {
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={theme === "dark" ? "#1F2937" : "#E5E7EB"} />
      </mesh>
      <mesh position={[0, 2, -5]} receiveShadow>
        <boxGeometry args={[15, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      <mesh position={[-7.5, 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      <mesh position={[7.5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      {desks.map((pos, i) => (
        <Desk key={i} position={pos} theme={theme} />
      ))}
      {desks.map((pos, i) => (
        <Chair key={`chair-${i}`} position={[pos[0], pos[1], pos[2] + 0.8]} theme={theme} />
      ))}
    </group>
  );
}
