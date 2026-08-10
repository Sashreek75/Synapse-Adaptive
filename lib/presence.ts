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
import { pftCooldownFactor } from "@/lib/pft";
import type { CheckIn } from "@/components/providers/health-store";
import type { Mind } from "@/types";

export type PresenceKind = "commitment" | "opportunity" | "drift" | "pre_failure" | "observation" | "celebration";

export interface PresenceSignal {
  id: string;                 // stable per (kind + subject) so it dedupes across evaluations
  kind: PresenceKind;
  headline: string;           // the CONVERSATION Synapse would open — authored, not a system string
  why: string;                // the internal justification (why now) — used as chat context
  ask: string;                // what to seed into the conversation if the user engages
  goalId?: string;
  urgency: "now" | "soon" | "ambient";
}

/** What happened after a proactive message — how Synapse learns whether reaching out that way
 * actually helps. "opened"/"acted" are the reach-out landing; "ignored"/"dismissed" are it missing. */
export type PresenceOutcome = "opened" | "acted" | "dismissed" | "ignored";

interface PresenceLog {
  seen: Record<string, string>;       // signalId -> ISO last surfaced
  dismissed: Record<string, string>;  // signalId -> ISO last dismissed
  lastShownAt?: string;               // ISO — any proactive surfacing, for the global quiet gap
  outcomes?: { kind: PresenceKind; outcome: PresenceOutcome; at: string }[]; // capped history for learning
}

const KEY = "synapse.presence";
const H = 3600e3;
const DAY = 24 * H;

// A quiet gap between ANY two proactive interruptions — presence should feel rare.
const GLOBAL_GAP_MS = 4 * H;
// How long a given signal stays quiet after being shown or dismissed. Restraint lives here.
const COOLDOWN_MS: Record<PresenceKind, number> = {
  commitment: 6 * H,
  opportunity: 5 * H,
  drift: 40 * H,
  pre_failure: 40 * H,
  observation: 5 * DAY,
  celebration: 20 * H,
};

function load(): PresenceLog {
  if (typeof window === "undefined") return { seen: {}, dismissed: {} };
  try { const r = JSON.parse(localStorage.getItem(KEY) || "null"); if (r && typeof r === "object") return { seen: r.seen ?? {}, dismissed: r.dismissed ?? {}, lastShownAt: r.lastShownAt, outcomes: r.outcomes ?? [] }; } catch {}
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

/**
 * INTERRUPTION QUALITY — Synapse learning whether reaching out THIS way actually helps. Not for
 * engagement: the only thing it does is make a kind of reach-out that keeps getting ignored RARER,
 * and one that keeps landing slightly more available. Restraint that adapts is still restraint.
 */
function kindStats(kind: PresenceKind, log: PresenceLog): { shows: number; rate: number | null } {
  const evs = (log.outcomes ?? []).filter((o) => o.kind === kind).slice(-8);
  if (evs.length === 0) return { shows: 0, rate: null };
  const pos = evs.filter((o) => o.outcome === "opened" || o.outcome === "acted").length;
  return { shows: evs.length, rate: pos / evs.length };
}

/** How much to stretch (or gently shorten) a kind's cooldown based on how it's been landing. */
function cooldownMultiplier(kind: PresenceKind, log: PresenceLog): number {
  const { shows, rate } = kindStats(kind, log);
  if (shows < 4 || rate == null) return 1;       // not enough evidence — leave it alone
  if (rate < 0.25) return 3;                      // keeps getting ignored → reach out far less
  if (rate >= 0.6) return 0.75;                   // keeps landing → slightly more willing
  return 1;
}

// Accountability kinds should check back SOONER when this person's follow-through is shaky.
const PFT_SENSITIVE: Record<PresenceKind, boolean> = {
  commitment: true, drift: true, pre_failure: true, opportunity: false, observation: false, celebration: false,
};

/** Is this specific signal currently on cooldown (recently shown or dismissed)? Adaptive. */
function onCooldown(sig: PresenceSignal, log: PresenceLog, now: number): boolean {
  const pftFactor = PFT_SENSITIVE[sig.kind] ? pftCooldownFactor(new Date(now)) : 1;
  const cd = COOLDOWN_MS[sig.kind] * cooldownMultiplier(sig.kind, log) * pftFactor;
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
    headline: `You told me this mattered: "${c.text}". Do you still feel the same?`,
    why: "A promise you made in an earlier session is still open and hasn't been reported back — the single strongest reason to start a conversation, because unspoken promises quietly expire. An invitation to revisit it, never a command to do it.",
    ask: `Earlier I committed to: "${c.text}". Let's talk about whether it still matters and what's actually happening with it.`,
    urgency: "now",
  };
}

// Presence shouldn't only catch problems — it should notice opportunity. Right after a win is when
// momentum is highest and the drop-off usually starts; offering (never pushing) to extend it helps.
function opportunityCandidate(now: Date): PresenceSignal | null {
  const t = now.getTime();
  const recent = loadHistory().filter((f) => f.completed && typeof f.at === "number" && t - f.at < 15 * 60 * 1000);
  if (recent.length === 0) return null;
  const last = recent[recent.length - 1];
  return {
    id: `opportunity:${last.at}`,
    kind: "opportunity",
    headline: "You just finished a focused block — you're warm right now, and this is the cheapest twenty more minutes you'll get all day. Want to use it, or is this a good place to stop?",
    why: "A focused session completed minutes ago. Momentum is highest immediately after a win and the drop-off usually starts right here — an invitation to ride it (with a genuine option to stop) raises follow-through without any pressure.",
    ask: `I just finished a focus block${last.goal ? ` on ${last.goal}` : ""} and I'm still warm. Help me decide whether to keep going and put the next twenty minutes to work.`,
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
    opportunityCandidate(now),
    preFailureCandidate(now),
    driftCandidate(),
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

/** Record how a reach-out landed, so Synapse can learn to reach out this way more or less often. */
export function recordPresenceOutcome(kind: PresenceKind, outcome: PresenceOutcome, now = new Date()): void {
  const log = load();
  log.outcomes = (log.outcomes ?? []).concat({ kind, outcome, at: now.toISOString() }).slice(-40);
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
 * ambient ones, never without permission, never auto-prompted.
 *
 * FUTURE REQUIREMENT (documented, deliberately NOT built here): the biggest structural limit on
 * accountability today is that Synapse can only reach out while the app/tab is open — so it goes
 * silent on exactly the person who drifts away. When a web-push service worker or a native mobile
 * app exists, an EARNED signal (see evaluatePresence: a due promise, predictable failure, real
 * drift) should be deliverable even when the app is closed. This changes only the DELIVERY channel;
 * the restraint law is absolute and unchanged — a notification exists only when staying silent would
 * meaningfully lower this person's odds of following through. Do not build a notification system
 * merely so notifications exist. */

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
