"use client";

/**
 * OBLIGATIONS AWARENESS — the reality check on decision intelligence.
 *
 * The goals a person sets in Synapse are usually their OUTSIDE-of-obligation ambitions (a startup, a
 * research project, getting fit). Their actual day is often ruled by things that are NOT in that list
 * and that Synapse has no structured record of — classes, assignments, tests, work deadlines, chores.
 * Confidently telling someone to "work on your research" when they have 5 assignments and 2 tests due
 * makes them doubt the whole product. This block tells the model what it DOES know (goal deadlines,
 * promises) and, crucially, forces it to reckon with what it DOESN'T — ask about today's load before
 * prioritizing a self-set goal.
 */

import { activeGoals, daysUntilDue } from "@/lib/goals";
import { loadCommitments, openCommitment, commitmentAwaitingReport } from "@/lib/commitments";
import { plannerOpenTasks } from "@/lib/planner";

const NL = "\n";

export function topGoalTitle(): string {
  try { return activeGoals()[0]?.title || ""; } catch { return ""; }
}

/** Rough read on whether this person's days are dominated by school. */
export function looksLikeStudent(profile: { path?: string; goals?: string[]; focusAreas?: string[]; definitionOfBetter?: string; primaryChallenge?: string } | null | undefined): boolean {
  if (!profile) return false;
  if (profile.path === "mental_performance") return true;
  const hay = [
    ...(profile.focusAreas || []),
    ...(profile.goals || []),
    profile.definitionOfBetter || "",
    profile.primaryChallenge || "",
  ].join(" ").toLowerCase();
  return /\b(school|study|studying|class(es)?|exam|test|quiz|sat|act|ap |a\.p\.|gpa|college|homework|assignment|semester|midterm|final)\b/.test(hay);
}

/** Do we have any concrete signal of what's on their plate TODAY? (a promise, or a goal due very soon) */
export function todayLoadKnown(): boolean {
  try {
    if (openCommitment() || commitmentAwaitingReport()) return true;
    return activeGoals().some((g) => { const d = daysUntilDue(g); return d != null && d <= 1; });
  } catch { return false; }
}

export function obligationsContextBlock(profile?: { path?: string; goals?: string[]; focusAreas?: string[]; definitionOfBetter?: string; primaryChallenge?: string } | null): string {
  // The Planner (if they use it) is the real, structured record of what's due — treat it as source of truth.
  let planner: ReturnType<typeof plannerOpenTasks> = [];
  try { planner = plannerOpenTasks(); } catch {}
  const hasPlanner = planner.length > 0;

  const lines: string[] = [
    hasPlanner
      ? "REALITY CHECK — their goals here are their OUTSIDE-of-obligation ambitions; their day is also ruled by real to-dos. Their PLANNER (below) is your source of truth for what's actually due — plan around it, and don't push a self-set goal over work that's due today."
      : "REALITY CHECK — their goals here are their OUTSIDE-of-obligation ambitions. Their real day is usually dominated by things NOT in this app: classes, assignments, tests, work deadlines, chores. You do NOT have a reliable record of what's actually due for them TODAY.",
  ];

  if (hasPlanner) {
    const fmtDue = (t: (typeof planner)[number]) =>
      t.daysUntil == null ? "" : t.daysUntil < 0 ? ` — ${Math.abs(t.daysUntil)}d overdue` : t.daysUntil === 0 ? " — DUE TODAY" : t.daysUntil === 1 ? " — due tomorrow" : ` — due in ${t.daysUntil}d`;
    lines.push("Their Planner — open tasks (source of truth for what's due):\n" + planner.map((t) => `- ${t.text}${fmtDue(t)}`).join("\n"));
  }

  try {
    const goals = activeGoals();
    const due = goals
      .map((g) => ({ t: g.title, d: daysUntilDue(g) }))
      .filter((x) => x.d != null && (x.d as number) <= 14)
      .sort((a, b) => (a.d as number) - (b.d as number));
    if (due.length) {
      lines.push("Known goal deadlines: " + due.map((x) => `${x.t} (${(x.d as number) < 0 ? `${Math.abs(x.d as number)}d overdue` : `due in ${x.d}d`})`).join("; ") + ".");
    }
    const aw = commitmentAwaitingReport();
    const oc = openCommitment();
    if (aw) lines.push(`Open promise from before: "${aw.text}".`);
    else if (oc) lines.push(`Promise set today: "${oc.text}".`);
  } catch {}

  const student = looksLikeStudent(profile);
  lines.push(
    `Before you confidently tell them to work on a self-set goal, ACCOUNT for their real obligations. If you don't know today's load, ASK first${student ? " (they carry a heavy school load — ask what's due for school today before pushing an outside goal)" : ""} — e.g. "what's actually on your plate today — anything due?" On a heavy day, the right call is usually "handle the obligations; here's the ONE small way to keep [goal] alive," not "work on [goal]." A confident wrong call makes them doubt you.`,
  );

  return lines.join(NL);
}
