"use client";

/**
 * FIRST-RUN GUIDE — a short walkthrough of how Synapse works, centred on GOALS. It runs once,
 * right after onboarding. Deliberately not anchored to DOM nodes (which move as the UI evolves)
 * — it's a calm, self-contained set of cards. Replayable from Settings via resetTour().
 */

import { useState } from "react";
import { ArrowRight, Compass, Target, ShieldCheck, Wrench, Sparkles } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Compass,
    title: "Start with what you're chasing",
    body: "Tell Synapse what you want — even the embarrassingly big goal. Just naming it is enough; it works out where to aim, so your energy goes to what actually matters.",
  },
  {
    icon: Target,
    title: "One clear next step — always",
    body: "Open a goal and Synapse gives you the single most important thing to do next, and why. No dashboards to manage, no wall of tasks — just the obvious next move.",
  },
  {
    icon: ShieldCheck,
    title: "It won't let it slip",
    body: "It remembers what you committed to, notices when you go quiet, and reaches out when it genuinely matters — keeping you accountable, never nagging.",
  },
  {
    icon: Wrench,
    title: "It helps with the hard part",
    body: "When a plan, a tool, or a push would help more than advice, Synapse builds it with you — right in the conversation — and stays until the thing is actually done.",
  },
  {
    icon: Sparkles,
    title: "It gets sharper the longer we work together",
    body: "Every conversation teaches it what really moves you, so its guidance fits you more each week — and, done right, you need it less over time.",
  },
];

export function FeatureTour() {
  const { hydrated, profile, tourDone, completeTour } = useHealth();
  const [i, setI] = useState(0);

  // Only after onboarding, and only once.
  if (!hydrated || !profile.onboardedAt || tourDone) return null;

  const step = steps[i];
  const Icon = step.icon;
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-950/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-surface shadow-lift">
        <div className="mesh flex flex-col items-center gap-3 px-6 pt-8 text-center">
          <SynapseOrb size={64} />
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{step.title}</h2>
          <p className="max-w-sm leading-relaxed text-muted">{step.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <span key={idx} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-orange-500" : "w-1.5 bg-line")} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!last && <button onClick={completeTour} className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">Skip</button>}
            <Button size="sm" onClick={() => (last ? completeTour() : setI((n) => n + 1))}>
              {last ? "Name your first goal" : "Next"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
