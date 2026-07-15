import "server-only";

/**
 * THE AGENT PIPELINE  (founding doc §7.3)
 * ---------------------------------------
 * ingest/stats -> context assembly -> model reasoning -> schema validation
 * -> confidence-ceiling enforcement -> safety post-gate -> repair / fallback.
 *
 * The model does the language; CODE owns the numbers, the confidence ceiling,
 * and the safety gate. If the model is unavailable or misbehaves, we fall back
 * to the deterministic coach-voice renderer so the product is always functional.
 */

import { callModel, extractJson } from "@/ai/client";
import { CHAT_PROMPT, REPORT_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { reportSchema, insightSchema } from "@/ai/schemas";
import { renderProactiveNotices, renderReport } from "@/ai/render";
import { getPath, goalMetricsForPath } from "@/lib/paths";
import { computeTrend } from "@/lib/stats";
import { computeAssociations } from "@/lib/correlations";
import type { PlanId } from "@/lib/billing/plans";
import type {
  Confidence,
  Insight,
  MetricKey,
  MetricSeries,
  ProactiveNotice,
  HealthProfile,
  HealthReport,
} from "@/types";

const RANK: Record<Confidence, number> = { low: 0, moderate: 1, high: 2 };

/** Build the evidence object the model reasons over (never raw, never the model's job to compute). */
function buildEvidence(serieses: MetricSeries[], profile: HealthProfile & { path?: string }) {
  const goalMetrics = goalMetricsForPath(profile.path);
  return {
    profile: {
      name: profile.displayName,
      condition: profile.conditionLabel,
      stage: profile.recoveryStage,
      goals: profile.goals,
      weeksTracked: profile.weeksTracked,
    },
    trends: serieses.map((s) => {
      const t = computeTrend(s);
      return {
        metric: t.metric,
        n: t.n,
        latest: Math.round(t.latest),
        baseline: Math.round(t.baseline),
        delta: Math.round(t.delta),
        slopePerWeek: Number(t.slope.toFixed(2)),
        confidenceCeiling: t.confidenceCeiling,
        flags: t.flags,
      };
    }),
    // The RELATIONSHIPS in the data — the non-obvious material. Pre-computed here
    // so the model reasons over real correlations/lags, not guesses. Each carries
    // its own confidence; the model must not exceed it.
    associations: computeAssociations(serieses, goalMetrics, 5).map((a) => ({
      kind: a.kind,
      metrics: a.metrics,
      r: a.r != null ? Number(a.r.toFixed(2)) : undefined,
      n: a.n,
      confidence: a.confidence,
      detail: a.evidence,
    })),
  };
}

/** Confidence may only be LOWERED relative to the data-driven ceiling. */
function clampConfidence(insight: Insight, ceilings: Map<MetricKey, Confidence>): Insight {
  let ceiling: Confidence = "high";
  for (const ref of insight.evidenceRefs) {
    const m = ref.replace("metric:", "") as MetricKey;
    const c = ceilings.get(m);
    if (c && RANK[c] < RANK[ceiling]) ceiling = c;
  }
  if (RANK[insight.confidence] > RANK[ceiling]) {
    return { ...insight, confidence: ceiling, confidenceRationale: insight.confidenceRationale };
  }
  return insight;
}

function ceilingMap(serieses: MetricSeries[]): Map<MetricKey, Confidence> {
  return new Map(serieses.map((s) => { const t = computeTrend(s); return [t.metric, t.confidenceCeiling]; }));
}

/** Per-tier depth directive appended to the evidence the model reasons over. */
const REPORT_DEPTH: Record<PlanId, string> = {
  free: "TIER: Free. Produce 3 solid insights. Keep each tight and plain — one clear relationship, their own numbers, one takeaway. Real value, just not exhaustive.",
  pro: "TIER: Pro. Produce 4-5 insights that connect signals across the weeks. Be specific and pattern-oriented.",
  max: "TIER: Max. Reason over the FULL history at maximum depth: produce 5 rich insights, connect three or more signals where the evidence allows, trace how patterns have evolved week over week, and be maximally specific to this person's timeline. This member has opted into the deepest analysis — earn it.",
};

export async function generateReport(serieses: MetricSeries[], profile: HealthProfile, tier: PlanId = "pro"): Promise<HealthReport> {
  const evidence = buildEvidence(serieses, profile);
  // Reports are the richest generation. Thinking is disabled in the client, so
  // this budget is entirely the visible report; Max gets the most headroom.
  const maxTokens = tier === "max" ? 3600 : tier === "free" ? 1800 : 2600;
  const user = `${JSON.stringify(evidence)}\n\n${REPORT_DEPTH[tier]}`;
  const raw = await callModel({ system: REPORT_PROMPT.system, user, maxTokens });

  if (raw) {
    const parsed = reportSchema.safeParse(extractJson(raw));
    if (parsed.success) {
      const ceilings = ceilingMap(serieses);
      const insights: Insight[] = parsed.data.insights
        .map((i) => ({ ...i, id: `ins_${Math.random().toString(36).slice(2, 9)}`, createdAt: new Date().toISOString() }))
        .map((i) => clampConfidence(i, ceilings))
        .filter((i) => postGate(`${i.observation} ${i.reasoning}`).ok); // safety post-gate
      const nextWeek = (parsed.data.nextWeek ?? [])
        .filter((p) => p.trim().length > 0 && postGate(p).ok)
        .slice(0, 3);
      if (postGate(parsed.data.summary).ok && insights.length) {
        return {
          id: `rep_${Date.now()}`,
          cycleLabel: "This week",
          summary: parsed.data.summary,
          overallConfidence: parsed.data.overallConfidence,
          insights,
          ...(nextWeek.length ? { nextWeek } : {}),
          createdAt: new Date().toISOString(),
          generationMeta: { promptId: REPORT_PROMPT.id, source: "model" },
        } as HealthReport;
      }
    }
    // (repair retry would go here in production) — fall through to renderer.
  }
  return renderReport(serieses, profile); // deterministic, always safe
}

export async function generateProactiveNotices(serieses: MetricSeries[], goals: MetricKey[]): Promise<ProactiveNotice[]> {
  // The deterministic renderer already runs detection + salience + thresholding.
  // When live, we re-voice each candidate via the model but keep the code-owned
  // salience, dedupe, and confidence ceiling.
  // Notices are produced deterministically (detection + salience + voice), so
  // we DON'T spend a model call here — keeps us well inside the free tier.
  const base = renderProactiveNotices(serieses, goals);
  return base.filter((n) => postGate(`${n.observation} ${n.reasoning}`).ok);
}

export async function answerChat(message: string, context: string, tier: PlanId = "pro"): Promise<{ text: string; source: "model" | "fallback" }> {
  // Thinking is off, so the whole budget is the visible reply. Max gets room to
  // reason at length; free stays concise; pro sits in between.
  const maxTokens = tier === "free" ? 900 : tier === "max" ? 2400 : 1500;
  const raw = await callModel({ system: CHAT_PROMPT.system, user: `Context about the user:\n${context}\n\nUser question: ${message}`, maxTokens });
  if (raw && postGate(raw).ok) return { text: raw, source: "model" };
  return { text: "", source: "fallback" };
}

import { PROFILE_PROMPT } from "@/ai/prompts";

/** The AI Health Profile narrative (the baseline). Falls back deterministically. */
export async function generateProfileSummary(profile: {
  path?: string; displayName?: string; conditionLabel?: string; conditionDetail?: string;
  goals?: string[]; recoveryStage?: string; primaryChallenge?: string; definitionOfBetter?: string;
}): Promise<string> {
  const raw = await callModel({
    system: PROFILE_PROMPT.system,
    user: JSON.stringify(profile),
    fast: true,
    maxTokens: 400,
  });
  if (raw && postGate(raw).ok) return raw.trim();

  // Deterministic, on-voice fallback — personalized by the user's chosen path.
  return getPath((profile as { path?: string }).path).summaryLead({
    goals: profile.goals ?? [],
    conditionLabel: profile.conditionLabel,
    conditionDetail: profile.conditionDetail,
  });
}
