"use client";

/**
 * FIRST-RUN GUIDE — a short walkthrough of how Synapse works, centred on GOALS. It runs once,
 * right after onboarding. Deliberately not anchored to DOM nodes (which move as the UI evolves)
 * — it's a calm, self-contained set of cards. Replayable from Settings via resetTour().
 */

import { useState } from "react";
import { ArrowRight, Target, Flag, MessageCircle, Wrench, CalendarCheck, ShieldCheck } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Target,
    title: "Start with your goals",
    body: "Synapse is a goal operating system. Name the things you're working toward — even the embarrassingly big ones. Just the goal is enough; it learns the rest as you go.",
  },
  {
    icon: Flag,
    title: "Each goal becomes a mission",
    body: "Synapse breaks a goal into the fronts you have to win, hunts the real bottleneck (often not the obvious one), and always leaves you one clear next move — then reassesses as reality changes.",
  },
  {
    icon: MessageCircle,
    title: "Talk to it anywhere",
    body: "The orb travels with you on every page. Ask anything, and it can take you where you need to go, keep you accountable, or notice when an important goal is quietly slipping.",
  },
  {
    icon: Wrench,
    title: "It builds what you need",
    body: "When a tool would help more than a paragraph — a mock interview, a tracker, a study plan — Synapse offers to build it. Your spaces attach to your goals, remember your progress, and improve over time.",
  },
  {
    icon: CalendarCheck,
    title: "Check in, review weekly",
    body: "A quick daily check-in keeps things sharp. Each week, your review lands focused on your missions and follow-through — what moved, what's stuck, and what to do next.",
  },
  {
    icon: ShieldCheck,
    title: "It won't let goals slip",
    body: "Synapse's job isn't to answer questions — it's to help you actually reach the goals you chose, and to stay with you until something has really changed.",
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
