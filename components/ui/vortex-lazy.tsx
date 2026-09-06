"use client";

/**
 * Lazily loads the WebGL vortex background so its shader code isn't in the initial JS bundle on
 * first paint (it's decorative — fixed, behind everything — so deferring it costs nothing visually
 * but trims the critical bundle across every route).
 */

import dynamic from "next/dynamic";

const InteractiveNeuralVortex = dynamic(
  () => import("@/components/ui/interactive-neural-vortex-background").then((m) => m.InteractiveNeuralVortex),
  { ssr: false },
);

export function VortexBackground({ className }: { className?: string }) {
  return <InteractiveNeuralVortex className={className} />;
}
