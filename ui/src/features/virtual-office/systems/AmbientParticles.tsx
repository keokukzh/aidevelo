import { Sparkles } from "@react-three/drei";

interface AmbientParticlesProps {
  enabled?: boolean;
}

export function AmbientParticles({ enabled = true }: AmbientParticlesProps) {
  if (!enabled) return null;

  return (
    <Sparkles
      count={40}
      scale={[20, 10, 20]}
      size={1.2}
      speed={0.08}
      color="#FFF8E7"
      opacity={0.25}
      position={[6, 4, -2]}
    />
  );
}
