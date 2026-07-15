/**
 * DETERMINISTIC COACH-VOICE RENDERER
 * ----------------------------------
 * When a live model is unavailable (mock mode / no API key), the agent still
 * produces REAL output by templating the deterministic stats into warm,
 * coach-voice language. This is the fallback half of ai/pipeline.ts — the
 * same evidence the live model would receive, phrased under the personality
 * charter's rules in code. It keeps the product fully functional offline.
 */

import { metricLabel, METRIC_META } from "@/lib/metrics";
import { computeTrend, detectPatterns, SALIENCE_THRESHOLD, type PatternCandidate, type TrendStat } from "@/lib/stats";
import { computeAssociations, type Association } from "@/lib/correlations";
import { goalMetricsForPath } from "@/lib/paths";
import type {
  Confidence,
  Insight,
  MetricKey,
  MetricSeries,
  ProactiveNotice,
  HealthProfile,
  HealthReport,
} from "@/types";

const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/** Is the observed delta an improvement, given the metric's direction? */
function isImprovement(t: TrendStat): boolean {
  const higher = METRIC_META[t.metric].direction === "higher_is_better";
  return higher ? t.delta > 0 : t.delta < 0;
}

function trendInsight(t: TrendStat): Insight | null {
  if (t.n < 2 || Math.abs(t.delta) < 3) return null;
  const label = metricLabel(t.metric).toLowerCase();
  const improving = isImprovement(t);
  const observation = improving
    ? `Your ${label} has been trending in the right direction — a steady, encouraging climb.`
    : `Your ${label} dipped a little compared to your usual. The kind of gentle wobble that's worth a soft eye, not worry.`;
  const reasoning = improving
    ? `Across your recent check-ins this has moved consistently the right way, and you've been showing up regularly — that consistency is part of why the signal is clear.`
    : `Single weeks bounce around with sleep, stress, and daily life. What matters is the direction over several weeks, and one dip doesn't undo your progress.`;
  return {
    id: id("ins"),
    category: improving ? "observation" : "behavioral_focus",
    observation,
    reasoning,
    suggestedFocus: improving ? ["Keep the routine that's clearly working for you"] : ["Notice how you feel at the time you take each assessment"],
    questionsForProvider: [],
    confidence: t.confidenceCeiling,
    confidenceRationale:
      t.confidenceCeiling === "high"
        ? "Several consistent weeks with low week-to-week noise."
        : t.confidenceCeiling === "moderate"
        ? "A real trend, but enough variability that I'm staying measured."
        : "Only a little data so far — this will sharpen with more check-ins.",
    evidenceRefs: [`metric:${t.metric}`],
    uncertaintyFlags: t.flags,
    alternativeExplanation: improving
      ? "An easier stretch of days could be flattering the numbers a little — a few more weeks will tell us if it's durable."
      : "Ordinary life noise — a rough night, a stressful day, or testing at a different time — could explain a dip this size on its own.",
    wouldChange: improving
      ? `If the trend holds through the next two check-ins, my confidence rises; if it reverses, I'd treat this as a good stretch rather than a change.`
      : `If your ${label} returns to its usual range next check-in, I'd let this go; if it keeps drifting, it becomes worth mentioning to your provider.`,
    createdAt: new Date().toISOString(),
  };
}

function patternNotice(p: PatternCandidate): ProactiveNotice {
  const labels = p.metrics.map((m) => metricLabel(m).toLowerCase());
  let observation = "";
  let reasoning = "";
  let tone: ProactiveNotice["tone"] = "watchful";

  if (p.type === "divergence") {
    observation = `I've noticed your ${labels[0]} has steadily increased over the past few weeks, even though your ${labels[1]} has held steady.`;
    reasoning = `Your timed performance hasn't slipped, which is genuinely reassuring — so this looks more like how rested you've been feeling than a change in performance. Recovery and fatigue often move together, so it's worth keeping a gentle eye on rather than worrying about.`;
    tone = "watchful";
  } else if (p.type === "milestone") {
    observation = `Nice — your ${labels[0]} has reached a meaningful improvement above where you started.`;
    reasoning = `That's the kind of sustained gain that reflects real, consistent effort. Let yourself feel good about it.`;
    tone = "celebratory";
  } else if (p.type === "sustained_trend") {
    observation = `I've noticed a steady, multi-week trend in your ${labels[0]}.`;
    reasoning = `It's been moving consistently rather than bouncing around, which is exactly the kind of pattern worth being aware of.`;
    tone = "watchful";
  } else {
    observation = `I spotted a pattern in your ${labels.join(" and ")} worth a gentle mention.`;
    reasoning = `It stood out across several weeks of your check-ins.`;
    tone = "informational";
  }

  return {
    id: id("pn"),
    category: "observation",
    patternType: p.type,
    tone,
    salience: p.salience,
    surfacedAt: new Date().toISOString(),
    dedupeKey: p.dedupeKey,
    observation,
    reasoning,
    suggestedFocus:
      tone === "watchful"
        ? ["Aim for a consistent sleep window this week", "Notice how you feel at assessment time"]
        : ["Keep doing what's working"],
    questionsForProvider:
      tone === "watchful"
        ? ["Is this expected at my stage of recovery?", "Any pacing strategies you'd suggest?"]
        : [],
    confidence: p.confidenceCeiling,
    confidenceRationale:
      "Based on several weeks of your own check-ins; some signals are self-reported, so I'm staying measured.",
    evidenceRefs: p.metrics.map((m) => `metric:${m}`),
    uncertaintyFlags: ["self_reported"],
    alternativeExplanation:
      tone === "watchful"
        ? "A demanding stretch — poorer sleep, travel, extra stress — could produce this same pattern without anything deeper going on."
        : "It's possible a favorable stretch of days is helping the numbers along.",
    wouldChange:
      tone === "watchful"
        ? "A couple of check-ins back in your usual range and I'd stand down; continued drift on good data and I'd suggest raising it with your provider."
        : "I'll keep confirming it against your baseline as more check-ins come in.",
    createdAt: new Date().toISOString(),
  };
}

/** Turn a computed association into a direct, connective insight. */
function associationInsight(a: Association): Insight {
  const [m0, m1] = a.metrics;
  const l0 = metricLabel(m0).toLowerCase();
  const l1 = metricLabel(m1).toLowerCase();
  const focus =
    a.kind === "lag"
      ? [`Use your ${l0} as an early signal for your ${l1} — protecting ${l0} today is really an investment in tomorrow's ${l1}.`]
      : a.kind === "contrast"
      ? [`On the days that go well, your ${l1} is clearly different — treat ${l1} as a lever worth pulling.`]
      : [`When you work on your ${l0}, expect your ${l1} to move with it.`];
  return {
    id: id("ins"),
    category: "behavioral_focus",
    observation:
      a.kind === "lag"
        ? `There's a lead-and-follow pattern in your data: your ${l0} tends to run a day ahead of your ${l1}.`
        : a.kind === "contrast"
        ? `Your best and toughest days are separated most by one thing — your ${l1}.`
        : `Two of your signals move together: your ${l0} and your ${l1}.`,
    reasoning: a.plain,
    suggestedFocus: focus,
    questionsForProvider: [],
    confidence: a.confidence,
    confidenceRationale:
      a.confidence === "high"
        ? `A clear relationship across ${a.n} of your own days.`
        : a.confidence === "moderate"
        ? `A real relationship across ${a.n} days, though I'm staying measured — self-reported signals carry noise.`
        : `Only ${a.n} days so far — this is an early read that will firm up with more check-ins.`,
    evidenceRefs: a.metrics.map((m) => `metric:${m}`),
    uncertaintyFlags: a.n < 5 ? ["small_sample"] : [],
    alternativeExplanation:
      "Two things can move together because a third thing (a busy stretch, poor sleep, travel) drives both — association isn't causation.",
    wouldChange:
      "If the relationship weakens as more days come in, I'll drop it; if it holds, it becomes something you can act on with confidence.",
    createdAt: new Date().toISOString(),
  };
}

function overallConfidence(trends: TrendStat[]): Confidence {
  const minN = Math.min(...trends.map((t) => t.n));
  if (minN < 3) return "low";
  if (trends.some((t) => t.confidenceCeiling === "moderate")) return "moderate";
  return "high";
}

export function renderReport(serieses: MetricSeries[], profile: HealthProfile & { path?: string }): HealthReport {
  const trends = serieses.map(computeTrend);
  const improving = trends.filter(isImprovement).map((t) => metricLabel(t.metric).toLowerCase());
  const watch = trends.filter((t) => !isImprovement(t) && Math.abs(t.delta) >= 4).map((t) => metricLabel(t.metric).toLowerCase());

  // The relationships in the data — the non-obvious, most valuable insights.
  const associations = computeAssociations(serieses, goalMetricsForPath(profile.path), 3);
  const assocInsights = associations.map(associationInsight);
  const lead = associations[0];
  const leadLine = lead ? ` The most useful thing I see: ${lead.plain}` : "";

  const goodPart = improving.length ? `your ${improving.slice(0, 2).join(" and ")} ${improving.length === 1 ? "is" : "are"} trending the right way` : "you're holding steady";
  const watchPart = watch.length ? ` I'm keeping a gentle eye on your ${watch[0]}.` : "";
  const summary = `You've put in good, consistent work this week, ${profile.displayName}. ${goodPart.charAt(0).toUpperCase()}${goodPart.slice(1)}.${watchPart}${leadLine}`;

  const trendInsights = trends
    .map(trendInsight)
    .filter((x): x is Insight => x !== null)
    .sort((a, b) => (a.category === "observation" ? -1 : 1));

  // Lead with connective association insights, then fill with trend insights.
  const insights = [...assocInsights, ...trendInsights].slice(0, 4);

  // Next week's priorities — derived from the insights' behavioral focus.
  const nextWeek = Array.from(new Set(insights.flatMap((i) => i.suggestedFocus))).slice(0, 3);
  if (!nextWeek.length) nextWeek.push("Keep your check-ins steady — consistency is what makes next week's read sharper than this one.");

  // Always include one gentle educational note (separates education from observation).
  insights.push({
    id: id("ins"),
    category: "education",
    observation: "A little week-to-week wobble in scores is normal — recovery rarely moves in a straight line.",
    reasoning: "In general, cognitive and energy measures vary with sleep, stress, and daily life. The direction over several weeks tells the clearer story.",
    suggestedFocus: [],
    questionsForProvider: [],
    confidence: "high",
    confidenceRationale: "General educational context, not specific to a reading.",
    evidenceRefs: [],
    uncertaintyFlags: [],
    createdAt: new Date().toISOString(),
  });

  return {
    id: id("rep"),
    cycleLabel: "This week",
    summary,
    overallConfidence: overallConfidence(trends),
    insights,
    nextWeek,
    createdAt: new Date().toISOString(),
  };
}

/** A proactive notice built from a discovered association — the non-obvious kind. */
function associationNotice(a: Association): ProactiveNotice {
  const [m0, m1] = a.metrics;
  const l0 = metricLabel(m0).toLowerCase();
  const l1 = metricLabel(m1).toLowerCase();
  const observation =
    a.kind === "lag"
      ? `Here's something you might not have caught: your ${l0} tends to run a day ahead of your ${l1}.`
      : a.kind === "contrast"
      ? `Across your days, the biggest thing separating your best from your toughest is your ${l1}.`
      : `Two of your signals keep moving together: your ${l0} and your ${l1}.`;
  const suggestedFocus =
    a.kind === "lag"
      ? [`Treat your ${l0} as a lever for tomorrow's ${l1} — protect it today and watch what follows.`]
      : [`Put a little deliberate attention on your ${l1} this week and see whether the rest follows.`];
  return {
    id: id("pn"),
    category: "observation",
    patternType: "new_correlation",
    tone: "informational",
    salience: a.strength,
    surfacedAt: new Date().toISOString(),
    dedupeKey: `assoc:${a.kind}:${[...a.metrics].sort().join("+")}`,
    observation,
    reasoning: a.plain,
    suggestedFocus,
    questionsForProvider: [],
    confidence: a.confidence,
    confidenceRationale:
      a.confidence === "high"
        ? `A clear relationship across ${a.n} of your own days.`
        : a.confidence === "moderate"
        ? `Across ${a.n} days; I'm staying measured since self-reports carry noise.`
        : `An early read from ${a.n} days — it will sharpen with more check-ins.`,
    evidenceRefs: a.metrics.map((m) => `metric:${m}`),
    uncertaintyFlags: a.n < 5 ? ["small_sample"] : [],
    alternativeExplanation:
      "A third factor — a busy stretch, illness, travel — can drive two signals at once. Association isn't causation.",
    wouldChange:
      "If it holds as more days arrive, it's something you can act on with confidence; if it fades, I'll drop it.",
    createdAt: new Date().toISOString(),
  };
}

export function renderProactiveNotices(serieses: MetricSeries[], goals: MetricKey[]): ProactiveNotice[] {
  const fromPatterns = detectPatterns(serieses, goals).filter((p) => p.salience >= SALIENCE_THRESHOLD).map(patternNotice);
  const fromAssoc = computeAssociations(serieses, goals, 3).filter((a) => a.strength >= 0.55).map(associationNotice);
  const seen = new Set<string>();
  const out: ProactiveNotice[] = [];
  for (const n of [...fromAssoc, ...fromPatterns].sort((a, b) => b.salience - a.salience)) {
    if (seen.has(n.dedupeKey)) continue;
    seen.add(n.dedupeKey);
    out.push(n);
  }
  return out.slice(0, 4);
}
