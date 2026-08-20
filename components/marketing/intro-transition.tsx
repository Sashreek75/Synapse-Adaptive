"use client";

/**
 * INTRO TRANSITION — a ~5s cinematic, startup-grade hook. On a dark dusk stage: particles rise, the
 * cut-out robot powers up and grooves while a scan line sweeps and tilted words ("Self-improvement",
 * "Focus", "Discipline", "Momentum", "Lock in") flash by; then a flash + shockwave + spark burst
 * transform it into the glowing orb, and "Entering your lock-in." slams in before the whole thing
 * dissolves into the page. Reduced-motion shows the final frame only. `once` gates to one play/session.
 */

import { useEffect, useState } from "react";
import { SynapseOrb } from "@/components/synapse/orb";
import { CssRobot } from "@/components/marketing/css-robot";
import { cn } from "@/lib/utils";

const SPARKS = 12;
const PARTICLES = 16;
const WORDS: { t: string; cls: string; delay: number }[] = [
  { t: "Self-improvement", cls: "left-[8%] top-[24%] -rotate-6 text-white", delay: 0.9 },
  { t: "Focus", cls: "right-[10%] top-[30%] rotate-6 text-orange-300", delay: 1.35 },
  { t: "Discipline", cls: "left-[12%] bottom-[30%] rotate-3 text-white", delay: 1.8 },
  { t: "Momentum", cls: "right-[9%] bottom-[26%] -rotate-6 text-orange-200", delay: 2.25 },
  { t: "Lock in.", cls: "left-1/2 top-[16%] -translate-x-1/2 -rotate-2 text-white", delay: 2.7 },
];

export function IntroTransition({ once = false }: { once?: boolean }) {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");

  useEffect(() => {
    if (once) { try { if (sessionStorage.getItem("synapse.intro.v3")) return; } catch {} }
    setPhase("in");
    const t1 = setTimeout(() => setPhase("out"), 5100);
    const t2 = setTimeout(() => { setPhase("hidden"); if (once) { try { sessionStorage.setItem("synapse.intro.v3", "1"); } catch {} } }, 6000);
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
      style={{ background: "linear-gradient(125deg, #241631 0%, #3a2c54 46%, #1b2447 100%)" }}
    >
      {/* atmosphere: grid + warm pool + rising particles */}
      <div className="absolute inset-0 sa-grid opacity-25" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(58% 52% at 50% 44%, rgba(249,140,60,.20), transparent 70%)" }} />
      {Array.from({ length: PARTICLES }).map((_, i) => (
        <span key={`p${i}`} className="cine-particle absolute bottom-0 h-1 w-1 rounded-full bg-white/70"
          style={{ left: `${(i * 6.2 + 4) % 96}%`, animationDelay: `${(i % 6) * 0.5}s` }} />
      ))}

      {/* tilted words flashing by */}
      {WORDS.map((w) => (
        <div key={w.t} className={cn("absolute text-4xl font-bold tracking-tight drop-shadow sm:text-5xl", w.cls)}>
          <span className="cine-flashword inline-block" style={{ animationDelay: `${w.delay}s` }}>{w.t}</span>
        </div>
      ))}

      {/* the stage — robot powers up, then transforms into the orb */}
      <div className="relative grid place-items-center">
        <div className="cine-robot absolute grid place-items-center">
          <div className="cine-dance relative scale-90 sm:scale-100" style={{ transformOrigin: "50% 92%" }}>
            <CssRobot />
            {/* scan line sweeping across the robot */}
            <div className="cine-scan pointer-events-none absolute left-[-10%] right-[-10%] top-1/2 h-1 blur-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(140,190,255,.95), transparent)" }} />
          </div>
        </div>

        <span className="cine-flash absolute h-72 w-72 rounded-full blur-2xl" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,.95), rgba(249,140,60,.5) 45%, transparent 72%)" }} />
        <span className="cine-ring absolute h-56 w-56 rounded-full border-2 border-white/70" style={{ animationDelay: "3.15s" }} />
        <span className="cine-ring absolute h-56 w-56 rounded-full border border-orange-300/70" style={{ animationDelay: "3.4s" }} />
        <span className="cine-ring absolute h-56 w-56 rounded-full border border-white/40" style={{ animationDelay: "3.65s" }} />
        {Array.from({ length: SPARKS }).map((_, i) => (
          <span key={`s${i}`} className="cine-spark-wrap" style={{ transform: `rotate(${(360 / SPARKS) * i}deg)` }}>
            <span className="cine-spark h-1.5 w-1.5 rounded-full bg-orange-300" style={{ animationDelay: `${3.1 + (i % 4) * 0.04}s` }} />
          </span>
        ))}
        <div className="cine-orb relative"><SynapseOrb size={200} state="thinking" /></div>
      </div>

      {/* the hook line */}
      <div className="absolute bottom-[18%] left-0 right-0 px-6 text-center">
        <p className="cine-eyebrow text-[11px] font-semibold uppercase tracking-[0.35em] text-orange-300">Synapse</p>
        <p className="cine-word mt-3 text-4xl font-semibold tracking-tight text-white drop-shadow sm:text-6xl">Entering your lock-in.</p>
        <p className="cine-sub mt-3 text-sm text-white/70">Clearing the noise. Finding the one thing that moves you.</p>
      </div>
    </div>
  );
}
