"use client";

/**
 * THE CONVICTION CARD — a judgment offered, not a verdict pronounced.
 *
 * How it OPENS depends on its tone: an invitation to think together ("Can I test a theory
 * with you?"), a gentle challenge, a naming of growth the person hasn't noticed, or a quiet
 * thought. It also carries GUARDIANSHIP (drift) and POSITIVE INTERRUPTION (growth). Rare by
 * construction (the store spaces them out). Behavioral layer only.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Check, X, Compass, TrendingUp } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { loadCommitments } from "@/lib/commitments";
import { loadHistory } from "@/lib/focus-session";
import { readMomentum } from "@/lib/momentum";
import {
  convictionToSurface, recordSurfaced, promoteConviction, releaseConviction,
  convictionFromMomentum, convictionFromMindShift, convictionFromDrift, convictionFromGrowth,
  type Conviction,
} from "@/lib/convictions";

const HEAD: Record<string, string> = {
  growth: "I don't think you've noticed",
  challenge: "Can I challenge something I've noticed?",
  invite: "Can I test a theory with you?",
  thought: "I've been thinking",
};

export function ConvictionCard({ source = "momentum", mindShift }: { source?: "momentum" | "mindshift"; mindShift?: string | null }) {
  const router = useRouter();
  const { mind } = useHealth();
  const [c, setC] = useState<Conviction | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    const traj = mind?.trajectory?.statement ?? null;
    try {
      const cand = source === "mindshift"
        ? convictionFromMindShift(mindShift)
        : (() => { const focus = loadHistory(); const m = readMomentum(loadCommitments(), focus); return convictionFromDrift(traj, m) ?? convictionFromGrowth(traj, m, focus) ?? convictionFromMomentum(m); })();
      if (cand) promoteConviction(cand);
    } catch {}
    const pick = convictionToSurface();
    if (pick) { shown.current = true; recordSurfaced(pick.id); setC(pick); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <div className="sa-rise flex items-start gap-3 rounded-3xl border bg-surface/80 p-4 shadow-soft">
        <SynapseOrb size={22} className="mt-0.5 shrink-0" />
        <p className="text-sm leading-relaxed text-ink">{done}</p>
      </div>
    );
  }
  if (!c) return null;

  const conviction = c;
  const growth = conviction.tone === "growth";
  function ask(prompt: string) {
    try { sessionStorage.setItem("synapse.pendingAsk", prompt); } catch {}
    router.push("/dashboard#conversation");
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent("synapse:ask")); } catch {} }, 80);
  }

  return (
    <div className={"sa-rise overflow-hidden rounded-3xl border shadow-soft " + (growth ? "border-emerald-300/50 dark:border-emerald-500/30" : "border-navy-300/40 dark:border-navy-500/30")}>
      <div className="mesh p-5 sm:p-6">
        <p className={"inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider " + (growth ? "text-emerald-600 dark:text-emerald-300" : "text-navy-500 dark:text-navy-300")}>
          {growth ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <Sparkles className="h-3.5 w-3.5 text-orange-500" />} {HEAD[conviction.tone] ?? HEAD.thought}
        </p>
        <p className="mt-2 text-lg font-medium leading-snug text-ink">{conviction.statement}</p>
        <p className="mt-2 text-sm text-muted">{conviction.humility ? conviction.humility + " " : ""}this comes from {conviction.basis}. I&apos;ll change my mind if {conviction.wouldChangeIt}.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => ask(`You said to me: "${conviction.statement}" I want to think about that together — walk me through why, and what you'd have me do about it.`)}>
            {growth ? "Talk about it" : "Talk it through"} <ArrowRight className="h-4 w-4" />
          </Button>
          {conviction.source === "drift" && (
            <Button size="sm" variant="outline" onClick={() => { releaseConviction(conviction.id, "goal has changed"); ask("What I'm working toward has actually changed. Help me update it, and let's make sure I'm choosing it on purpose."); }}>
              <Compass className="h-4 w-4" /> My goal&apos;s changed
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setDone(growth ? "Good — let it land. You earned it." : "Thank you for hearing it — I&apos;ll keep it in view as we go.")}>
            <Check className="h-4 w-4" /> {growth ? "I&apos;ll take it" : "You&apos;re right"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { releaseConviction(conviction.id, "they didn't see it"); setDone("Fair enough — I&apos;ll set that aside unless more points back to it. Changing my mind is part of the job."); }}>
            <X className="h-4 w-4" /> I don&apos;t see it
          </Button>
        </div>
      </div>
    </div>
  );
}
