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
    const t1 = setTimeout(() => setPhase("out"), 1900);
    const t2 = setTimeout(() => { setPhase("hidden"); if (once) { try { sessionStorage.setItem("synapse.intro.v1", "1"); } catch {} } }, 2700);
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
      <span className="sa-intro-ring absolute h-44 w-44 rounded-full border-2 border-white/50" />
      <span className="sa-intro-ring absolute h-44 w-44 rounded-full border border-orange-200/70" style={{ animationDelay: "0.25s" }} />
      <div className="relative flex flex-col items-center gap-6">
        <SynapseOrb size={132} className="sa-awaken" />
        <div className="text-center">
          <p className="sa-intro-word text-3xl font-semibold tracking-tight text-white drop-shadow-sm">Synapse</p>
          <p className="sa-intro-sub mt-1.5 text-sm text-white/80">learning how you operate…</p>
        </div>
      </div>
    </div>
  );
}
