"use client";

/**
 * INTRO TRANSITION — a big, cinematic entry hook. On a dark dusk backdrop, the robot materializes
 * large, a flash + shockwave rings fire, and it "transforms" into the glowing Synapse orb as sparks
 * burst outward and the line "Entering your lock-in." slams in. Then the whole thing dissolves into
 * the page (~4.6s). Respects prefers-reduced-motion (skips the heavy motion, shows the final frame
 * briefly). `once` gates it to one play per browser session.
 */

import { useEffect, useState } from "react";
import { SynapseOrb } from "@/components/synapse/orb";
import { cn } from "@/lib/utils";

const SPARKS = 10;

export function IntroTransition({ once = false }: { once?: boolean }) {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");

  useEffect(() => {
    if (once) { try { if (sessionStorage.getItem("synapse.intro.v2")) return; } catch {} }
    setPhase("in");
    const t1 = setTimeout(() => setPhase("out"), 4200);
    const t2 = setTimeout(() => { setPhase("hidden"); if (once) { try { sessionStorage.setItem("synapse.intro.v2", "1"); } catch {} } }, 5100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [once]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[200] grid place-items-center overflow-hidden transition-opacity duration-[900ms] ease-out",
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ background: "linear-gradient(125deg, #2a1b33 0%, #3d2f56 48%, #1e2749 100%)" }}
    >
      {/* atmosphere */}
      <div className="absolute inset-0 sa-grid opacity-25" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 50% 42%, rgba(249,140,60,.18), transparent 70%)" }} />

      {/* the stage — everything shares one center */}
      <div className="relative grid place-items-center">
        {/* robot (background removed) pops in, does a 1s happy dance, then dissolves as the orb takes over */}
        <div className="cine-robot absolute w-[240px] max-w-[60vw]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/robot-cutout.png" alt="" className="cine-dance w-full drop-shadow-[0_20px_45px_rgba(0,0,0,0.4)]" />
        </div>

        {/* transform flash */}
        <span className="cine-flash absolute h-64 w-64 rounded-full blur-2xl" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,.95), rgba(249,140,60,.5) 45%, transparent 72%)" }} />

        {/* shockwave rings */}
        <span className="cine-ring absolute h-52 w-52 rounded-full border-2 border-white/70" style={{ animationDelay: "1.5s" }} />
        <span className="cine-ring absolute h-52 w-52 rounded-full border border-orange-300/70" style={{ animationDelay: "1.75s" }} />
        <span className="cine-ring absolute h-52 w-52 rounded-full border border-white/40" style={{ animationDelay: "2s" }} />

        {/* sparks bursting outward */}
        {Array.from({ length: SPARKS }).map((_, i) => (
          <span key={i} className="cine-spark-wrap" style={{ transform: `rotate(${(360 / SPARKS) * i}deg)` }}>
            <span className="cine-spark h-1.5 w-1.5 rounded-full bg-orange-300" style={{ animationDelay: `${1.45 + (i % 3) * 0.05}s` }} />
          </span>
        ))}

        {/* the orb it becomes */}
        <div className="cine-orb relative">
          <SynapseOrb size={200} state="thinking" />
        </div>
      </div>

      {/* the hook line, below the stage */}
      <div className="absolute bottom-[22%] left-0 right-0 px-6 text-center">
        <p className="cine-eyebrow text-[11px] font-semibold uppercase tracking-[0.35em] text-orange-300">Synapse</p>
        <p className="cine-word mt-3 text-4xl font-semibold tracking-tight text-white drop-shadow sm:text-6xl">Entering your lock-in.</p>
        <p className="cine-sub mt-3 text-sm text-white/70">Clearing the noise. Finding the one thing that moves you.</p>
      </div>
    </div>
  );
}
