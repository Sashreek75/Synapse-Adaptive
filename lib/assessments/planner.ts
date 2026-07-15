/**
 * THE AGENT'S ASSESSMENT PLANNER
 * ------------------------------
 * Synapse decides WHICH primitives to run, with WHAT parameters, and WHY. This
 * module owns the plan shape + safety clamping + a fully adaptive deterministic
 * planner (the offline fallback). When a model is configured, /api/assessment-plan
 * lets Synapse compose the plan in language and we validate it back through
 * clampPlan() — so the Agent is genuinely authoring assessments, but can never
 * emit something the runner can't safely execute.
 *
 * The context also carries NEGOTIATION preferences — the user can protest a set
 * and steer it (preferMetric), veto task kinds (excludeKinds), or just re-roll
 * (variantSeed flips the rotation) — and the planner honors them best-effort.
 */

import {
  TASK_CATALOG, TASK_KINDS, clampParams, estTaskSeconds, isTaskKind,
  type TaskKind, type TaskParams,
} from "@/lib/assessments/engine";
import { metricLabel } from "@/lib/metrics";
import type { MetricKey } from "@/types";

export interface PlanItem {
  kind: TaskKind;
  params: TaskParams;
  targetMetric: MetricKey;
  rationale: string;      // Synapse's "why this, for you, today"
  title?: string;         // optional friendly override
}
export interface AssessmentPlan {
  intro: string;          // one warm line: why this set today
  items: PlanItem[];
  estSeconds: number;
  source: "agent" | "adaptive";
}

export interface MetricSnapshot {
  metric: MetricKey;
  n: number;              // data points so far
  delta: number;          // recent movement
  watched: boolean;       // Synapse is actively watching this
  lastScore?: number;     // last normalized score (for difficulty calibration)
}
export interface PlannerContext {
  goalMetrics: MetricKey[];
  snapshots: MetricSnapshot[];
  weeksTracked: number;
  budgetSeconds?: number;
  /** Negotiation: the user asked to lean today's set toward this metric. */
  preferMetric?: MetricKey;
  /** Negotiation: avoid these task kinds if at all possible (best-effort, never blocking). */
  excludeKinds?: TaskKind[];
  /** Negotiation: re-roll counter — flips the week-parity rotation so a new set is genuinely different. */
  variantSeed?: number;
}

const PERF_METRICS: MetricKey[] = ["reaction_time", "attention", "working_memory", "processing_speed"];
const FELT_METRICS: MetricKey[] = ["fatigue", "sleep_quality", "stress", "mood", "symptoms"];

/** Difficulty calibrated to the person: stronger recent scores start harder. */
function difficultyFor(lastScore: number | undefined): number {
  if (lastScore == null) return 2;
  return Math.max(1, Math.min(5, Math.round(lastScore / 20)));
}

/**
 * Choose a primitive for a performance metric. We rotate the choice by week so
 * the same metric stays fresh across check-ins — variety without new code.
 */
function primitiveFor(metric: MetricKey, week: number): TaskKind {
  const even = week % 2 === 0;
  switch (metric) {
    case "reaction_time": return even ? "reaction" : "go_no_go";
    case "attention": return even ? "go_no_go" : "visual_search";
    case "working_memory": return even ? "memory_span" : "pattern";
    case "processing_speed": return even ? "visual_search" : "reaction";
    default: return "reaction";
  }
}

function rationaleFor(s: MetricSnapshot | undefined, metric: MetricKey, isGoal: boolean, preferred: boolean): string {
  const label = metricLabel(metric).toLowerCase();
  if (preferred) return `You asked to test your ${label} today — happy to lean into it.`;
  if (!s || s.n < 2) return `Getting a clearer baseline on your ${label}.`;
  if (Math.abs(s.delta) >= 5) {
    return s.delta > 0
      ? `Following up on the recent upward movement in your ${label}.`
      : `Checking whether the recent dip in your ${label} is continuing.`;
  }
  if (s.watched) return `This is one of the areas I'm watching most closely for you right now.`;
  if (isGoal) return `Central to your goals, so I keep it in the rotation.`;
  return `Keeping a steady read on your ${label}.`;
}

/**
 * THE ADAPTIVE DETERMINISTIC PLANNER (offline fallback / ground truth).
 * Composes a short, relevant battery from the user's situation — never a fixed
 * scenario. Always pairs felt-state self-report with calibrated performance work.
 */
export function planAssessmentLocal(ctx: PlannerContext): AssessmentPlan {
  const budget = ctx.budgetSeconds ?? 300;
  const snap = new Map(ctx.snapshots.map((s) => [s.metric, s]));
  // variantSeed flips the week-parity rotation, so a re-roll genuinely changes tasks.
  const week = (ctx.weeksTracked || 0) + (ctx.variantSeed ?? 0);
  const excluded = new Set<TaskKind>(ctx.excludeKinds ?? []);

  /** Pick a kind for a performance metric, honoring exclusions best-effort. */
  const pickKindFor = (metric: MetricKey): TaskKind => {
    const rotation = [primitiveFor(metric, week), primitiveFor(metric, week + 1)];
    for (const k of rotation) if (!excluded.has(k)) return k;
    const alt = TASK_KINDS.filter(
      (k) => k !== "self_report" && !excluded.has(k) && (TASK_CATALOG[k].measures as MetricKey[]).includes(metric),
    );
    if (alt.length) return alt[0];
    return rotation[0]; // everything excluded — exclusions are best-effort, never blocking
  };

  // Rank performance metrics: coverage gaps + movement + watched + goal + user preference.
  const perfRanked = PERF_METRICS
    .map((m) => {
      const s = snap.get(m);
      const gap = !s || s.n < 3 ? 0.8 : 0;
      const movement = s ? Math.min(1, Math.abs(s.delta) / 12) : 0;
      const watched = s?.watched ? 0.6 : 0;
      const goal = ctx.goalMetrics.includes(m) ? 0.5 : 0;
      const prefer = ctx.preferMetric === m ? 1.0 : 0;
      return { m, score: gap + movement + watched + goal + prefer };
    })
    .sort((a, b) => b.score - a.score);

  // Most relevant felt state to ask about.
  const feltCandidates = FELT_METRICS.filter((m) => snap.get(m)?.watched || ctx.goalMetrics.includes(m));
  const felt: MetricKey = feltCandidates[0] ?? "fatigue";

  const items: PlanItem[] = [];
  const add = (metric: MetricKey) => {
    const s = snap.get(metric);
    if (FELT_METRICS.includes(metric)) {
      items.push({
        kind: "self_report",
        params: clampParams("self_report", { metric, invert: metric === "fatigue" || metric === "stress" || metric === "symptoms" }),
        targetMetric: metric,
        rationale: rationaleFor(s, metric, ctx.goalMetrics.includes(metric), false),
      });
      return;
    }
    const kind = pickKindFor(metric);
    items.push({
      kind,
      params: clampParams(kind, { difficulty: difficultyFor(s?.lastScore) }),
      targetMetric: metric,
      rationale: rationaleFor(s, metric, ctx.goalMetrics.includes(metric), ctx.preferMetric === metric),
    });
  };

  // 1-2 performance tasks + the felt check-in, under budget.
  add(perfRanked[0].m);
  if (perfRanked[1] && perfRanked[1].score > 0.4) add(perfRanked[1].m);
  add(felt);

  // Trim to budget.
  let total = 0;
  const fitted: PlanItem[] = [];
  for (const it of items) {
    const sec = estTaskSeconds(it.kind, it.params);
    if (total + sec > budget && fitted.length >= 2) continue;
    fitted.push(it); total += sec;
  }

  const watchedNow = ctx.snapshots.filter((s) => s.watched).map((s) => metricLabel(s.metric).toLowerCase());
  const rerolled = (ctx.variantSeed ?? 0) > 0;
  const intro = rerolled
    ? ctx.preferMetric
      ? `Recomposed — I leaned this one toward your ${metricLabel(ctx.preferMetric).toLowerCase()}, like you asked.`
      : "Recomposed — same signals, a different angle. Go at your own pace."
    : week < 1
    ? "Let's get your first baseline. A few short, game-like tasks — there's no passing or failing here."
    : watchedNow.length
    ? `I picked these around what I'm watching for you — ${watchedNow.slice(0, 2).join(" and ")}. A few minutes, at your own pace.`
    : "A short, relevant set for today. Go at your own pace — consistency matters more than any single score.";

  return { intro, items: fitted, estSeconds: total, source: "adaptive" };
}

/**
 * Validate + clamp a plan the Agent authored (from the model). Anything unknown
 * or out of bounds is dropped/clamped so the runner is always safe.
 */
export function clampPlan(raw: unknown): AssessmentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { intro?: unknown; items?: unknown };
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const items: PlanItem[] = [];
  for (const it of rawItems.slice(0, 5)) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (!isTaskKind(kind)) continue;
    const targetRaw = typeof o.targetMetric === "string" ? o.targetMetric : "";
    const allowedMetrics = TASK_CATALOG[kind].measures;
    const targetMetric = (allowedMetrics as string[]).includes(targetRaw)
      ? (targetRaw as MetricKey)
      : allowedMetrics[0];
    const params = clampParams(kind, (o.params as Partial<TaskParams>) ?? {});
    if (kind === "self_report" && typeof (o.params as Record<string, unknown>)?.metric === "string") {
      // keep the model's chosen self-report metric if valid
    }
    items.push({
      kind,
      params,
      targetMetric,
      rationale: typeof o.rationale === "string" && o.rationale.trim() ? o.rationale.trim() : "Part of today's set.",
      title: typeof o.title === "string" ? o.title : undefined,
    });
  }
  if (items.length < 2) return null; // too thin — caller falls back to adaptive
  const estSeconds = items.reduce((t, it) => t + estTaskSeconds(it.kind, it.params), 0);
  const intro = typeof r.intro === "string" && r.intro.trim() ? r.intro.trim() : "A short, personalized set for today.";
  return { intro, items, estSeconds, source: "agent" };
}

/** Compact catalog text the model reads when authoring a plan. */
export function catalogForPrompt(): string {
  return (Object.values(TASK_CATALOG))
    .map((c) => `- ${c.kind} (measures: ${c.measures.join(", ")}): ${c.blurb}`)
    .join("\n");
}
