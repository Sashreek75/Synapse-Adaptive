"use client";

/**
 * TODAY'S FOCUS — the compact strip on Home.
 *
 * Founding doc: Home shows the greeting, ONE insight, the current experiment, and
 * the conversation — nothing more. So this is deliberately small: a single line
 * that names the one thing to work on and links into the weekly coaching session
 * for the full reasoning. It still quietly runs Synapse's weekly reasoning pass
 * (/api/focus) in the background and records the experiment, so the conversation
 * and the coaching session both have Synapse's current thinking to draw on.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Target, ChevronRight, Stethoscope } from "lucide-react";
import { ConfidenceChip } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { selectWeeklyFocus, currentWeekKey, detectEscalation, escalationReasoning, earlyImpression } from "@/lib/focus";
import { computeTrend } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { WeeklyFocusReasoning, PlaybookEntry } from "@/types";

/** Merge new playbook learnings into the existing set (by id), newest kept. */
function mergePlaybook(existing: PlaybookEntry[], additions: PlaybookEntry[]): PlaybookEntry[] {
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const a of additions) map.set(a.id, a);
  return [...map.values()].slice(-40);
}

export function FocusOfWeek() {
  const { profile, series, recentChanges, checkIns, experiments, saveExperiments, contextNotes, mind, saveMind, weeksTracked } = useHealth();
  const { plan } = useSubscription();
  const wk = currentWeekKey();

  const det = useMemo(() => selectWeeklyFocus(series, profile.path, recentChanges), [series, profile.path, recentChanges]);
  const [thinking, setThinking] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  // Quietly fetch this week's reasoning once and cache it in the synced mind.
  // No spinner takes over the page — the deterministic read is always ready.
  useEffect(() => {
    const hasData = checkIns.length > 0;
    if (!hasData || mind.weekly[wk] || fetchedRef.current === wk) return;
    fetchedRef.current = wk;
    setThinking(true);
    fetch("/api/focus", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profile: {
          displayName: profile.displayName, path: profile.path, goals: profile.goals,
          conditionLabel: profile.conditionLabel, recoveryStage: profile.recoveryStage,
          primaryChallenge: profile.primaryChallenge, occupation: profile.occupation,
          activityLevel: profile.activityLevel, lifestyle: profile.lifestyle,
          definitionOfBetter: profile.definitionOfBetter, weeksTracked,
        },
        series, recentChanges, experiments,
        beliefs: mind.beliefs, conclusions: mind.conclusions, openQuestions: mind.openQuestions,
        notes: contextNotes.slice(-6).map((n) => ({ prompt: n.prompt, answer: n.answer })),
        tier: plan,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const reasoning: WeeklyFocusReasoning | undefined = d?.reasoning;
        if (reasoning && reasoning.source === "model") {
          const conclusions = Array.from(new Set([...mind.conclusions, ...(d.conclusions ?? [])])).slice(-20);
          saveMind({
            beliefs: d.beliefs?.length ? d.beliefs : mind.beliefs,
            conclusions,
            openQuestions: d.openQuestions?.length ? d.openQuestions : mind.openQuestions,
            weekly: { ...mind.weekly, [wk]: reasoning },
            playbook: mergePlaybook(mind.playbook, d.playbook ?? []),
          });
        }
      })
      .catch(() => {})
      .finally(() => setThinking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wk, checkIns.length]);

  // The current read: escalation (safety) → model reasoning → deterministic → early impression.
  const escalation = useMemo(() => detectEscalation(series, profile.path), [series, profile.path]);
  const view: WeeklyFocusReasoning | null = useMemo(() => {
    if (escalation) return escalationReasoning(escalation);
    if (mind.weekly[wk]) return mind.weekly[wk];
    if (det) return {
      weekKey: det.weekKey, metric: det.metric, title: det.title, action: det.focusAction,
      why: det.why, whyItMatters: det.whyItMatters, measure: det.measure, confidence: det.confidence,
      reasoningSummary: det.whatChanged,
      hypotheses: [{ explanation: det.title, support: det.whatChanged, confidence: det.confidence }],
      experiment: { hypothesis: det.experiment.hypothesis, behavior: det.experiment.behavior, expectedOutcome: det.experiment.expectedOutcome, followUp: det.experiment.followUp },
      source: "fallback" as const,
    };
    if (profile.onboardedAt) return earlyImpression(profile);
    return null;
  }, [escalation, mind.weekly, wk, det, profile]);

  // Record this week's experiment once, from whatever the current view is.
  useEffect(() => {
    if (!view || view.escalate || view.early) return;
    if (experiments.some((e) => e.weekKey === view.weekKey)) return;
    const s = series.find((x) => x.metric === view.metric);
    const baseline = s && s.points.length ? Math.round(computeTrend(s).latest) : 0;
    saveExperiments([...experiments, {
      id: `focus_${view.weekKey}_${view.metric}`, weekKey: view.weekKey, metric: view.metric,
      title: view.title, behavior: view.action, hypothesis: view.experiment.hypothesis,
      mode: "monitor" as const, baseline, startedAt: new Date().toISOString(),
    }].slice(-12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.weekKey, view?.metric, experiments.length]);

  if (!view) return null; // nothing to focus on yet — Home's hero carries the moment

  const escalate = !!view.escalate;

  return (
    <Link
      href="/report"
      className="group block rounded-3xl border bg-surface/70 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5"
    >
      <div className="flex items-center gap-4">
        <SynapseOrb size={40} state={thinking ? "thinking" : "idle"} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider",
              escalate ? "text-amber-700 dark:text-amber-300" : "text-orange-600 dark:text-orange-400",
            )}>
              {escalate ? <Stethoscope className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
              {escalate ? "Worth a provider visit" : view.early ? "Early impression" : "This week's focus"}
            </span>
            {!escalate && <ConfidenceChip level={view.confidence} />}
          </div>
          <p className="mt-0.5 truncate text-base font-semibold text-ink sm:text-lg">{view.title}</p>
          <p className="truncate text-sm text-muted">{view.action}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
