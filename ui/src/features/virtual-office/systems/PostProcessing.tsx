import { EffectComposer, Bloom, Vignette, SSAO } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

interface PostProcessingProps {
  quality?: "low" | "medium" | "high";
  theme?: "dark" | "light";
}

export function PostProcessing({ quality = "high", theme = "dark" }: PostProcessingProps) {
  // Disable post-processing in low quality mode
  if (quality === "low") {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <EffectComposer>
      {/* Bloom for emissive glow on monitors and lamps */}
      <Bloom
        intensity={isDark ? 0.4 : 0.2}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.4}
        radius={0.6}
      />

      {/* Vignette for depth */}
      <Vignette
        darkness={isDark ? 0.4 : 0.2}
        offset={0.4}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* SSAO for soft contact shadows - only on high quality */}
      {quality === "high" && isDark && (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={0.08}
          intensity={20}
        />
      )}
    </EffectComposer>
  );
}