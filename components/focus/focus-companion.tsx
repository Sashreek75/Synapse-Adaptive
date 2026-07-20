"use client";

/**
 * THE FOCUS COMPANION — the Focus Companion role, made into a presence.
 *
 * After someone has decided what matters, the whole job is to reduce the gap between
 * intention and action, and otherwise stay out of the way. A quiet, breathing orb in
 * the corner that keeps time and watches only CADENCE — tab active, idle, tab-switches
 * — NEVER page content, never what is typed. It speaks at most twice per session, only
 * when a check-in has truly earned it, always as support, never correction.
 *
 * It can POP OUT into an always-on-top window (Document Picture-in-Picture, where the
 * browser supports it) so it stays beside you when you switch tabs or apps — present
 * whenever you need it, without pulling you back into Synapse. It still watches nothing.
 *
 * Silence is the success state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Coffee, Brain, Check, ArrowRight, Plus, ExternalLink } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { cn } from "@/lib/utils";
import {
  type FocusSession, type Nudge, type Telemetry, type NudgeKind,
  loadSession, saveSession, clearSession, newSession, registerNudge,
  remainingSec, progress, fmtClock, lifecycleNudge, driftNudge,
  recordSession, sessionReflection, loadPrefs, recordOutcome, adaptiveMaxDrift,
  TAB_SWITCH_WINDOW_MS, TAB_SWITCH_COUNT,
} from "@/lib/focus-session";

interface Line { id: string; from: "synapse" | "you"; text: string }

/** How long after a check-in we watch for a response before judging it (in)effective. */
const EFFECTIVE_WINDOW_MS = 90_000;

const pipSupported = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

export function FocusCompanion() {
  const { mind } = useHealth();
  const { plan } = useSubscription();
  const [session, setSession] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Line[]>([]);
  const [bubble, setBubble] = useState<Nudge | null>(null);
  const [note, setNote] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pipWin, setPipWin] = useState<Window | null>(null);

  const awaySince = useRef<number | null>(null);
  const lastActivity = useRef<number>(Date.now());
  const switches = useRef<number[]>([]);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ kind: NudgeKind; shownAt: number } | null>(null);
  const recordedFor = useRef<number | null>(null);

  const persist = useCallback((s: FocusSession | null) => {
    setSession(s);
    if (s) saveSession(s); else clearSession();
  }, []);

  const say = useCallback((text: string) => setThread((t) => [...t, { id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, from: "synapse" as const, text }].slice(-14)), []);

  const finishAndRecord = useCallback((completed: boolean): string | null => {
    const s = loadSession();
    if (!s || s.mode !== "focus") return null;
    if (recordedFor.current === s.startedAt) return null;
    recordedFor.current = s.startedAt;
    const elapsed = Math.min(s.durationSec, Math.max(0, Math.round((Date.now() - s.startedAt) / 1000)));
    const rec = { goal: s.goal, plannedSec: s.durationSec, elapsedSec: completed ? s.durationSec : elapsed, completed, at: s.startedAt };
    return sessionReflection(recordSession(rec), rec);
  }, []);

  useEffect(() => {
    const sync = () => {
      const s = loadSession();
      setSession(s);
      if (s) { recordedFor.current = recordedFor.current === s.startedAt ? s.startedAt : null; lastActivity.current = Date.now(); }
      if (s && thread.length === 0) say(s.goal ? `On ${s.goal}. I'm right here if you need me.` : "I'm right here if you need me.");
    };
    sync();
    const onStart = () => { setThread([]); setBubble(null); pending.current = null; recordedFor.current = null; sync(); };
    const onStorage = (e: StorageEvent) => { if (e.key === "synapse.focus.session.v1") sync(); };
    window.addEventListener("synapse:focus-start", onStart);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("synapse:focus-start", onStart); window.removeEventListener("storage", onStorage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNudge = useCallback((s: FocusSession, n: Nudge) => {
    persist(registerNudge(s, n));
    say(n.text);
    setBubble(n);
    if (n.kind === "idle" || n.kind === "tabswitch") pending.current = { kind: n.kind, shownAt: Date.now() };
    if (n.kind === "complete") { const refl = finishAndRecord(true); if (refl) setTimeout(() => say(refl), 1100); }
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 24_000);
  }, [persist, say, finishAndRecord]);

  const telemetry = useCallback((t: number): Telemetry => {
    const visible = typeof document !== "undefined" && document.visibilityState === "visible";
    const recent = switches.current.filter((ts) => t - ts <= TAB_SWITCH_WINDOW_MS);
    switches.current = recent;
    return { now: t, visible, awayMs: visible ? 0 : awaySince.current ? t - awaySince.current : 0, idleMs: visible ? t - lastActivity.current : 0, recentTabSwitches: recent.length };
  }, []);

  const resolvePending = useCallback((t: number) => {
    const p = pending.current;
    if (!p) return;
    const visible = typeof document !== "undefined" && document.visibilityState === "visible";
    const recentSwitches = switches.current.filter((ts) => t - ts <= TAB_SWITCH_WINDOW_MS).length;
    const engaged = visible && lastActivity.current > p.shownAt;
    let worked: boolean | null = null;
    if (p.kind === "idle" && engaged) worked = true;
    else if (p.kind === "tabswitch" && engaged && recentSwitches < TAB_SWITCH_COUNT) worked = true;
    else if (t - p.shownAt > EFFECTIVE_WINDOW_MS) worked = false;
    if (worked !== null) { recordOutcome(p.kind, worked); pending.current = null; }
  }, []);

  const evaluate = useCallback((t: number) => {
    const s = loadSession();
    if (!s) return;
    if (bubble) return;
    const tel = telemetry(t);
    const n = lifecycleNudge(s, tel) ?? driftNudge(s, tel, adaptiveMaxDrift(loadPrefs()));
    if (n) showNudge(s, n);
  }, [bubble, telemetry, showNudge]);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => { const t = Date.now(); setNow(t); resolvePending(t); evaluate(t); }, 1000);
    return () => clearInterval(id);
  }, [session, evaluate, resolvePending]);

  useEffect(() => {
    if (!session) return;
    const onActivity = () => { lastActivity.current = Date.now(); };
    const onVisibility = () => {
      const t = Date.now();
      if (document.visibilityState === "hidden") { awaySince.current = t; }
      else { switches.current.push(t); awaySince.current = null; lastActivity.current = t; resolvePending(t); evaluate(t); }
    };
    const opts = { passive: true } as const;
    window.addEventListener("mousemove", onActivity, opts);
    window.addEventListener("keydown", onActivity, opts);
    window.addEventListener("scroll", onActivity, opts);
    window.addEventListener("click", onActivity, opts);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("click", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, evaluate, resolvePending]);

  // POP OUT — an always-on-top window that stays beside you across tabs and apps.
  const openPiP = useCallback(async () => {
    try {
      const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow: (o: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      if (!dpip) return;
      const w = await dpip.requestWindow({ width: 340, height: 470 });
      // Bring the app's styles + theme + font into the pop-out so it looks like Synapse.
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => { try { w.document.head.appendChild(node.cloneNode(true)); } catch {} });
      w.document.documentElement.className = document.documentElement.className;
      w.document.body.className = document.body.className;
      w.document.body.style.margin = "0";
      w.document.title = "Synapse";
      w.addEventListener("pagehide", () => setPipWin(null));
      setOpen(false);
      setPipWin(w);
    } catch {}
  }, []);
  const closePiP = useCallback(() => { try { pipWin?.close(); } catch {} setPipWin(null); }, [pipWin]);

  // Close the pop-out when the session ends or the companion unmounts.
  useEffect(() => {
    if (!session && pipWin) { try { pipWin.close(); } catch {} setPipWin(null); }
  }, [session, pipWin]);
  useEffect(() => () => { try { pipWin?.close(); } catch {} }, [pipWin]);

  const endSession = useCallback(() => {
    finishAndRecord(false);
    persist(null);
    setBubble(null); setOpen(false); setThread([]); pending.current = null;
    try { window.dispatchEvent(new CustomEvent("synapse:focus-end")); } catch {}
  }, [persist, finishAndRecord]);

  const startBlock = useCallback((goal: string | null, minutes: number, mode: "focus" | "break") => {
    finishAndRecord(false);
    const s = newSession(goal, minutes, mode);
    recordedFor.current = null; pending.current = null;
    setThread([]); setBubble(null);
    persist(s);
    say(mode === "break" ? "Take a real breather — I'll let you know when it's up." : goal ? `Back on ${goal}. I'm right here.` : "Back to it. I'm right here.");
  }, [persist, say, finishAndRecord]);

  const onReply = useCallback((intent: string) => {
    setBubble(null);
    if (pending.current) { recordOutcome(pending.current.kind, true); pending.current = null; }
    const s = loadSession();
    if (!s) return;
    switch (intent) {
      case "reassure": say("Got it — I'll leave you to it. I'm right here."); break;
      case "restart": say("No problem. What's the very next small step? Name it and just start there."); setOpen(true); break;
      case "break": startBlock(null, 5, "break"); break;
      case "another": startBlock(s.goal, Math.max(1, Math.round(s.durationSec / 60)) || 25, "focus"); break;
      case "done": { const toward = mind?.trajectory?.statement ? ` Another step toward ${mind.trajectory.statement}.` : ""; say(`Nicely done.${toward}`); setTimeout(() => endSession(), 1200); break; }
      default: break;
    }
  }, [say, startBlock, endSession, mind]);

  const send = useCallback(async () => {
    const q = note.trim();
    if (!q || thinking) return;
    setThread((t) => [...t, { id: `u_${Date.now()}`, from: "you" as const, text: q }].slice(-14));
    setNote("");
    if (pending.current) { recordOutcome(pending.current.kind, true); pending.current = null; }
    if (preGate(q).triggered) { say(CRISIS_RESPONSE); return; }
    setThinking(true);
    try {
      const s = loadSession();
      const ctx = `The user is in a focus session${s?.goal ? ` working on ${s.goal}` : ""} and tapped your orb to talk without leaving their work. Be brief and genuinely useful — do exactly what they asked, then get out of the way so they can get back to it. This is a quick aside mid-focus, not a full sit-down.`;
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier: plan, context: ctx }) });
      const data = await res.json();
      say((data && data.content) || "I'm here — tell me a little more?");
    } catch { say("I couldn't reach my reasoning just now — give it a second and try again."); }
    finally { setThinking(false); }
  }, [note, thinking, plan, say]);

  const rem = session ? remainingSec(session, now) : 0;
  const pct = session ? progress(session, now) : 0;
  const r = 26, circ = 2 * Math.PI * r, offset = circ * (1 - pct);

  if (!session) return null;

  const currentReplies = bubble?.replies ?? [];
  const canPop = pipSupported() && !pipWin;

  // The panel guts — rendered inline (corner card) OR inside the pop-out window.
  const panelInner = (
    <>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{session.mode === "break" ? "Break" : "Focusing"}</p>
          <p className="truncate text-sm font-medium text-ink">{session.goal || (session.mode === "break" ? "Resting" : "Focus session")}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="tabular-nums text-lg font-semibold text-ink">{fmtClock(rem)}</span>
          {canPop && (
            <button onClick={openPiP} aria-label="Pop out" title="Pop out — stays beside you across tabs and apps" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><ExternalLink className="h-4 w-4" /></button>
          )}
          <button onClick={() => (pipWin ? closePiP() : setOpen(false))} aria-label={pipWin ? "Dock back into Synapse" : "Minimize"} title={pipWin ? "Dock back" : "Minimize"} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto px-4 py-3">
        {thread.map((l) => (
          <p key={l.id} className={cn("text-sm leading-relaxed", l.from === "you" ? "text-right text-ink" : "text-muted")}>
            {l.from === "you" ? <span className="inline-block rounded-2xl bg-surface-2 px-3 py-1.5">{l.text}</span> : l.text}
          </p>
        ))}
        {thinking && <p className="text-sm text-muted">Thinking…</p>}
        {currentReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {currentReplies.map((rp) => (
              <button key={rp.label} onClick={() => onReply(rp.intent)} className="rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-2">{rp.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2.5">
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder="Talk to Synapse…"
          className="min-w-0 flex-1 rounded-full border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none" />
        <button onClick={() => void send()} disabled={thinking || !note.trim()} aria-label="Send" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-50"><ArrowRight className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <button onClick={() => { const s = loadSession(); if (s) persist({ ...s, endsAt: s.endsAt + 15 * 60_000, durationSec: s.durationSec + 15 * 60 }); }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"><Plus className="h-3.5 w-3.5" /> 15 min</button>
        {session.mode === "focus"
          ? <button onClick={() => startBlock(null, 5, "break")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"><Coffee className="h-3.5 w-3.5" /> Break</button>
          : <button onClick={() => startBlock(null, 25, "focus")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"><Brain className="h-3.5 w-3.5" /> Focus</button>}
        <button onClick={() => { say("Anytime. I'm here when you want to go again."); setTimeout(() => endSession(), 900); }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"><Check className="h-3.5 w-3.5" /> End</button>
      </div>
    </>
  );

  return (
    <>
      {pipWin && createPortal(
        <div className="flex min-h-screen flex-col bg-surface text-ink">{panelInner}</div>,
        pipWin.document.body,
      )}

      <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] print:hidden">
        {!pipWin && open && (
          <div role="dialog" aria-label="Focus companion" className="w-[min(20rem,88vw)] overflow-hidden rounded-3xl border bg-surface/95 shadow-lift backdrop-blur animate-fade-up">
            {panelInner}
          </div>
        )}

        {!pipWin && !open && bubble && (
          <button onClick={() => setOpen(true)}
            className="max-w-[min(18rem,80vw)] rounded-2xl border bg-surface/95 px-3.5 py-2.5 text-left text-sm leading-relaxed text-ink shadow-lift backdrop-blur animate-fade-up">
            {bubble.text}
            {currentReplies.length > 0 && <span className="mt-1 block text-xs font-medium text-orange-600 dark:text-orange-400">Tap to reply</span>}
          </button>
        )}

        {pipWin && (
          <button onClick={() => { try { pipWin.focus(); } catch {} }}
            className="rounded-full border bg-surface/95 px-3 py-1.5 text-xs font-medium text-muted shadow-soft backdrop-blur">
            Popped out — I'm beside you ↗
          </button>
        )}

        <button onClick={() => { if (pipWin) { try { pipWin.focus(); } catch {} } else { setOpen((v) => !v); setBubble(null); } }}
          aria-label={pipWin ? "Focus the pop-out window" : open ? "Minimize focus companion" : `Focus companion — ${fmtClock(rem)} left`}
          className="relative grid h-16 w-16 place-items-center rounded-full transition-transform hover:scale-[1.03] active:scale-95">
          <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-line/60" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className="text-orange-500 transition-[stroke-dashoffset] duration-1000 ease-linear" strokeDasharray={circ} strokeDashoffset={offset} />
          </svg>
          <SynapseOrb size={40} state={thinking ? "thinking" : "idle"} />
        </button>
      </div>
    </>
  );
}
