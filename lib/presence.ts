/**
 * THE PRESENCE ENGINE — accountability that doesn't wait to be remembered.
 *
 * An execution partner cannot only exist when the user decides to open the app. Sometimes it
 * has to reach out first. But this is NOT a notification system and NOT a scheduler — there is
 * no "it's 9am, so nudge," no "your streak might break," no daily-engagement ping. That is a
 * productivity app; we are not building one.
 *
 * Instead the engine evaluates the whole relationship — open promises, goal drift, momentum,
 * the coaching that has and hasn't worked, predictable failure patterns — and asks ONE question:
 *
 *     "If I stay silent right now, does this person's probability of following through
 *      meaningfully DECREASE?"
 *
 * Only when the answer is yes does it surface a single earned signal. Every interruption must
 * justify why-now, why-this, why-not-yesterday, why-not-tomorrow. Most of the time the honest
 * answer is "stay silent" — and that restraint is exactly what makes the rare interruption land
 * like a message from someone who genuinely knows you, not an app notification.
 *
 * Behavioral layer only: localStorage + pure selectors. The frozen intelligence engine is untouched.
 */

import { loadCommitments, commitmentAwaitingReport, type Commitment } from "@/lib/commitments";
import { activeGoals, daysSinceProgress, type Goal } from "@/lib/goals";
import { readMomentum } from "@/lib/momentum";
import { loadHistory } from "@/lib/focus-session";
import { computeStreak } from "@/lib/intelligence";
import type { Mind, CheckIn } from "@/types";

export type PresenceKind = "commitment" | "drift" | "pre_failure" | "observation" | "celebration";

export interface PresenceSignal {
  id: string;                 // stable per (kind + subject) so it dedupes across evaluations
  kind: PresenceKind;
  headline: string;           // what Synapse would say — its voice, not a system string
  why: string;                // the internal justification (why now) — used as chat context
  ask: string;                // what to seed into the conversation if the user engages
  goalId?: string;
  urgency: "now" | "soon" | "ambient";
}

interface PresenceLog {
  seen: Record<string, string>;       // signalId -> ISO last surfaced
  dismissed: Record<string, string>;  // signalId -> ISO last dismissed
  lastShownAt?: string;               // ISO — any proactive surfacing, for the global quiet gap
}

const KEY = "synapse.presence";
const H = 3600e3;
const DAY = 24 * H;

// A quiet gap between ANY two proactive interruptions — presence should feel rare.
const GLOBAL_GAP_MS = 4 * H;
// How long a given signal stays quiet after being shown or dismissed. Restraint lives here.
const COOLDOWN_MS: Record<PresenceKind, number> = {
  commitment: 6 * H,
  drift: 40 * H,
  pre_failure: 40 * H,
  observation: 5 * DAY,
  celebration: 20 * H,
};

function load(): PresenceLog {
  if (typeof window === "undefined") return { seen: {}, dismissed: {} };
  try { const r = JSON.parse(localStorage.getItem(KEY) || "null"); if (r && typeof r === "object") return { seen: r.seen ?? {}, dismissed: r.dismissed ?? {}, lastShownAt: r.lastShownAt }; } catch {}
  return { seen: {}, dismissed: {} };
}
function save(l: PresenceLog): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {}
}

function within(iso: string | undefined, ms: number, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && now - t < ms;
}

/** Is this specific signal currently on cooldown (recently shown or dismissed)? */
function onCooldown(sig: PresenceSignal, log: PresenceLog, now: number): boolean {
  const cd = COOLDOWN_MS[sig.kind];
  return within(log.seen[sig.id], cd, now) || within(log.dismissed[sig.id], cd, now);
}

function dayKey(d: Date): string { return d.toISOString().slice(0, 10); }
function hashText(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

/* ── Candidate builders — each returns a signal or null, strongest reason first ─────────── */

function commitmentCandidate(now: Date): PresenceSignal | null {
  const c: Commitment | null = commitmentAwaitingReport(loadCommitments(), now);
  if (!c) return null;
  return {
    id: `commitment:${c.id}`,
    kind: "commitment",
    headline: `You told me this mattered: "${c.text}". Still on?`,
    why: "A promise you made in an earlier session is still open and hasn't been reported back — the single strongest reason to reach out, because unspoken promises quietly expire.",
    ask: `Earlier I committed to: "${c.text}". Let's talk about whether it's happening.`,
    urgency: "now",
  };
}

function driftCandidate(): PresenceSignal | null {
  const goals = activeGoals().filter((g) => g.priority === "primary" || g.priority === "high");
  let worst: { g: Goal; d: number } | null = null;
  for (const g of goals) {
    const d = daysSinceProgress(g);
    if (d != null && d >= 4 && (!worst || d > worst.d)) worst = { g, d };
  }
  if (!worst) return null;
  const { g, d } = worst;
  return {
    id: `drift:${g.id}`,
    kind: "drift",
    headline: `You've been away from "${g.title}" for ${d} days. I don't think you've changed your mind — I think something's getting in the way. Talk to me.`,
    why: `No progress logged on a high-priority goal for ${d} days. This is the point where important goals quietly die, and staying silent lowers the odds of a restart.`,
    ask: `I've drifted from "${g.title}" for about ${d} days. Help me work out what's actually in the way.`,
    goalId: g.id,
    urgency: "soon",
  };
}

function preFailureCandidate(now: Date): PresenceSignal | null {
  const mom = readMomentum(loadCommitments(), loadHistory(), now);
  // Only when the person's OWN recent pattern predicts a stall — not a generic reminder.
  if (mom.kind !== "fracturing" && mom.kind !== "shrinking") return null;
  return {
    id: `pre_failure:${dayKey(now)}`,
    kind: "pre_failure",
    headline: "Historically, this is right where things start to slip for you. Let's make today different — one small rep, now, before the pattern takes hold.",
    why: "Your last few commitments fractured — the exact pattern that precedes a stall for you. Reaching out before the failure is worth far more than noticing it after.",
    ask: "I can feel myself about to slip. Give me one small thing to do right now to break the pattern.",
    urgency: "soon",
  };
}

function observationCandidate(mind: Mind): PresenceSignal | null {
  const wk = Object.keys(mind.weekly).sort().pop();
  const weekly = wk ? mind.weekly[wk] : undefined;
  const body = weekly?.mindShift ?? weekly?.surprise?.observation ?? null;
  if (!body) return null;
  return {
    id: `observation:${hashText(body)}`,
    kind: "observation",
    headline: `I've been thinking about something. ${body}`,
    why: "A genuine shift in how I understand you — the kind of thing worth saying out loud exactly once, unprompted, the way a person who knows you would.",
    ask: `You said you'd been thinking: "${body}". Let's get into it.`,
    urgency: "ambient",
  };
}

function celebrationCandidate(checkIns: CheckIn[]): PresenceSignal | null {
  const { currentStreak, totalDays } = computeStreak(checkIns);
  const milestones = [3, 7, 14, 21, 30, 60, 100];
  if (!milestones.includes(currentStreak)) return null;
  // Only meaningful if they've lapsed before — otherwise it's just a counter.
  if (totalDays <= currentStreak) return null;
  return {
    id: `celebration:streak:${currentStreak}`,
    kind: "celebration",
    headline: `${currentStreak} days straight. There was a version of you that would've let today slide — and you didn't. That's the person you're becoming.`,
    why: "A specific, earned milestone against a history of lapses — a rare moment where a quiet, specific acknowledgment reinforces the identity shift.",
    ask: `I've kept a ${currentStreak}-day streak going. Help me protect it without white-knuckling it.`,
    urgency: "ambient",
  };
}

/**
 * The one question, answered. Returns the single most earned signal to surface right now, or
 * null — which is the answer most of the time. Respects the global quiet gap and per-signal
 * cooldowns so presence stays rare and trusted.
 */
export function evaluatePresence(ctx: { mind: Mind; checkIns: CheckIn[]; now?: Date }): PresenceSignal | null {
  if (typeof window === "undefined") return null;
  const now = ctx.now ?? new Date();
  const t = now.getTime();
  const log = load();

  // Global restraint: never stack interruptions.
  if (within(log.lastShownAt, GLOBAL_GAP_MS, t)) return null;

  // Strongest reason first; skip any candidate that's still on its cooldown.
  const candidates = [
    commitmentCandidate(now),
    driftCandidate(),
    preFailureCandidate(now),
    observationCandidate(ctx.mind),
    celebrationCandidate(ctx.checkIns),
  ];
  for (const sig of candidates) {
    if (sig && !onCooldown(sig, log, t)) return sig;
  }
  return null;
}

/** Record that a signal was actually surfaced (starts its cooldown + the global quiet gap). */
export function markPresenceShown(sig: PresenceSignal, now = new Date()): void {
  const log = load();
  const iso = now.toISOString();
  log.seen[sig.id] = iso;
  log.lastShownAt = iso;
  save(log);
}

/** The user dismissed it — hold this one back for its full cooldown and go quiet globally. */
export function dismissPresence(sig: PresenceSignal, now = new Date()): void {
  const log = load();
  const iso = now.toISOString();
  log.dismissed[sig.id] = iso;
  log.lastShownAt = iso;
  save(log);
}

/** Lets the model know what it has recently reached out about, so it never repeats itself. */
export function presenceContextBlock(now = new Date()): string {
  const log = load();
  const t = now.getTime();
  const recent = Object.entries(log.seen)
    .filter(([, iso]) => within(iso, 2 * DAY, t))
    .map(([id]) => id.split(":")[0]);
  if (recent.length === 0) return "";
  const kinds = Array.from(new Set(recent)).join(", ");
  return `PRESENCE: in the last couple of days you already reached out proactively about: ${kinds}. Don't repeat those unprompted — if the user brings it up, continue naturally.`;
}

/* ── Optional delivery channel: real browser notifications, opt-in, best-effort ──────────
 * Presence works entirely in-app via the orb. When the user has explicitly granted permission,
 * the very strongest ("now") signals may also arrive as a browser notification — never for
 * ambient ones, never without permission, never auto-prompted. */

export async function requestPresencePermission(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch { return false; }
}

export function maybeNotify(sig: PresenceSignal): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (sig.urgency !== "now") return; // only the strongest reasons earn an OS-level interruption
    new Notification("Synapse", { body: sig.headline, tag: sig.id });
  } catch { /* notifications are a bonus, never a requirement */ }
}
