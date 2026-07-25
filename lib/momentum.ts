/**
 * MOMENTUM — a living estimate of how much forward movement this person's life has.
 *
 * The commitment loop tracks promises; MOMENTUM is the higher-order read those promises
 * feed. It is NOT a streak or a score shown to the user — it is an internal sense of the
 * trajectory of the RELATIONSHIP that lets Synapse time its judgment: build on a good run,
 * name a stuck obstacle, notice promises shrinking, protect a fragile week, or raise the
 * bar when it has been earned. Derived deterministically from the behavioral layer only
 * (commitments + focus history); the intelligence engine is untouched. Honest by design:
 * it says nothing until the pattern is real.
 */

import type { Commitment } from "@/lib/commitments";
import type { FocusLike } from "@/lib/commitments";

export type MomentumState = "early" | "steady" | "building" | "stalling" | "fracturing" | "recovering";
export type MomentumKind = "raise_bar" | "building" | "stuck" | "shrinking" | "fracturing" | "recovering" | null;

export interface MomentumRead {
  state: MomentumState;
  score: number;                 // 0..1, internal only
  kind: MomentumKind;            // the kind of the chosen observation
  observation: string | null;    // the one well-timed thing to voice (or null)
}

const WINDOW_MS = 28 * 864e5;
const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
const words = (t: string) => norm(t).split(" ").filter(Boolean).length;
const daysBetween = (a: number, b: number) => Math.floor((a - b) / 864e5);

/** Read the trajectory of the relationship from the promises made and kept. */
export function readMomentum(commitments: Commitment[], focus: FocusLike[] = [], now = new Date()): MomentumRead {
  const t = now.getTime();
  const inWindow = commitments.filter((c) => t - new Date(c.createdAt).getTime() <= WINDOW_MS);
  const resolved = inWindow
    .filter((c) => c.status !== "open" && c.resolvedAt)
    .sort((a, b) => (a.resolvedAt! < b.resolvedAt! ? -1 : 1));

  const kept = resolved.filter((c) => c.status === "done");
  const missed = resolved.filter((c) => c.status === "dropped");
  const partial = resolved.filter((c) => c.status === "partial");

  // Consecutive kept promises at the tail (most recent backward).
  let tailStreak = 0;
  for (let i = resolved.length - 1; i >= 0; i--) { if (resolved[i].status === "done") tailStreak++; else break; }
  const keptDays = new Set(kept.map((c) => (c.resolvedAt || "").slice(0, 10))).size;

  const total = resolved.length;
  const keptRate = total ? kept.length / total : 0;
  const missRate = total ? (missed.length + partial.length * 0.5) / total : 0;
  const score = Math.max(0, Math.min(1, 0.5 + keptRate * 0.3 + Math.min(tailStreak, 7) / 7 * 0.2 - missRate * 0.3));

  // ── Signals ──────────────────────────────────────────────────────────────
  const last3 = resolved.slice(-3);
  const fracturing = last3.length >= 3 && last3.filter((c) => c.status === "dropped" || c.status === "partial").length >= 3;

  // Stuck: the same promise keeps coming back, or one has been carried repeatedly, or an open one has sat for days.
  const open = commitments.filter((c) => c.status === "open").slice(-1)[0];
  const carriedText = open ? open.text : "";
  const sameTextCount = commitments.filter((c) => norm(c.text) === norm(carriedText)).length;
  const carriedTimes = open ? open.history.filter((h) => h.status === "open").length : 0;
  const openAge = open ? daysBetween(t, new Date(open.createdAt).getTime()) : 0;
  const stuck = !!open && (sameTextCount >= 3 || carriedTimes >= 3 || openAge >= 3);

  // Shrinking: recent promises markedly less ambitious (word-count proxy) than earlier ones.
  let shrinking = false;
  if (resolved.length >= 6) {
    const half = Math.floor(resolved.length / 2);
    const earlyAvg = resolved.slice(0, half).reduce((s, c) => s + words(c.text), 0) / half;
    const recentAvg = resolved.slice(-half).reduce((s, c) => s + words(c.text), 0) / (resolved.length - half);
    shrinking = earlyAvg >= 4 && recentAvg <= earlyAvg * 0.6;
  }
  const madeSmallerRecently = resolved.slice(-4).filter((c) => (c.reason || "").includes("smaller")).length >= 2;

  // Recovering: a rough patch earlier, but the most recent one or two were kept.
  const recovering = resolved.length >= 4
    && resolved.slice(-2).every((c) => c.status === "done")
    && resolved.slice(-5, -2).some((c) => c.status === "dropped" || c.status === "partial");

  const focusGrowing = (() => {
    if (focus.length < 4) return false;
    const mins = focus.map((f) => Math.round(f.elapsedSec / 60));
    const third = Math.max(1, Math.floor(mins.length / 3));
    return Math.max(...mins.slice(-third)) >= Math.max(...mins.slice(0, third)) + 15;
  })();

  const strongStreak = tailStreak >= 5 || keptDays >= 7;

  // ── State (most important true signal wins) ────────────────────────────────
  let state: MomentumState = "steady";
  if (total < 3 && !focusGrowing && !stuck && !fracturing) state = "early";
  else if (fracturing) state = "fracturing";
  else if (stuck) state = "stalling";
  else if (strongStreak || focusGrowing) state = "building";
  else if (recovering) state = "recovering";

  // ── The one observation to voice (rare, ranked by value; honest or null) ────
  let kind: MomentumKind = null;
  let observation: string | null = null;
  if (state === "early") {
    // Say nothing yet — the pattern isn't real.
  } else if (strongStreak && tailStreak >= 7) {
    kind = "raise_bar";
    observation = `You've kept every promise ${tailStreak} in a row. That's not luck anymore — I think you're ready to raise the bar.`;
  } else if (stuck) {
    kind = "stuck";
    observation = `We've been circling "${open!.text}" for a while now. I don't think the task is really the problem — want to spend five minutes on what's underneath it instead?`;
  } else if (fracturing) {
    kind = "fracturing";
    observation = `This past stretch doesn't quite feel like you. Something shifted — want to talk about what?`;
  } else if (shrinking || madeSmallerRecently) {
    kind = "shrinking";
    observation = `A few weeks ago your promises were more ambitious; lately they've been smaller. No judgment — I'm wondering if something changed.`;
  } else if (state === "building") {
    kind = "building";
    observation = `We're building real momentum${tailStreak >= 2 ? ` — ${tailStreak} promises kept in a row` : ""}. Don't lose it.`;
  } else if (state === "recovering") {
    kind = "recovering";
    observation = `Good to see you back at it — that dip didn't stick. Let's rebuild from here.`;
  }

  return { state, score, kind, observation };
}

/** A short, calibrated hint for the moment of MAKING a promise — challenge when there's
 * clearly capacity, soften when the week is fragile. Deterministic; null when neutral. */
export function commitmentHint(m: MomentumRead): string | null {
  if (m.kind === "raise_bar" || (m.state === "building" && m.score >= 0.7)) {
    return "You've been consistent lately — consider aiming a little higher today than feels comfortable.";
  }
  if (m.state === "fracturing") {
    return "Rough stretch — keep this one genuinely small. We're protecting the week, not proving anything.";
  }
  return null;
}
