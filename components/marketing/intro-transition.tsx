"use client";

/**
 * INTRO TRANSITION — a short, cinematic brand splash that plays on entry, then dissolves into the page.
 * The orb awakens out of a glow on the signature blend, the wordmark reveals, an orange ring expands,
 * and the whole overlay fades away (~2.6s total). Respects prefers-reduced-motion (shows briefly, no
 * heavy motion). `once` gates it to one play per browser session.
 */

import { useEffect, useState } from "react";
import { SynapseOrb } from "@/components/synapse/orb";
import { cn } from "@/lib/utils";

export function IntroTransition({ once = false }: { once?: boolean }) {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");

  useEffect(() => {
    if (once) { try { if (sessionStorage.getItem("synapse.intro.v1")) return; } catch {} }
    setPhase("in");
    const t1 = setTimeout(() => setPhase("out"), 2300);
    const t2 = setTimeout(() => { setPhase("hidden"); if (once) { try { sessionStorage.setItem("synapse.intro.v1", "1"); } catch {} } }, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [once]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[200] grid place-items-center overflow-hidden transition-opacity duration-[800ms] ease-out",
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ background: "linear-gradient(125deg, #f4a463 0%, #c79aa6 48%, #8085c8 100%)" }}
    >
      {/* soft grid + expanding rings + a glow burst behind the orb */}
      <div className="absolute inset-0 sa-grid opacity-30" />
      <span className="sa-intro-burst absolute h-72 w-72 rounded-full blur-2xl" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,.9), transparent 70%)" }} />
      <span className="sa-intro-ring absolute h-48 w-48 rounded-full border-2 border-white/60" />
      <span className="sa-intro-ring absolute h-48 w-48 rounded-full border border-white/40" style={{ animationDelay: "0.3s" }} />
      <span className="sa-intro-ring absolute h-48 w-48 rounded-full border border-orange-100/70" style={{ animationDelay: "0.6s" }} />
      <div className="relative flex flex-col items-center gap-7">
        <SynapseOrb size={156} className="sa-awaken" />
        <div className="text-center">
          <p className="sa-intro-word text-4xl font-semibold tracking-tight text-white drop-shadow-sm">Synapse</p>
          <p className="sa-intro-sub mt-2 text-sm font-medium tracking-wide text-white/85">learning how you actually operate…</p>
        </div>
      </div>
    </div>
  );
}
