"use client";

/**
 * Lazily loads the Three.js scroll cinematic so ~140KB of three.js is code-split out of the landing
 * page's initial bundle and fetched after hydration. A same-height dark placeholder holds the space
 * so there's no layout shift while it loads.
 */

import dynamic from "next/dynamic";

const ScrollCinematic = dynamic(
  () => import("@/components/marketing/scroll-cinematic").then((m) => m.ScrollCinematic),
  { ssr: false, loading: () => <div aria-hidden className="h-[340vh] bg-[#04070d]" /> },
);

export function ScrollCinematicLazy() {
  return <ScrollCinematic />;
}
