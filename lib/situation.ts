"use client";

/**
 * SITUATION SYNTHESIS — the whole board, in one read.
 *
 * Decision intelligence fails when it looks at one thing (the goal you set) and ignores everything
 * else acting on you. This folds ALL of it — active goals (priority, momentum, deadlines), the
 * Planner's open/ due tasks, open commitments, and how recently you've engaged — into a single
 * Situation, and flags the big forces: an OVERLOAD/collision of deadlines, an OBLIGATIONS-vs-GOALS
 * conflict (a heavy week where outside goals can't win), and DRIFT on something that matters. The
 * chat reasons over this; the opener and proactive nudges lead with it.
 */

import { activeGoals, daysSinceProgress, daysUntilDue, type Goal } from "@/lib/goals";
import { plannerOpenTasks } from "@/lib/planner";
import { openCommitment, commitmentAwaitingReport } from "@/lib/commitments";

export type TopSignal = "overload" | "conflict" | "drift" | "clear";

export interface DueItem { label: string; daysUntil: number; kind: "task" | "goal" }
export interface Situation {
  dueSoon: DueItem[];
  dueToday: DueItem[];
  overdue: DueItem[];
  overload: boolean;
  conflict: boolean;
  drift: { goal: string; days: number } | null;
  openPromise: string | null;
  topSignal: TopSignal;
  headline: string;
}

const SOON_DAYS = 5;

export function buildSituation(now: Date = new Date()): Situation {
  let goals: Goal[] = [];
  try { goals = activeGoals(); } catch {}
  let tasks: ReturnType<typeof plannerOpenTasks> = [];
  try { tasks = plannerOpenTasks(now, SOON_DAYS + 2); } catch {}

  const due: DueItem[] = [];
  for (const t of tasks) if (t.daysUntil != null && t.daysUntil <= SOON_DAYS) due.push({ label: t.text, daysUntil: t.daysUntil, kind: "task" });
  for (const g of goals) {
    const d = daysUntilDue(g);
    if (d != null && d <= SOON_DAYS) due.push({ label: g.title, daysUntil: d, kind: "goal" });
  }
  due.sort((a, b) => a.daysUntil - b.daysUntil);

  const overdue = due.filter((x) => x.daysUntil < 0);
  const dueToday = due.filter((x) => x.daysUntil === 0);
  const within2 = due.filter((x) => x.daysUntil >= 0 && x.daysUntil <= 2);

  // OVERLOAD: several things landing at once.
  const overload = within2.length >= 3 || dueToday.length >= 2 || overdue.length >= 2;

  // CONFLICT: real near-term obligations exist AND they hold outside/self-set goals → outside goals can't win this week.
  const realPressure = due.filter((x) => x.daysUntil <= 2).length >= 2 || overdue.length >= 1;
  const conflict = realPressure && goals.length > 0;

  // DRIFT: the most important non-habit goal untouched for a week+.
  let drift: Situation["drift"] = null;
  const important = goals.filter((g) => (g.priority === "primary" || g.priority === "high") && g.kind !== "habit");
  for (const g of important) {
    const days = daysSinceProgress(g);
    if (days != null && days >= 7 && (!drift || days > drift.days)) drift = { goal: g.title, days };
  }

  const aw = commitmentAwaitingReport();
  const oc = openCommitment();
  const openPromise = aw?.text || oc?.text || null;

  const topSignal: TopSignal = overload ? "overload" : conflict ? "conflict" : drift ? "drift" : "clear";

  const soonList = due.slice(0, 4).map((x) => `${x.label} (${x.daysUntil < 0 ? `${Math.abs(x.daysUntil)}d overdue` : x.daysUntil === 0 ? "today" : `${x.daysUntil}d`})`).join(", ");
  const headline =
    topSignal === "overload" ? `Overloaded: ${due.filter((x) => x.daysUntil <= 2).length + overdue.length} things due right around now (${soonList}). Protect the essential, let the rest slide honestly.`
    : topSignal === "conflict" ? `Heavy obligations right now (${soonList}) — this is a week to survive the deadlines and keep your goals barely alive, not push them.`
    : topSignal === "drift" ? `Drift: "${drift!.goal}" hasn't moved in ${drift!.days} days while attention went elsewhere.`
    : "";

  return { dueSoon: due, dueToday, overdue, overload, conflict, drift, openPromise, topSignal, headline };
}

/**
 * Notification-sized ADVICE from the current board — so a proactive reach-out transmits a real call,
 * not just "tap in". `advice` is the morning/first push; `followup` is the later check. null when the
 * board is clear (fall back to a gentle goal nudge).
 */
export function situationNudge(now: Date = new Date()): { advice: string; followup: string } | null {
  const s = buildSituation(now);
  if (s.topSignal === "clear") return null;
  const topDue = s.dueSoon[0]?.label;
  const crunchCount = s.dueSoon.filter((x) => x.daysUntil <= 2).length + s.overdue.length;

  if (s.topSignal === "overload") {
    return {
      advice: `Heads up — ${crunchCount} things are due right around now. Don't try to do them all: protect ${topDue || "the most important one"} first, and let the rest slide on purpose. Tap in and I'll help you triage.`,
      followup: topDue ? `Did ${topDue} get handled? If not, that's still the one — the rest can wait.` : `Did the top priority move today? Everything else can wait.`,
    };
  }
  if (s.topSignal === "conflict") {
    return {
      advice: `Survival week — real deadlines are stacking up${topDue ? ` (${topDue} first)` : ""}. Your outside goals can wait; just keep them alive. Tap in and I'll lay out what to clear.`,
      followup: `How are the deadlines going? Clear the obligations first — your goals will hold.`,
    };
  }
  // drift
  return {
    advice: `${s.headline} If it still matters, one small step gets you back in — tap and I'll make it tiny.`,
    followup: s.drift ? `Still worth it? Even 10 minutes on ${s.drift.goal} breaks the drift.` : `Worth a small step today to break the drift?`,
  };
}

/** The big-picture block the model reasons over. Empty when nothing meaningful is happening. */
export function situationContextBlock(now: Date = new Date()): string {
  const s = buildSituation(now);
  const NL = "\n";
  const lines: string[] = [
    "THE WHOLE BOARD (synthesize this before deciding anything — the biggest force here should lead your reply, not the first goal you see):",
  ];
  if (s.dueSoon.length) {
    lines.push("Due soon: " + s.dueSoon.map((x) => `${x.label} — ${x.daysUntil < 0 ? `${Math.abs(x.daysUntil)}d OVERDUE` : x.daysUntil === 0 ? "DUE TODAY" : `in ${x.daysUntil}d`}`).join("; ") + ".");
  }
  if (s.openPromise) lines.push(`Open promise: "${s.openPromise}".`);
  if (s.topSignal === "overload") lines.push(`SIGNAL — OVERLOAD. ${s.headline} Tell them what to protect and what to consciously drop; do NOT add to the pile.`);
  else if (s.topSignal === "conflict") lines.push(`SIGNAL — OBLIGATIONS BEAT GOALS THIS WEEK. ${s.headline} Say so plainly; the honest move is to clear the obligations and keep outside goals on life support, not advance them.`);
  else if (s.topSignal === "drift") lines.push(`SIGNAL — DRIFT. ${s.headline} If it still matters, name the drift gently and offer one small way back in; if they've outgrown it, help them update it.`);
  else lines.push("No acute pressure detected — a good moment to make real progress on what matters most; still confirm their actual day before pushing.");
  return lines.length > 1 ? lines.join(NL) : "";
}
