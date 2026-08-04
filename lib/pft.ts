/**
 * PROBABILITY OF FOLLOW-THROUGH (PFT) — the number that turns an assistant into a partner.
 *
 * The thing Synapse is actually trying to change is whether the person DOES what they said. So it
 * quietly estimates, from their own track record, how likely this person is to follow through right
 * now — and then coaches differently depending on the answer, instead of treating every commitment
 * the same:
 *   HIGH   → get out of the way. One line, then let them go act.
 *   MEDIUM → gentle accountability. Confirm the when/where; stay reachable.
 *   LOW    → don't add pressure. Diagnose the friction, shrink the task to something trivially
 *            doable, and check back sooner.
 *
 * Behavioral layer only: pure reads over commitments, momentum, and focus history.
 */

import { loadCommitments } from "@/lib/commitments";
import { loadHistory } from "@/lib/focus-session";
import { readMomentum } from "@/lib/momentum";

export type PFTBand = "high" | "medium" | "low";

export interface PFTRead {
  score: number;        // 0..1
  band: PFTBand;
  drivers: string[];    // short, human reasons behind the estimate
  confident: boolean;   // false when there's too little history to be sure
}

/** Estimate how likely this person is to follow through, from their own recent behaviour. */
export function estimatePFT(now = new Date()): PFTRead {
  const commitments = loadCommitments();
  const focus = loadHistory();
  const resolved = commitments.filter((c) => c.status !== "open" && c.status !== "replaced");
  const drivers: string[] = [];

  // Signal 1 — promise keep-rate (the most direct evidence).
  let keep = 0.5, keepWeight = 0;
  if (resolved.length >= 2) {
    const kept = resolved.filter((c) => c.status === "done").length;
    const partial = resolved.filter((c) => c.status === "partial").length;
    keep = (kept + 0.5 * partial) / resolved.length;
    keepWeight = Math.min(1, resolved.length / 6); // trust grows with track record
    drivers.push(`kept ${kept}/${resolved.length} recent promises`);
  }

  // Signal 2 — momentum (are the last few going up or fracturing?).
  const mom = readMomentum(commitments, focus, now);
  const momScore = mom.score; // 0..1
  if (mom.kind) drivers.push(`momentum is ${mom.kind.replace("_", " ")}`);

  // Signal 3 — focus follow-through (do started sessions get completed?).
  let foc = 0.5, focWeight = 0;
  if (focus.length >= 3) {
    const done = focus.filter((f) => f.completed).length;
    foc = done / focus.length;
    focWeight = Math.min(1, focus.length / 6);
    drivers.push(`finishes ${done}/${focus.length} focus sessions`);
  }

  // Weighted blend — momentum always counts; keep-rate and focus count more as history accrues.
  const wKeep = 0.45 * keepWeight;
  const wFoc = 0.25 * focWeight;
  const wMom = 0.30;
  const wSum = wKeep + wFoc + wMom;
  const score = (keep * wKeep + foc * wFoc + momScore * wMom) / wSum;

  const band: PFTBand = score >= 0.66 ? "high" : score >= 0.4 ? "medium" : "low";
  const confident = resolved.length + focus.length >= 4;
  return { score, band, drivers, confident };
}

const MODE: Record<PFTBand, string> = {
  high: "HIGH — get out of the way. Acknowledge in one line and let them go act; do not over-coach or pile on steps.",
  medium: "MEDIUM — gentle accountability. Pin down the when and where, keep the step small, and stay reachable.",
  low: "LOW — do NOT add pressure. Diagnose what's actually in the way, shrink the task to something trivially doable, lower the bar to restart, and plan to check back sooner than usual.",
};

/** Tells the model the current follow-through likelihood and how to coach for it. */
export function pftContextBlock(now = new Date()): string {
  const r = estimatePFT(now);
  const conf = r.confident ? "" : " (low confidence — not much history yet, so lean neutral)";
  const why = r.drivers.length ? ` Based on: ${r.drivers.join("; ")}.` : "";
  return `FOLLOW-THROUGH LIKELIHOOD right now: ${r.band} (~${Math.round(r.score * 100)}%)${conf}.${why} Coach accordingly — ${MODE[r.band]}`;
}

/** Presence uses this so that when follow-through is LOW, Synapse checks back sooner. */
export function pftCooldownFactor(now = new Date()): number {
  return estimatePFT(now).band === "low" ? 0.5 : 1;
}
