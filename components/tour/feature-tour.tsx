"use client";

/**
 * FIRST-RUN GUIDE — a short, friendly walkthrough of how to get around the new
 * Synapse. It runs once, right after onboarding, so a first-time user never has
 * to guess where things are. Deliberately not anchored to specific DOM nodes
 * (which move as the UI evolves) — it's a calm, self-contained set of cards.
 * Replayable from Settings via resetTour().
 */

import { useState } from "react";
import { ArrowRight, Menu, Sun, LineChart, Eraser, MessageCircle } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: MessageCircle,
    title: "This is a conversation",
    body: "Synapse is the product — not a dashboard. Just talk to it like a coach who knows you. It reasons over your own history and always ends with one clear next step.",
  },
  {
    icon: Menu,
    title: "The menu is how you ask",
    body: "Tap the menu (top-right): Talk, Focus, and You, plus your weekly review. Most items drop a question straight into the chat and Synapse answers right away.",
  },
  {
    icon: Sun,
    title: "Check in to get smarter",
    body: "A 20-second daily check-in is how Synapse learns your patterns. The more you check in, the more personal — and more useful — it becomes each week.",
  },
  {
    icon: LineChart,
    title: "You — how Synapse sees you",
    body: "Open You any time to see what Synapse has learned about how you work — your patterns, what's helping, and what it's still figuring out.",
  },
  {
    icon: Eraser,
    title: "Start fresh anytime",
    body: "Hit “Clear chat” for a clean space whenever you like. Synapse still remembers everything that matters — clearing is just for you.",
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
              {last ? "Start talking" : "Next"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
