import React from "react";
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

  // Build effects array conditionally
  const effects = [
    // Bloom for emissive glow on monitors and lamps
    <Bloom
      key="bloom"
      intensity={isDark ? 0.4 : 0.2}
      luminanceThreshold={0.7}
      luminanceSmoothing={0.4}
      radius={0.6}
    />,
    // Vignette for depth
    <Vignette
      key="vignette"
      darkness={isDark ? 0.4 : 0.2}
      offset={0.4}
      blendFunction={BlendFunction.NORMAL}
    />,
    // SSAO for soft contact shadows
    quality === "high" && isDark ? (
      <SSAO
        key="ssao-high"
        blendFunction={BlendFunction.MULTIPLY}
        samples={16}
        radius={0.08}
        intensity={20}
      />
    ) : quality === "medium" && isDark ? (
      <SSAO
        key="ssao-medium"
        blendFunction={BlendFunction.MULTIPLY}
        samples={8}
        radius={0.06}
        intensity={15}
      />
    ) : null,
  ].filter(Boolean);

  return <EffectComposer enableNormalPass>{effects as React.ReactElement[]}</EffectComposer>;
}