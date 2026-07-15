"use client";

/**
 * ORB-LED FEATURE TOUR
 * --------------------
 * Synapse itself walks new users through the product: the orb sits above a
 * speech bubble and narrates every stop in first person. Shows once, on the
 * first visit after onboarding (onboardedAt set, has data, tour not done),
 * and can be replayed from Settings via resetTour(). Skippable at any time.
 */

import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Home, Activity, FileText, HeartPulse,
  ArrowRight, ArrowLeft, MapPin, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { cn } from "@/lib/utils";

interface TourStep {
  icon: typeof Sparkles;
  title: string;
  body: string;       // Synapse's own words, first person
  where?: string;     // where to find it later
}

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "This is me",
    body: "Hi — I'm Synapse. This glowing thing? That's me. I read your check-ins, learn a little more about you every week, and turn it into something you can actually use. Let me show you around — one minute, and you can skip anytime.",
  },
  {
    icon: Home,
    title: "Home is a conversation",
    body: "Every day I bring you one focus, one thing worth knowing, and our current experiment — then we just talk. Say \"my knee hurts today\" or \"why am I so tired?\" and I'll reason over your own history, not people in general. Everything ends with one concrete next step, never a list of ten.",
    where: "Sidebar → Home",
  },
  {
    icon: FileText,
    title: "Our weekly coaching session",
    body: "On Sundays we sit down together: how I saw your week, your biggest win, what concerns me, what I learned about you, whether I changed my mind — and the ONE thing to focus on next week, framed as a small experiment we run together.",
    where: "Sidebar → Coaching session",
  },
  {
    icon: BookOpen,
    title: "Your Playbook grows with us",
    body: "As we run experiments and I watch your patterns, I build your Playbook — durable things I've learned about how YOU work, like \"you perform better after 7.5-8 hours of sleep\" — plus the questions I'm still working on. It gets more valuable every month, and it's yours.",
    where: "Sidebar → Playbook",
  },
  {
    icon: HeartPulse,
    title: "Watch me learn you",
    body: "Your health profile is my living summary of you — your goal, your biggest challenge, the patterns I've found, and what's still open. It reads like notes from someone who knows you, and it evolves as we talk.",
    where: "Sidebar → Health profile",
  },
  {
    icon: Activity,
    title: "Assessments, only with a reason",
    body: "I'll never ask you to take a test just because it's Tuesday. When a short task would genuinely answer a question about you — like whether today's fog fits your pattern — I'll suggest one and tell you why.",
    where: "Sidebar → Assessments",
  },
];

export function FeatureTour() {
  const { profile, hydrated, hasData, tourDone, completeTour } = useHealth();
  const [i, setI] = useState(0);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fresh start whenever the tour is (re)opened — e.g. "Replay tour" in Settings.
  useEffect(() => { if (!tourDone) setI(0); }, [tourDone]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!hydrated || !profile.onboardedAt || !hasData || tourDone) return null;

  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  function go(next: number) {
    setI(next);
    // Brief "thinking" pulse while Synapse moves to the next thought.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setThinking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setThinking(false), 650);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Synapse tour"
    >
      <div className="sa-rise w-full max-w-md">
        {/* Synapse itself gives the tour. */}
        <div className="mb-3 flex items-end justify-between px-1">
          <SynapseOrb size={72} state={thinking ? "thinking" : "idle"} />
          <button
            onClick={completeTour}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            Skip tour
          </button>
        </div>

        {/* Speech bubble */}
        <div className="relative">
          <span aria-hidden className="absolute -top-1.5 left-8 z-10 h-4 w-4 rotate-45 border-l border-t bg-surface" />
          <div className="overflow-hidden rounded-3xl border bg-surface shadow-lift">
            <div className="mesh px-6 pb-5 pt-6">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-surface/70 px-2.5 py-1 text-[11px] font-semibold text-muted">
                <Icon className="h-3.5 w-3.5 text-orange-500" /> Synapse · {i + 1} of {STEPS.length}
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{step.title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
              {step.where && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface/70 px-3 py-2 text-sm text-ink">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span><span className="font-medium">Find it later: </span>{step.where}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
                {STEPS.map((_, idx) => (
                  <span key={idx} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-orange-500" : "w-1.5 bg-line")} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => go(i - 1)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {last ? (
                  <Button size="sm" onClick={completeTour}>Let&apos;s go <ArrowRight className="h-4 w-4" /></Button>
                ) : (
                  <Button size="sm" onClick={() => go(i + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
