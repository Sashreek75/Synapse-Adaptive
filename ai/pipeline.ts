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
import { comprehend } from "@/ai/comprehend";
import { buildTurnBrief } from "@/ai/modes";
import { checkGrounding, repairDirective, minimalAcknowledgement } from "@/ai/grounding";
import { postGate } from "@/ai/safety";
import { reportSchema, insightSchema } from "@/ai/schemas";
import { renderProactiveNotices, renderReport } from "@/ai/render";
import { getPath, goalMetricsForPath } from "@/lib/paths";
import { computeTrend } from "@/lib/stats";
import { computeSurprises } from "@/lib/surprise";
import type { PlanId } from "@/lib/billing/plans";
import type {
  Confidence,
  Insight,
  SignalId,
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
    // The RELATIONSHIPS in the data, RANKED BY SURPRISE — the non-obvious material
    // the user can't see on a dashboard, so the model leads with the eye-opening one.
    associations: computeSurprises(serieses, goalMetrics, [], 5).map((f) => ({
      kind: f.association.kind,
      metrics: f.association.metrics,
      r: f.association.r != null ? Number(f.association.r.toFixed(2)) : undefined,
      n: f.association.n,
      confidence: f.association.confidence,
      detail: f.association.evidence,
      surprise: Number(f.surprise.toFixed(2)),
      whySurprising: f.whySurprising,
      recurrence: f.recurrenceLabel,
    })),
  };
}

/** Confidence may only be LOWERED relative to the data-driven ceiling. */
function clampConfidence(insight: Insight, ceilings: Map<SignalId, Confidence>): Insight {
  let ceiling: Confidence = "high";
  for (const ref of insight.evidenceRefs) {
    const m = ref.replace("metric:", "") as SignalId;
    const c = ceilings.get(m);
    if (c && RANK[c] < RANK[ceiling]) ceiling = c;
  }
  if (RANK[insight.confidence] > RANK[ceiling]) {
    return { ...insight, confidence: ceiling, confidenceRationale: insight.confidenceRationale };
  }
  return insight;
}

function ceilingMap(serieses: MetricSeries[]): Map<SignalId, Confidence> {
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
          ...(parsed.data.mostSurprising && postGate(parsed.data.mostSurprising).ok ? { mostSurprising: parsed.data.mostSurprising } : {}),
          createdAt: new Date().toISOString(),
          generationMeta: { promptId: REPORT_PROMPT.id, source: "model" },
        } as HealthReport;
      }
    }
    // (repair retry would go here in production) — fall through to renderer.
  }
  return renderReport(serieses, profile); // deterministic, always safe
}

export async function generateProactiveNotices(serieses: MetricSeries[], goals: SignalId[]): Promise<ProactiveNotice[]> {
  // The deterministic renderer already runs detection + salience + thresholding.
  // When live, we re-voice each candidate via the model but keep the code-owned
  // salience, dedupe, and confidence ceiling.
  // Notices are produced deterministically (detection + salience + voice), so
  // we DON'T spend a model call here — keeps us well inside the free tier.
  const base = renderProactiveNotices(serieses, goals);
  return base.filter((n) => postGate(`${n.observation} ${n.reasoning}`).ok);
}

/**
 * CHAT — a two-pass pipeline so replies FOLLOW from the message:
 *   Pass 1  comprehend(): a fast, neutral reading — what was said vs. asked, and the RESPONSE MODE.
 *   Pass 2  generation: mode-scoped; the mode overrides the persona's "always act" bias.
 *   Pass 2b grounding guard: rejects invented user-states / temporal drift / unrequested coaching,
 *           repairs once, then falls back to a safe acknowledgement for low-intent turns.
 * The comprehension layer reads the conversation only (Stage-2 firewall preserved).
 */
export async function answerChat(message: string, context: string, tier: PlanId = "pro"): Promise<{ text: string; source: "model" | "fallback"; mode?: string }> {
  const maxTokens = tier === "free" ? 1100 : tier === "max" ? 2600 : 1800;

  // ── Pass 1: comprehension ──
  const { c } = await comprehend(message, context);
  const brief = buildTurnBrief(c);

  // ── Pass 2: mode-scoped generation. Message first AND last so context can't bury it. ──
  const user = `${brief}\n\nThe person just sent you this message — answer it PER THE MODE ABOVE:\n"""\n${message}\n"""\n\nEVERYTHING YOU KNOW ABOUT THEM (grounding context — use it to answer, never just summarize it):\n${context}\n\nNow write ONLY your reply to: "${message}"`;

  let raw = await callModel({ system: CHAT_PROMPT.system, user, maxTokens });
  if (!raw) raw = await callModel({ system: CHAT_PROMPT.system, user, maxTokens, temperature: 0.5 }); // one clean retry on empty
  if (!raw || !postGate(raw).ok) return { text: "", source: "fallback", mode: c.responseMode };

  // ── Pass 2b: grounding guard (+ one repair) ──
  const g = checkGrounding(message, raw, c);
  if (g.ok) return { text: raw, source: "model", mode: c.responseMode };

  const repairUser = `${user}\n\nREVISION REQUIRED — ${repairDirective(g.issues, c)}\n\nRewrite your reply now, obeying the mode.`;
  const repaired = await callModel({ system: CHAT_PROMPT.system, user: repairUser, maxTokens, temperature: 0.3 });
  if (repaired && postGate(repaired).ok && checkGrounding(message, repaired, c).ok) {
    return { text: repaired, source: "model", mode: c.responseMode };
  }
  // Still over-reaching on a low-intent turn → return a safe, grounded acknowledgement
  // rather than shipping invented coaching.
  if (c.responseMode === "ACKNOWLEDGE" || c.responseMode === "REFLECT") {
    return { text: minimalAcknowledgement(c), source: "model", mode: c.responseMode };
  }
  return { text: (repaired && postGate(repaired).ok) ? repaired : raw, source: "model", mode: c.responseMode };
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
