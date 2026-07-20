/**
 * THE FOCUS COMPANION — session state + intervention logic (pure, deterministic).
 *
 * This is NOT the intelligence engine. It's the small, honest brain behind the
 * floating orb: it knows the session (goal, time), a little cadence telemetry
 * (active/idle, tab switches — never page CONTENT), and it decides, conservatively,
 * whether a gentle check-in has earned the right to exist.
 *
 * The governing principle is SILENCE. The orb should spend almost all of its life
 * doing nothing. Interventions are rare, capped, gap-limited, and always supportive
 * — never corrective. If nothing is genuinely useful to say, we say nothing.
 */

export const FOCUS_KEY = "synapse.focus.session.v1";

export type FocusMode = "focus" | "break";

/** A one-shot intervention id (so each kind fires at most once per session). */
export type NudgeKind = "idle" | "tabswitch" | "fiveMin" | "complete";

export interface FocusSession {
  mode: FocusMode;
  goal: string | null;
  startedAt: number;          // ms epoch
  durationSec: number;
  endsAt: number;             // ms epoch (absolute, so it never drifts across reloads)
  /** Proactive DRIFT check-ins spent (idle / tabswitch). Hard cap = MAX_DRIFT. */
  driftUsed: number;
  /** Any spoken moment, for the global minimum gap so nudges never stack. */
  lastSpokeAt: number;
  /** Which one-shot nudges have already fired. */
  fired: NudgeKind[];
}

/* ── The budget. Deliberately stingy. ─────────────────────────────────────── */

/** Maximum PROACTIVE drift check-ins in a whole session. Two, maximum — not per hour. */
export const MAX_DRIFT = 2;
/** No two spoken moments closer than this. Protects flow. */
export const MIN_GAP_MS = 90_000;
/** Away (tab hidden) at least this long mid-session → a drift check-in may be warranted. */
export const AWAY_MS = 4 * 60_000;
/** Visible but no input at all for this long → possible in-page idle. */
export const IDLE_MS = 6 * 60_000;
/** Rapid tab-switching: this many hidden→visible flips inside the window. */
export const TAB_SWITCH_COUNT = 5;
export const TAB_SWITCH_WINDOW_MS = 120_000;
/** Don't fire drift nudges in the last stretch — the wrap-up is coming anyway. */
export const QUIET_TAIL_MS = 6 * 60_000;
/** ...or in the very first moments, before they've even settled in. */
export const QUIET_HEAD_MS = 90_000;

export const DURATION_PRESETS = [25, 45, 60] as const;

export function newSession(goal: string | null, minutes: number, mode: FocusMode = "focus", now = Date.now()): FocusSession {
  const durationSec = Math.max(60, Math.round(minutes * 60));
  return { mode, goal: goal ?? null, startedAt: now, durationSec, endsAt: now + durationSec * 1000, driftUsed: 0, lastSpokeAt: 0, fired: [] };
}

export function loadSession(): FocusSession | null {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as FocusSession;
    if (!s || typeof s.endsAt !== "number") return null;
    const base = { mode: "focus" as FocusMode, driftUsed: 0, lastSpokeAt: 0, fired: [] as NudgeKind[] };
    return { ...base, ...s };
  } catch { return null; }
}
export function saveSession(s: FocusSession): void { try { localStorage.setItem(FOCUS_KEY, JSON.stringify(s)); } catch {} }
export function clearSession(): void { try { localStorage.removeItem(FOCUS_KEY); } catch {} }

export function remainingSec(s: FocusSession, now = Date.now()): number { return Math.max(0, Math.round((s.endsAt - now) / 1000)); }
export function elapsedSec(s: FocusSession, now = Date.now()): number { return Math.max(0, Math.round((now - s.startedAt) / 1000)); }
export function progress(s: FocusSession, now = Date.now()): number {
  return s.durationSec > 0 ? Math.min(1, Math.max(0, elapsedSec(s, now) / s.durationSec)) : 0;
}
export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

/* ── The decision. Given the session + a snapshot of cadence telemetry, what — if
 * anything — should the orb say right now? Returns null the vast majority of the
 * time. This function NEVER sees page content; only timing and coarse activity. ── */

export interface Telemetry {
  now: number;
  visible: boolean;
  awayMs: number;             // how long the tab has been hidden (0 if visible)
  idleMs: number;             // how long since last input while visible
  recentTabSwitches: number;  // hidden→visible flips within TAB_SWITCH_WINDOW_MS
}

export interface Nudge {
  kind: NudgeKind;
  text: string;
  /** Quick replies. "reassure" answers accept + go quiet; "restart" answers re-focus. */
  replies?: { label: string; intent: "reassure" | "restart" | "break" | "another" | "done" | "dismiss" }[];
  /** True for lifecycle moments (five-min, complete) that don't spend the drift budget. */
  lifecycle?: boolean;
}

const goalPhrase = (s: FocusSession) => (s.goal ? `your ${s.goal}` : "it");

/** Lifecycle nudges: honoring the timer the person set. Not surveillance, so these
 * do not spend the drift budget — but they still respect the min-gap and fire once. */
export function lifecycleNudge(s: FocusSession, t: Telemetry): Nudge | null {
  if (s.lastSpokeAt && t.now - s.lastSpokeAt < MIN_GAP_MS) return null;
  const rem = remainingSec(s, t.now);
  if (rem <= 0 && !s.fired.includes("complete")) {
    return s.mode === "break"
      ? { kind: "complete", lifecycle: true, text: "Break's up whenever you're ready — no rush.", replies: [{ label: "Back to it", intent: "another" }, { label: "I'm done", intent: "done" }] }
      : { kind: "complete", lifecycle: true, text: "Nice work. Ready for a short break, or another block?", replies: [{ label: "5-min break", intent: "break" }, { label: "Another block", intent: "another" }, { label: "I'm done", intent: "done" }] };
  }
  if (s.mode === "focus" && rem > 0 && rem <= 300 && !s.fired.includes("fiveMin")) {
    return { kind: "fiveMin", lifecycle: true, text: "Five minutes left. Want to wrap up here, or keep going after?", replies: [{ label: "Wrapping up", intent: "reassure" }, { label: "Keep going", intent: "another" }] };
  }
  return null;
}

/** Drift check-ins: POSSIBLE (never certain) signs attention has wandered. Capped,
 * gap-limited, and silenced near the head/tail of the session. We can't know someone
 * is off task — they might be reading, thinking, or on a call — so we ask, never assert. */
export function driftNudge(s: FocusSession, t: Telemetry, maxDrift = MAX_DRIFT): Nudge | null {
  if (s.mode !== "focus") return null;
  if (s.driftUsed >= maxDrift) return null;
  if (s.lastSpokeAt && t.now - s.lastSpokeAt < MIN_GAP_MS) return null;
  const rem = remainingSec(s, t.now);
  const el = elapsedSec(s, t.now) * 1000;
  if (el < QUIET_HEAD_MS) return null;          // let them settle in first
  if (rem * 1000 < QUIET_TAIL_MS) return null;  // the wrap-up is coming; stay quiet

  // Rapid tab-switching → attention getting pulled around. (Fires once.)
  if (t.recentTabSwitches >= TAB_SWITCH_COUNT && !s.fired.includes("tabswitch")) {
    return { kind: "tabswitch", text: "Looks like your attention's getting pulled in a few directions. Want to take ten seconds and decide the very next thing?",
      replies: [{ label: "Good point", intent: "restart" }, { label: "I'm on it", intent: "reassure" }] };
  }
  // Been away, or sitting idle, for a while → a gentle, uncertain check-in. (Fires once.)
  if ((t.awayMs >= AWAY_MS || (t.visible && t.idleMs >= IDLE_MS)) && !s.fired.includes("idle")) {
    return { kind: "idle", text: `Looks like you've been away for a bit. Still working on ${goalPhrase(s)}?`,
      replies: [{ label: "Still on it", intent: "reassure" }, { label: "Lost the thread", intent: "restart" }] };
  }
  return null;
}

/** Record that a nudge was shown — advancing the budget/gap/one-shot bookkeeping. */
export function registerNudge(s: FocusSession, n: Nudge, now = Date.now()): FocusSession {
  const fired = s.fired.includes(n.kind) ? s.fired : [...s.fired, n.kind];
  const driftUsed = n.lifecycle ? s.driftUsed : s.driftUsed + 1;
  return { ...s, fired, driftUsed, lastSpokeAt: now };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SESSION MEMORY — the orb's own longitudinal record (NOT the intelligence engine).
 * A tiny local log of how sessions actually unfold, so the companion can make the
 * occasional honest observation that makes it feel alive. Only surfaced when the
 * data genuinely supports it, and never as pressure — a shorter day is never shamed.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const FOCUS_HISTORY_KEY = "synapse.focus.history.v1";
export interface FocusRecord { goal: string | null; plannedSec: number; elapsedSec: number; completed: boolean; at: number }

export function loadHistory(): FocusRecord[] {
  try { const r = localStorage.getItem(FOCUS_HISTORY_KEY); return r ? (JSON.parse(r) as FocusRecord[]) : []; } catch { return []; }
}
export function recordSession(rec: FocusRecord): FocusRecord[] {
  const h = [...loadHistory(), rec].slice(-50);
  try { localStorage.setItem(FOCUS_HISTORY_KEY, JSON.stringify(h)); } catch {}
  return h;
}

const norm = (g: string | null) => (g || "").trim().toLowerCase();

/** An honest, OCCASIONAL longitudinal note for the end of a session. Null most of the
 * time. Only positive/neutral observations — it celebrates showing up and growth, and
 * stays silent rather than commenting on a shorter day. Requires real prior data. */
export function sessionReflection(history: FocusRecord[], current: FocusRecord): string | null {
  const curMin = Math.round(current.elapsedSec / 60);
  if (curMin < 1) return null;
  const prior = history.filter((r) => r.at !== current.at);
  const sameGoal = norm(current.goal) ? prior.filter((r) => norm(r.goal) === norm(current.goal)) : [];
  if (!sameGoal.length) return null;
  const prev = sameGoal[sameGoal.length - 1];
  const prevMin = Math.round(prev.elapsedSec / 60);
  // Sessions are getting longer for this goal — a real, encouraging trend.
  if (curMin >= prevMin + 5) {
    return `You stayed with that for ${curMin} minutes. Last time you wrapped around ${prevMin}. Looks like longer sessions are getting easier.`;
  }
  // They keep returning to the same thing — consistency worth naming.
  if (sameGoal.length + 1 >= 3 && current.goal) {
    return `That's ${sameGoal.length + 1} sessions on ${current.goal} now. You keep coming back to it \u2014 that consistency is the whole game.`;
  }
  return null;
}

/* ── INTERRUPTION EFFECTIVENESS — not just WHEN to check in, but whether THIS person
 * responds to being checked in on. If they mostly ignore nudges, the companion learns
 * to intrude less. Deterministic, local, honest — it only adapts once there's evidence. ── */

export const FOCUS_PREFS_KEY = "synapse.focus.prefs.v1";
export interface FocusPrefs { shown: number; worked: number; byKind: Record<string, { shown: number; worked: number }> }

export function loadPrefs(): FocusPrefs {
  try { const r = localStorage.getItem(FOCUS_PREFS_KEY); if (r) return JSON.parse(r) as FocusPrefs; } catch {}
  return { shown: 0, worked: 0, byKind: {} };
}
export function recordOutcome(kind: NudgeKind, worked: boolean): FocusPrefs {
  const p = loadPrefs();
  const k = p.byKind[kind] ?? { shown: 0, worked: 0 };
  k.shown += 1; if (worked) k.worked += 1;
  p.byKind[kind] = k; p.shown += 1; if (worked) p.worked += 1;
  try { localStorage.setItem(FOCUS_PREFS_KEY, JSON.stringify(p)); } catch {}
  return p;
}

/** How this person tends to respond to drift check-ins, in plain words (or null when
 * we honestly don't have enough evidence yet). Internal — shapes behavior, not shown. */
export function responsivenessNote(p: FocusPrefs): string | null {
  const d = ["idle", "tabswitch"].reduce((a, k) => ({ shown: a.shown + (p.byKind[k]?.shown ?? 0), worked: a.worked + (p.byKind[k]?.worked ?? 0) }), { shown: 0, worked: 0 });
  if (d.shown < 3) return null;
  const rate = d.worked / d.shown;
  if (rate < 0.34) return "rarely responds to check-ins";
  if (rate > 0.66) return "responds well to gentle check-ins";
  return "mixed response to check-ins";
}

/** Adaptive drift budget: still tiny, but if this person mostly ignores check-ins we
 * drop to one; if they clearly value them we allow the full two. Honest uncertainty
 * (the default two) until there's enough evidence to move. */
export function adaptiveMaxDrift(p: FocusPrefs): number {
  const d = ["idle", "tabswitch"].reduce((a, k) => ({ shown: a.shown + (p.byKind[k]?.shown ?? 0), worked: a.worked + (p.byKind[k]?.worked ?? 0) }), { shown: 0, worked: 0 });
  if (d.shown >= 3 && d.worked / d.shown < 0.34) return 1;
  return MAX_DRIFT;
}
