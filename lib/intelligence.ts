/**
 * THE DEPTH LAYER — what makes Synapse feel like it knows you and evolves.
 * Pure, deterministic signals derived from the user's own data, reused by the
 * dashboard, the weekly report, and the agent's context.
 */
import { computeTrend, relativeLevel } from "@/lib/stats";
import { computeAssociations } from "@/lib/correlations";
import { METRIC_META, metricLabel } from "@/lib/metrics";
import { getPath, goalMetricsForPath } from "@/lib/paths";
import type { CheckIn, ContextNote, Profile, UnderstandingSnapshot } from "@/components/providers/health-store";
import type { Confidence, MetricKey, MetricSeries, RecentChange } from "@/types";

const dayKey = (iso: string) => iso.slice(0, 10);
const daysSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 864e5));
function agoPhrase(days: number): string {
  if (days <= 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 45) return `a few weeks ago`;
  if (days < 75) return "about a month ago";
  return "a while back";
}

export interface Streak { totalDays: number; currentStreak: number; }

export function computeStreak(checkIns: CheckIn[]): Streak {
  const days = [...new Set(checkIns.map((c) => dayKey(c.date)))].sort();
  const totalDays = days.length;
  let streak = 0;
  const set = new Set(days);
  const d = new Date();
  // count consecutive days ending today or yesterday
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  for (;;) {
    if (set.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return { totalDays, currentStreak: streak };
}

/** A milestone worth celebrating right now (or null). */
export function currentMilestone(s: Streak): string | null {
  const dayMarks = [90, 60, 30, 14, 7];
  for (const m of dayMarks) if (s.totalDays === m) return `You've tracked ${m} days with Synapse — that consistency is exactly what sharpens your insights.`;
  const streakMarks = [30, 14, 7, 3];
  for (const m of streakMarks) if (s.currentStreak === m) return `${m}-day check-in streak — beautifully consistent.`;
  if (s.totalDays === 1) return "Your very first check-in is in. This is where your baseline begins.";
  return null;
}

interface MetricStatus { metric: MetricKey; label: string; worth: number; stable: boolean; declining: boolean; }

function statuses(series: MetricSeries[], goals: MetricKey[]): MetricStatus[] {
  return series.map((s) => {
    const t = computeTrend(s);
    const higher = METRIC_META[s.metric].direction === "higher_is_better";
    const declining = higher ? t.delta < -3 : t.delta > 3;
    const stable = t.n >= 4 && t.volatility < 8 && Math.abs(t.delta) < 4;
    const worth =
      (declining ? 1.2 : 0) + Math.min(1, t.volatility / 12) + Math.min(1, Math.abs(t.slope) / 4) +
      (goals.includes(s.metric) ? 0.6 : 0) - (stable ? 0.8 : 0);
    return { metric: s.metric, label: metricLabel(s.metric), worth, stable, declining };
  });
}

/** Areas Synapse is actively watching now (most "worth attention"). */
export function focusAreas(series: MetricSeries[], path: string): string[] {
  const st = statuses(series, goalMetricsForPath(path)).sort((a, b) => b.worth - a.worth);
  const picked = st.filter((x) => x.worth > 0.3).slice(0, 3).map((x) => x.label);
  return picked.length ? picked : st.slice(0, 2).map((x) => x.label);
}

/** "We've eased off X (now steady); we're watching Y instead." */
export function focusEvolution(prev: string[], current: string[], series: MetricSeries[], path: string): string | null {
  if (!prev.length) return null;
  const st = statuses(series, goalMetricsForPath(path));
  const dropped = prev.filter((p) => !current.includes(p));
  const added = current.filter((c) => !prev.includes(c));
  const droppedStable = dropped.find((d) => st.find((x) => x.label === d)?.stable);
  if (droppedStable && added.length) {
    return `We've eased off ${droppedStable.toLowerCase()} — it's settled into a steady place. Lately I'm watching your ${added[0].toLowerCase()} more closely, since it's where the movement is.`;
  }
  if (added.length && dropped.length) return `Your focus is shifting from ${dropped[0].toLowerCase()} toward ${added[0].toLowerCase()} as your patterns change.`;
  return null;
}

function list(a: string[]): string { return a.length <= 1 ? (a[0] ?? "") : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`; }

export interface Curiosity { prompt: string; chips: string[]; }

/** A question Synapse genuinely wants to ask, to fill a context gap. */
export function curiosityQuestion(series: MetricSeries[], path: string, recent: RecentChange[]): Curiosity {
  const fatigueUp = recent.find((c) => c.metric === "fatigue" && !c.improving);
  const sleepDown = recent.find((c) => c.metric === "sleep_quality" && !c.improving);
  const focusChanged = recent.find((c) => c.metric === "attention");
  if (fatigueUp) return { prompt: "Your energy's dipped a little lately. Has anything shifted in your routine or sleep this week?", chips: ["Sleeping less", "More stress", "Training harder", "New medication", "Nothing major"] };
  if (sleepDown) return { prompt: "Your sleep felt less restorative recently. Anything changing your evenings or schedule?", chips: ["Later nights", "More screen time", "Stress", "Travel", "Not sure"] };
  if (focusChanged) return { prompt: "Your focus has been moving. Has your mental workload changed lately?", chips: ["Busier at work/school", "Lighter load", "More stress", "Better rest", "No change"] };
  if (getPath(path).isRecovery) return { prompt: "Before your next report — any changes in your recovery this week worth noting?", chips: ["Started PT", "Less pain", "More pain", "New routine", "Nothing major"] };
  return { prompt: "Did anything significant happen this week I should factor in?", chips: ["Routine changed", "More stress", "Slept differently", "New medication", "Nothing major"] };
}

/* ============================================================================
 * MEMORY — Synapse's defining feature. It naturally references things the user
 * told it weeks ago and ties them to what the data is doing now. Deterministic
 * so it works offline; the live model deepens it but never needs to for value.
 * ========================================================================== */

/** A single sentence that proves Synapse remembers — or null when there's nothing earned yet. */
export function synapseMemory(
  profile: Pick<Profile, "displayName" | "goals" | "primaryChallenge" | "onboardedAt">,
  notes: ContextNote[],
  recent: RecentChange[],
): string | null {
  const improving = recent.filter((c) => c.improving).map((c) => c.label.toLowerCase());
  const anchorGoal = profile.primaryChallenge || profile.goals[0];

  // Strongest memory: tie an early-stated goal to present-day progress.
  if (anchorGoal && improving.length && profile.onboardedAt) {
    const when = agoPhrase(daysSince(profile.onboardedAt));
    return `When we started ${when}, you told me ${anchorGoal.toLowerCase()} mattered most to you. Looking across your check-ins since, your ${list(improving.slice(0, 2))} ${improving.length === 1 ? "has" : "have"} been trending the right way — I think we're starting to see real progress toward that.`;
  }

  // Next best: surface the oldest meaningful thing they told Synapse in a check-in.
  const oldest = [...notes].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (oldest) {
    const when = agoPhrase(daysSince(oldest.date));
    return `You mentioned ${when} that ${oldest.answer.toLowerCase().replace(/\.$/, "")}. I've kept that in mind while reading your trends — and I'll bring it up if the picture changes.`;
  }

  // Earliest stage: at least acknowledge the goal so memory is present from day one.
  if (anchorGoal) {
    return `I'm holding onto what you told me matters most — ${anchorGoal.toLowerCase()} — and watching every check-in with that in view.`;
  }
  return null;
}

/* ============================================================================
 * RECOMMENDATION — one concrete, gentle thing to consider this week, with the
 * full reasoning behind it ("Explain why"). Never medical; always behavioral.
 * ========================================================================== */

export interface ExplainWhy {
  whatChanged: string;
  whyNoticed: string;
  evidence: string;
  confidence: Confidence;
  whyMatters: string;
  /** Other plausible explanations for the same pattern — honesty over neatness. */
  alternatives: string;
  /** What new information would change this recommendation. */
  wouldChange: string;
}
export interface Recommendation {
  id: string;
  title: string;
  body: string;
  metric?: MetricKey;
  why: ExplainWhy;
}

const REC_COPY: Partial<Record<MetricKey, { title: string; body: string; matters: string; alt: string }>> = {
  sleep_quality: { title: "Protect a consistent sleep window", body: "Try keeping your bed and wake times within about a 30-minute range this week — consistency tends to matter more than total hours.", matters: "Across your own check-ins, steadier sleep has lined up with your better days, so it's a high-leverage lever to hold steady.", alt: "A stretch of late nights, travel, or a temporary schedule change could explain this just as well as a deeper pattern." },
  fatigue: { title: "Build in one real recovery block", body: "Pick one day this week for a genuinely lighter load — your energy readings suggest you've been running a little closer to empty.", matters: "Letting energy recover deliberately tends to protect the other trends Synapse watches, rather than letting a dip compound.", alt: "A heavy week, an illness coming on, or harder training could each explain lower energy on their own." },
  stress: { title: "Add a small daily decompress", body: "A five-minute wind-down at the same time each day — a walk, breathing, anything that's yours. Small and repeatable beats occasional and big.", matters: "Stress quietly colors sleep, focus, and mood, so easing it a little often lifts several trends at once.", alt: "A temporary crunch at work or school could account for this without it becoming a lasting pattern." },
  attention: { title: "Guard one focus block a day", body: "Protect a single 25-minute, distraction-free block for what matters most. One clean block beats a scattered hour.", matters: "Your attention readings move with how protected your focus time is — so this is something you can directly influence.", alt: "Testing in a distracting environment or at a different time of day can move attention scores this much on its own." },
  reaction_time: { title: "Keep your check-ins steady", body: "Try to take your check-ins around the same time of day. It removes noise so the real signal in your reaction time comes through.", matters: "Reaction time is sensitive to timing and rest, so consistent measurement makes everything Synapse tells you more trustworthy.", alt: "Time of day, caffeine, and device differences all nudge reaction scores — this may be measurement, not you." },
  mood: { title: "Notice what lifts your day", body: "Jot a quick note on the days that feel good. Naming what helps makes it easier to do more of it on purpose.", matters: "Mood is one of your most responsive signals — small intentional inputs show up quickly.", alt: "A single hard day weighs heavily in a short window — this may reflect one rough patch rather than a trend." },
  working_memory: { title: "Short, frequent beats long, rare", body: "A few minutes of focused mental work daily does more than one long session. Keep it light and regular this week.", matters: "Working memory responds to steady, low-pressure practice rather than cramming.", alt: "Fatigue or stress during the task itself can lower scores without any real change in memory." },
  processing_speed: { title: "Give speed tasks a clean run", body: "Take this week's tasks somewhere quiet, at a consistent time. Processing speed rewards a fair test.", matters: "Speed is one of the earliest signals to move when rest and focus change, so a clean read on it is valuable.", alt: "Speed scores are sensitive to focus, device, and input differences between sessions." },
  symptoms: { title: "Log symptoms while they're fresh", body: "A quick note on days symptoms interfere keeps the picture honest — timing and context matter as much as intensity.", matters: "Symptom timing is often what connects the rest of your trends together for your provider.", alt: "Symptom load naturally fluctuates day to day — a short flare doesn't necessarily mean the overall course changed." },
};

/** The single most useful thing to consider this week, with its reasoning. */
export function todaysRecommendation(series: MetricSeries[], path: string, recent: RecentChange[]): Recommendation {
  const st = statuses(series, goalMetricsForPath(path)).sort((a, b) => b.worth - a.worth);
  const watch = st.find((s) => s.declining) ?? st[0];
  const win = recent.find((c) => c.improving);

  // If something's slipping, that's the priority — gently.
  if (watch && (watch.declining || !win)) {
    const copy = REC_COPY[watch.metric] ?? REC_COPY.sleep_quality!;
    const t = computeTrend(series.find((s) => s.metric === watch.metric)!);
    const label = metricLabel(watch.metric).toLowerCase();
    return {
      id: `rec_${watch.metric}`,
      title: copy.title,
      body: copy.body,
      metric: watch.metric,
      why: {
        whatChanged: watch.declining ? `Your ${label} has eased off a little compared with your usual range.` : `Your ${label} is the area with the most movement right now.`,
        whyNoticed: `It's one of the trends I watch most closely for your goals, and it stood out across your recent check-ins.`,
        evidence: `Based on ${t.n} check-in${t.n === 1 ? "" : "s"} — latest around ${Math.round(t.latest)} versus a baseline near ${Math.round(t.baseline)} (0–100 scale).`,
        confidence: t.confidenceCeiling,
        whyMatters: copy.matters,
        alternatives: copy.alt,
        wouldChange: `A few more check-ins would sharpen this. If your ${label} returns to its usual range, I'll shift focus elsewhere; if it keeps drifting on good data, my confidence rises and it becomes worth mentioning to your provider.`,
      },
    };
  }

  // Otherwise reinforce what's working.
  const winLabel = win?.label.toLowerCase() ?? "your overall trend";
  return {
    id: "rec_keep_going",
    title: "Keep doing what's working",
    body: `Your ${winLabel} is heading the right way. The most valuable thing this week is simply not to change much — let the routine that's working keep working.`,
    metric: win?.metric,
    why: {
      whatChanged: `Your ${winLabel} has been trending up lately.`,
      whyNoticed: `I compare each week against your own baseline, and this one is clearly positive.`,
      evidence: win ? `A move of about ${Math.abs(win.deltaNorm)} points versus your recent baseline.` : `Your trends are holding steady with no areas of concern.`,
      confidence: "moderate",
      whyMatters: `Protecting a routine that's working is underrated — consistency is what turns a good week into a real trend.`,
      alternatives: `It's possible the recent good stretch reflects an easier week rather than a durable change — time will tell us which.`,
      wouldChange: `If the next couple of check-ins dip below your baseline, I'd move from "protect the routine" to looking at what changed.`,
    },
  };
}

/* ============================================================================
 * SESSION OPENER — the first 30 seconds. Synapse should never present an empty
 * dashboard; it always arrives having "looked over everything" with 1–3 things
 * to say. This drives the orb greeting at the top of the home screen.
 * ========================================================================== */

export interface OpenerHighlight { tone: "celebrate" | "good" | "watch" | "neutral"; text: string; }
export interface SessionOpener {
  lead: string;            // "I've looked over everything since we last talked."
  highlights: OpenerHighlight[];
  memory: string | null;
  recommendation: Recommendation;
}

export function sessionOpener(
  profile: Pick<Profile, "displayName" | "goals" | "primaryChallenge" | "onboardedAt" | "path">,
  series: MetricSeries[],
  recent: RecentChange[],
  notes: ContextNote[],
  checkIns: CheckIn[],
  dailyDone: boolean,
  weeksTracked: number,
): SessionOpener {
  const streak = computeStreak(checkIns);
  const milestone = currentMilestone(streak);
  const improving = recent.filter((c) => c.improving);
  const watching = recent.filter((c) => !c.improving);

  const highlights: OpenerHighlight[] = [];
  if (milestone) highlights.push({ tone: "celebrate", text: milestone });
  if (improving.length) highlights.push({ tone: "good", text: `Your ${list(improving.slice(0, 2).map((c) => c.label.toLowerCase()))} ${improving.length === 1 ? "is" : "are"} trending the right way.` });
  if (watching.length) highlights.push({ tone: "watch", text: `I'm keeping a gentle eye on your ${watching[0].label.toLowerCase()} — nothing alarming, just worth noticing.` });
  if (!highlights.length) {
    highlights.push({ tone: "neutral", text: weeksTracked < 2 ? "We're still building your baseline — a couple more check-ins and your patterns come into focus." : "Things are holding steady this week, which is its own kind of good news." });
  }

  // Welcome-back awareness: if it's been a while, say so and pick up naturally.
  const lastCheckIn = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
  const gapDays = lastCheckIn ? daysSince(lastCheckIn.date) : 0;

  const count = highlights.filter((h) => h.tone !== "neutral").length;
  const found = count >= 2 ? `I found ${count} patterns worth sharing` : count === 1 ? `I found one pattern worth sharing` : "";
  const lead = gapDays >= 14
    ? `Welcome back — it's been ${agoPhrase(gapDays)} since your last check-in. Everything you've told me is still right here${found ? `, and ${found.charAt(0).toLowerCase()}${found.slice(1)}` : ""}. Picking back up is easy.`
    : count >= 1
    ? `I've reviewed everything since we last talked, and ${found.charAt(0).toLowerCase()}${found.slice(1)}.`
    : `I've reviewed everything so far. Here's where things stand.`;

  return {
    lead,
    highlights: highlights.slice(0, 3),
    memory: synapseMemory(profile, notes, recent),
    recommendation: todaysRecommendation(series, profile.path, recent),
  };
}

/* ============================================================================
 * EVOLVING UNDERSTANDING — the Health Profile should GROW, not just update.
 * currentUnderstanding() captures Synapse's read right now; the store logs these
 * over time; profileEvolution() narrates how that understanding has shifted.
 * ========================================================================== */

export interface Understanding { focus: string[]; leadMetric?: MetricKey; read: string; }

/** Synapse's read of the user right now — focus areas, the clearest signal, one line. */
export function currentUnderstanding(series: MetricSeries[], path: string, recent: RecentChange[]): Understanding {
  const focus = focusAreas(series, path);
  const st = statuses(series, goalMetricsForPath(path)).sort((a, b) => b.worth - a.worth);
  const lead = st[0];
  const watch = recent.filter((c) => !c.improving);
  const up = recent.filter((c) => c.improving);
  const read = watch.length
    ? `Right now, your ${watch[0].label.toLowerCase()} is where the movement is, so it has most of my attention.`
    : up.length
    ? `Lately your ${up[0].label.toLowerCase()} stands out most — it's been the clearest positive signal.`
    : "Things look steady, so I'm keeping a broad, even watch rather than zeroing in on any one thing.";
  return { focus, leadMetric: lead?.metric, read };
}

const normFocus = (s: string) => s.toLowerCase().replace(/ quality| time| level/g, "").trim();

export interface Evolution {
  headline: string;
  shifts: string[];
  from: UnderstandingSnapshot;
  to: UnderstandingSnapshot;
}

/** How Synapse's understanding has changed from the earliest snapshot to the latest. */
export function profileEvolution(log: UnderstandingSnapshot[]): Evolution | null {
  if (log.length < 2) return null;
  const from = log[0];
  const to = log[log.length - 1];
  if (from.date.slice(0, 10) === to.date.slice(0, 10)) return null;

  const fromTokens = new Set(from.focus.map(normFocus));
  const toTokens = new Set(to.focus.map(normFocus));
  const dropped = from.focus.filter((f) => !toTokens.has(normFocus(f)));
  const added = to.focus.filter((f) => !fromTokens.has(normFocus(f)));

  const shifts: string[] = [];
  for (const f of dropped.slice(0, 2)) shifts.push(`${f} is no longer one of your main focuses — it's settled into a steadier place.`);
  for (const f of added.slice(0, 2)) shifts.push(`${f} has become something I'm watching more closely.`);
  if (to.leadMetric && (!from.leadMetric || from.leadMetric !== to.leadMetric)) {
    shifts.push(`Your ${metricLabel(to.leadMetric).toLowerCase()} has become one of your most telling signals.`);
  }
  if (!shifts.length) {
    shifts.push(`Your focus has held steady — ${list(to.focus.slice(0, 2).map((f) => f.toLowerCase()))} remain central. Consistency like that is exactly what makes my read of you reliable.`);
  }

  return {
    headline: `Here's how my understanding of you has grown since ${agoPhrase(daysSince(from.date))}.`,
    shifts,
    from,
    to,
  };
}

/* ============================================================================
 * DAILY REFLECTION — the instant, specific read Synapse gives the moment a
 * check-in lands. NOT a restatement of the sliders: it places today in context
 * (vs the user's own baseline), connects it to a real pattern from the
 * association engine, gives ONE direct action, and names what it will watch.
 * Deterministic, so it's instant and free; the model can enrich it later.
 * ========================================================================== */

/** Direct, behavioral (never medical) actions, led by the verb. */
const DIRECT_ACTION: Partial<Record<MetricKey, string>> = {
  sleep_quality: "Tonight, guard a consistent lights-out time — even 30 minutes earlier and steadier is the highest-leverage move you have right now.",
  fatigue: "Build one genuine recovery block into tomorrow — a lighter load or a real break — before your energy compounds downward.",
  stress: "Take five minutes today to decompress on purpose — a walk or slow breathing — rather than pushing straight through.",
  attention: "Protect a single 25-minute, distraction-free block tomorrow for what matters most, and notice how it feels.",
  mood: "Do one small thing today that reliably lifts you, and jot down what it was — naming it makes it repeatable.",
  reaction_time: "Take tomorrow's check-in at the same time of day — it strips out noise so the real signal shows.",
  working_memory: "Keep mental work short and frequent tomorrow rather than one long push.",
  processing_speed: "Give tomorrow's tasks a quiet, consistent setting so the read is fair.",
  symptoms: "Note when symptoms interfere today while it's fresh — timing is what connects the rest of the picture.",
};

export interface DailyReflection {
  lead: string;
  points: string[];
  action: string | null;
  watch: string | null;
  confidence: Confidence;
}

/**
 * Build the post-check-in reflection from the user's series (which now includes
 * today as the latest point) plus their chosen path.
 */
export function dailyReflection(series: MetricSeries[], path: string): DailyReflection {
  const goals = goalMetricsForPath(path);
  // Biggest concerning + biggest encouraging mover today vs the user's baseline.
  type Mover = { metric: MetricKey; label: string; latest: number; delta: number; improving: boolean; n: number };
  const movers: Mover[] = [];
  for (const s of series) {
    const t = computeTrend(s);
    if (t.n < 2 || Math.abs(t.delta) < 4) continue;
    const higher = METRIC_META[s.metric].direction === "higher_is_better";
    movers.push({
      metric: s.metric, label: metricLabel(s.metric), latest: Math.round(t.latest),
      delta: Math.round(t.delta), improving: higher ? t.delta > 0 : t.delta < 0, n: t.n,
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const assoc = computeAssociations(series, goals, 4);
  const points: string[] = [];

  const concern = movers.find((m) => !m.improving);
  const win = movers.find((m) => m.improving);
  const headliner = concern ?? win ?? movers[0];

  let lead: string;
  if (!headliner) {
    lead = "Today sits right in line with your usual range, which is its own kind of good news.";
  } else {
    const tone = headliner.improving ? "and that's a genuine step in the right direction" : "worth a soft eye, not worry";
    lead = `The thing that stands out: your ${headliner.label.toLowerCase()} is sitting ${relativeLevel(headliner.latest, headliner.latest - headliner.delta)} — ${tone}.`;
  }

  // Connect today's headliner to a real pattern (the eye-opening part).
  if (headliner) {
    const lag = assoc.find((a) => a.kind === "lag" && a.metrics[0] === headliner.metric);
    const linked = assoc.find((a) => a.metrics.includes(headliner.metric));
    if (lag) {
      const follow = metricLabel(lag.metrics[1]).toLowerCase();
      points.push(`Here's why it matters: in your own data, your ${headliner.label.toLowerCase()} tends to run a day ahead of your ${follow}. So today's reading is a hint about how your ${follow} may feel tomorrow.`);
    } else if (linked && linked.kind !== "lag") {
      points.push(`Here's a pattern I've been seeing in you: ${linked.plain}`);
    }
  }

  // A second, connecting point if there's both a win and a concern today.
  if (concern && win && concern.metric !== win.metric) {
    points.push(`Interestingly, even as your ${concern.label.toLowerCase()} dipped, your ${win.label.toLowerCase()} held up — the picture isn't all one direction.`);
  }

  const action = headliner && !headliner.improving ? (DIRECT_ACTION[headliner.metric] ?? null)
    : win ? "The most valuable move is to not change much — let the routine that's working keep working."
    : null;

  const watchMetric = concern ?? headliner;
  const watch = watchMetric ? `I'll watch your ${watchMetric.label.toLowerCase()} over your next couple of check-ins — if it settles back, I'll let it go; if it keeps drifting, I'll flag it.` : null;

  const minN = headliner ? headliner.n : Math.max(0, ...series.map((s) => s.points.length));
  const confidence: Confidence = minN < 3 ? "low" : assoc.length ? "moderate" : "moderate";

  return { lead, points, action, watch, confidence };
}
