"use client";

/**
 * THE ADAPTIVE RUNNER
 * -------------------
 * Asks Synapse to compose today's check-in (/api/assessment-plan → the model,
 * with a deterministic adaptive fallback), then renders WHATEVER plan comes back
 * by dispatching each item to a generic renderer. It knows nothing about specific
 * assessments. It calibrates difficulty across sessions (stores each metric's last
 * score) and writes a single real check-in at the end.
 *
 * NEGOTIATION: the session belongs to the user. On the intro screen they can see
 * exactly why Synapse chose each task, steer toward a metric ("Test my memory"),
 * or protest and have Synapse recompose a different set — capped at 4 re-rolls so
 * week-to-week comparisons stay fair.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock, ArrowRight, Check, ChevronDown, RefreshCw, HelpCircle } from "lucide-react";
import { Card, CardBody, Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { computeTrend } from "@/lib/stats";
import { dailyReflection, type DailyReflection } from "@/lib/intelligence";
import { goalMetricsForPath } from "@/lib/paths";
import type { MetricSeries } from "@/types";

/** Append the just-finished assessment values to the series for an instant read. */
function seriesWithToday(series: MetricSeries[], metrics: Partial<Record<MetricKey, number>>, date: string): MetricSeries[] {
  const map = new Map<SignalId, MetricSeries>(series.map((s) => [s.metric, { metric: s.metric, points: [...s.points] }]));
  for (const [m, v] of Object.entries(metrics) as [MetricKey, number][]) {
    if (v == null) continue;
    if (!map.has(m)) map.set(m, { metric: m, points: [] });
    map.get(m)!.points.push({ metric: m, valueNorm: v, recordedAt: date });
  }
  return [...map.values()];
}
import { planAssessmentLocal, type AssessmentPlan, type MetricSnapshot, type PlannerContext } from "@/lib/assessments/planner";
import { randomSeed, type TaskKind } from "@/lib/assessments/engine";
import { TaskView, meanNorm, type TaskResult } from "@/components/assessments/task-renderers";
import { cn } from "@/lib/utils";
import type { MetricKey, SignalId } from "@/types";

const ALL_METRICS: MetricKey[] = ["reaction_time", "attention", "working_memory", "processing_speed", "fatigue", "sleep_quality", "stress", "mood", "symptoms"];
const CALIB_KEY = "synapse.calib.v1";
const MAX_REROLLS = 4;

const STEER: { label: string; metric: MetricKey }[] = [
  { label: "Test my memory", metric: "working_memory" },
  { label: "Test my speed", metric: "processing_speed" },
  { label: "Test my attention", metric: "attention" },
  { label: "Test my reaction time", metric: "reaction_time" },
];

function readCalib(): Partial<Record<MetricKey, number>> {
  try { return JSON.parse(localStorage.getItem(CALIB_KEY) || "{}"); } catch { return {}; }
}
function writeCalib(scores: Partial<Record<MetricKey, number>>) {
  try { localStorage.setItem(CALIB_KEY, JSON.stringify({ ...readCalib(), ...scores })); } catch {}
}

export function AssessmentRunner() {
  const { profile, series, recentChanges, weeksTracked, addCheckIn } = useHealth();
  const [plan, setPlan] = useState<AssessmentPlan | null>(null);
  const [phase, setPhase] = useState<"loading" | "intro" | "run" | "done">("loading");
  const [reflection, setReflection] = useState<DailyReflection | null>(null);
  const [index, setIndex] = useState(0);
  const [rerolls, setRerolls] = useState(0);
  const [recomposing, setRecomposing] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const seedRef = useRef(randomSeed());
  const results = useRef<TaskResult[]>([]);
  const mounted = useRef(true);

  const context: PlannerContext = useMemo(() => {
    const byMetric = new Map(series.map((s) => [s.metric, s]));
    const calib = readCalib();
    const snapshots: MetricSnapshot[] = ALL_METRICS.map((m) => {
      const s = byMetric.get(m);
      const t = s && s.points.length ? computeTrend(s) : null;
      return {
        metric: m,
        n: s?.points.length ?? 0,
        delta: t ? Math.round(t.delta) : 0,
        watched: goalMetricsForPath(profile.path).includes(m) || recentChanges.some((c) => c.metric === m && !c.improving),
        lastScore: calib[m] ?? (t ? Math.round(t.latest) : undefined),
      };
    });
    return { goalMetrics: goalMetricsForPath(profile.path), snapshots, weeksTracked };
  }, [series, recentChanges, profile.path, weeksTracked]);

  /**
   * Ask Synapse for a plan (model first, deterministic fallback). Negotiation
   * preferences ride along to BOTH the API and the local fallback, so even a
   * failed fetch still honors the user's protest.
   */
  function loadPlan(extra?: Partial<PlannerContext>, isReroll = false) {
    const body: PlannerContext = { ...context, ...extra };
    setRecomposing(isReroll);
    setPhase("loading");
    fetch("/api/assessment-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .then((d) => { if (!mounted.current) return; setPlan(d.plan ?? planAssessmentLocal(body)); setPhase("intro"); })
      .catch(() => { if (!mounted.current) return; setPlan(planAssessmentLocal(body)); setPhase("intro"); });
  }

  useEffect(() => {
    mounted.current = true;
    loadPlan();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The user protested — recompose. Chips steer toward a metric; the plain re-roll vetoes the current kinds. */
  function reroll(pref?: MetricKey) {
    if (!plan || rerolls >= MAX_REROLLS) return;
    const nextSeed = rerolls + 1;
    setRerolls(nextSeed);
    const excludeKinds: TaskKind[] | undefined = pref
      ? undefined
      : [...new Set(plan.items.filter((it) => it.kind !== "self_report").map((it) => it.kind))];
    loadPlan({ preferMetric: pref, excludeKinds, variantSeed: nextSeed }, true);
  }

  function handleDone(r: TaskResult) {
    results.current = [...results.current, r];
    if (!plan) return;
    if (index + 1 >= plan.items.length) finish();
    else setIndex((i) => i + 1);
  }

  function finish() {
    const byMetric = new Map<MetricKey, number[]>();
    for (const r of results.current) {
      if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
      byMetric.get(r.metric)!.push(r.valueNorm);
    }
    const metrics: Partial<Record<MetricKey, number>> = {};
    const calib: Partial<Record<MetricKey, number>> = {};
    for (const [m, vals] of byMetric) { metrics[m] = meanNorm(vals); calib[m] = metrics[m]; }
    const date = new Date().toISOString();
    addCheckIn({ date, metrics, note: "Adaptive check-in composed by Synapse." });
    writeCalib(calib);
    // Never dead-end: give a real, data-grounded read of what just happened.
    try { setReflection(dailyReflection(seriesWithToday(series, metrics, date), profile.path)); } catch { setReflection(null); }
    setPhase("done");
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <SynapseOrb size={72} state="thinking" />
          <p className="text-muted">{recomposing ? "Recomposing your session…" : "Synapse is putting together today's assessment for you…"}</p>
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (phase === "intro" && plan) {
    const mins = Math.max(1, Math.round(plan.estSeconds / 60));
    const capped = rerolls >= MAX_REROLLS;
    return (
      <div className="mx-auto max-w-xl">
        <Card className="sa-rise overflow-hidden">
          <div className="mesh">
            <CardBody className="sm:p-7">
              <div className="flex items-center gap-4">
                <SynapseOrb size={64} />
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface/70 px-3 py-1 text-xs font-medium text-muted"><Clock className="h-3.5 w-3.5" /> About {mins} min</div>
                  <h1 className="mt-2 text-xl font-semibold text-ink">Today&apos;s assessment</h1>
                </div>
              </div>
              <p className="mt-4 leading-relaxed text-ink">{plan.intro}</p>
              <ul className="mt-5 space-y-2">
                {plan.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-surface/70 p-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">{i + 1}</span>
                    <div>
                      <p className="font-medium text-ink">{it.title ?? defaultTitle(it.kind)}</p>
                      <p className="text-sm text-muted">{it.rationale}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Deeper explanation — Synapse shows its work. */}
              <button
                type="button"
                onClick={() => setWhyOpen((v) => !v)}
                aria-expanded={whyOpen}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-orange-600"
              >
                <HelpCircle className="h-4 w-4 text-orange-500" /> Why I chose these
                <ChevronDown className={cn("h-4 w-4 transition-transform", whyOpen && "rotate-180")} />
              </button>
              {whyOpen && (
                <div className="mt-2 space-y-2.5 rounded-xl bg-surface/70 p-4 text-sm">
                  <p className="leading-relaxed text-ink">{plan.intro}</p>
                  <ul className="space-y-1.5">
                    {plan.items.map((it, i) => (
                      <li key={i} className="text-muted">
                        <span className="font-medium text-ink">{it.title ?? defaultTitle(it.kind)}</span> — {it.rationale}
                      </li>
                    ))}
                  </ul>
                  <p className="leading-relaxed text-muted">
                    These aren&apos;t random — I compose each set from what&apos;s moving in your data. And it&apos;s your session: if this doesn&apos;t fit today, ask me for a different one.
                  </p>
                </div>
              )}

              <Button className="mt-6 w-full" onClick={() => setPhase("run")}>Begin <ArrowRight className="h-4 w-4" /></Button>

              {/* Negotiation — protest / steer / recompose, capped so comparisons stay fair. */}
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-medium text-ink">Not feeling this set?</p>
                {capped ? (
                  <p className="mt-1.5 text-sm text-muted">Let&apos;s go with this one — variety helps me compare fairly week to week.</p>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {STEER.map(({ label, metric }) => (
                        <button
                          key={metric}
                          type="button"
                          onClick={() => reroll(metric)}
                          className="rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => reroll()}>
                      <RefreshCw className="h-3.5 w-3.5" /> Compose a different set
                    </Button>
                  </>
                )}
              </div>
            </CardBody>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "run" && plan) {
    const item = plan.items[index];
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex items-center justify-between px-1 text-xs text-muted">
          <span>Step {index + 1} of {plan.items.length}</span>
          <span className="inline-flex items-center gap-1.5"><SynapseOrb size={16} /> Synapse is watching with you</span>
        </div>
        <TaskView key={index} item={item} seed={seedRef.current + index} onDone={handleDone} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card className="sa-rise overflow-hidden">
        <div className="mesh">
          <CardBody className="sm:p-7">
            <div className="flex items-center gap-4">
              <SynapseOrb size={64} />
              <div>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-5 w-5" /></div>
              </div>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink">That&apos;s done — and here&apos;s what I make of it.</h2>
            {reflection ? (
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">
                <p>{reflection.lead}</p>
                {reflection.points.map((p, i) => (
                  <p key={i} className="rounded-xl bg-surface/70 p-3 text-sm">{p}</p>
                ))}
                {reflection.action && (
                  <p className="rounded-xl border border-orange-200 bg-orange-500/5 p-3 text-sm dark:border-orange-500/25">
                    <span className="font-semibold text-orange-700 dark:text-orange-300">What I&apos;d do: </span>{reflection.action}
                  </p>
                )}
                {reflection.watch && <p className="text-sm text-muted">{reflection.watch}</p>}
              </div>
            ) : (
              <p className="mt-2 text-muted">I&apos;ve saved your assessment and I&apos;m folding it into what I know about you. A couple more and I&apos;ll start surfacing the patterns that matter.</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/agent"><Button>Talk it through with me <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/dashboard"><Button variant="outline">Back to home</Button></Link>
            </div>
          </CardBody>
        </div>
      </Card>
    </div>
  );
}

function defaultTitle(kind: string): string {
  return ({
    reaction: "Reaction time",
    go_no_go: "Go / No-Go",
    memory_span: "Memory span",
    visual_search: "Visual search",
    pattern: "Pattern recognition",
    self_report: "Quick check-in",
  } as Record<string, string>)[kind] ?? "Check-in";
}
