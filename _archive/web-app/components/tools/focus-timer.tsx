"use client";

/**
 * FOCUS TIMER — the Executor role, made tangible.
 *
 * "If the user asks for a timer, give them a timer." A real Pomodoro-style focus
 * timer that keeps running across reloads and navigation (it stores an absolute
 * end time and recomputes from the clock, so it never drifts), shows the count in
 * the tab title while you work, and closes the loop with one calm next step. No
 * intelligence-engine involvement — this is a genuinely-used daily tool.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, Check } from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const KEY = "synapse.tools.timer.v1";
type Mode = "focus" | "break";
interface Persist { mode: Mode; durationSec: number; endsAt: number | null; remainingSec: number; running: boolean }

const FOCUS_PRESETS = [15, 25, 50];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function FocusTimer() {
  const [mode, setMode] = useState<Mode>("focus");
  const [durationSec, setDurationSec] = useState(25 * 60);
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [goal, setGoal] = useState<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback((p: Persist) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persist;
        setMode(p.mode); setDurationSec(p.durationSec);
        if (p.running && p.endsAt) {
          const rem = Math.max(0, Math.round((p.endsAt - Date.now()) / 1000));
          setRemainingSec(rem); setEndsAt(p.endsAt); setRunning(rem > 0);
        } else { setRemainingSec(p.remainingSec ?? p.durationSec); }
      }
    } catch {}
    try { setGoal(localStorage.getItem("synapse.tools.focusGoal")); } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!running || !endsAt) return;
    tick.current = setInterval(() => {
      const rem = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemainingSec(rem);
      if (rem <= 0) {
        setRunning(false); setEndsAt(null); setJustFinished(true);
        save({ mode, durationSec, endsAt: null, remainingSec: 0, running: false });
      }
    }, 250);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running, endsAt, mode, durationSec, save]);

  useEffect(() => {
    if (!hydrated) return;
    const base = document.title;
    if (running) document.title = `${fmt(remainingSec)} · ${mode === "focus" ? "Focus" : "Break"}`;
    return () => { document.title = base; };
  }, [running, remainingSec, mode, hydrated]);

  function start() {
    const ends = Date.now() + remainingSec * 1000;
    setEndsAt(ends); setRunning(true); setJustFinished(false);
    save({ mode, durationSec, endsAt: ends, remainingSec, running: true });
  }
  function pause() {
    setRunning(false); setEndsAt(null);
    save({ mode, durationSec, endsAt: null, remainingSec, running: false });
  }
  function reset(nextDuration = durationSec, nextMode: Mode = mode) {
    setRunning(false); setEndsAt(null); setJustFinished(false);
    try { localStorage.removeItem("synapse.tools.focusGoal"); } catch {} setGoal(null);
    setMode(nextMode); setDurationSec(nextDuration); setRemainingSec(nextDuration);
    save({ mode: nextMode, durationSec: nextDuration, endsAt: null, remainingSec: nextDuration, running: false });
  }
  function setFocusMinutes(min: number) { reset(min * 60, "focus"); }

  if (!hydrated) return <Card><CardBody className="h-64" /></Card>;

  const pct = durationSec > 0 ? 1 - remainingSec / durationSec : 0;

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-5 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {mode === "focus" ? <Brain className="h-3.5 w-3.5 text-orange-500" /> : <Coffee className="h-3.5 w-3.5 text-emerald-500" />}
            {mode === "focus" ? "Focus timer" : "Break"}
          </p>
          <div className="inline-flex rounded-full border bg-surface-2 p-0.5 text-xs">
            <button onClick={() => reset(mode === "focus" ? durationSec : 25 * 60, "focus")} aria-pressed={mode === "focus"}
              className={cn("rounded-full px-2.5 py-1 font-medium transition", mode === "focus" ? "bg-surface text-ink shadow-soft" : "text-muted")}>Focus</button>
            <button onClick={() => reset(5 * 60, "break")} aria-pressed={mode === "break"}
              className={cn("rounded-full px-2.5 py-1 font-medium transition", mode === "break" ? "bg-surface text-ink shadow-soft" : "text-muted")}>Break</button>
          </div>
        </div>

        {goal && <p className="text-center text-sm text-muted">Working on <span className="font-medium text-ink">{goal}</span></p>}

        <div className="text-center">
          <div className="tabular-nums text-6xl font-semibold tracking-tight text-ink sm:text-7xl">{fmt(remainingSec)}</div>
          <div className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line/70 dark:bg-white/10">
            <div className="h-full rounded-full bg-orange-500 transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          {!running ? (
            <Button onClick={start} disabled={remainingSec <= 0} className="min-w-[7.5rem]"><Play className="h-4 w-4" /> {remainingSec < durationSec ? "Resume" : "Start"}</Button>
          ) : (
            <Button onClick={pause} variant="outline" className="min-w-[7.5rem]"><Pause className="h-4 w-4" /> Pause</Button>
          )}
          <button onClick={() => reset()} aria-label="Reset timer" className="grid h-11 w-11 place-items-center rounded-full border bg-surface text-muted transition hover:text-ink">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {mode === "focus" && !running && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {FOCUS_PRESETS.map((m) => (
              <button key={m} onClick={() => setFocusMinutes(m)}
                className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition", durationSec === m * 60 ? "border-orange-500 bg-orange-500/10 text-ink" : "bg-surface text-muted hover:text-ink")}>
                {m} min
              </button>
            ))}
          </div>
        )}

        {justFinished && (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-ink">
              <Check className="h-4 w-4 text-emerald-500" /> {mode === "focus" ? "Nice — that's a focus block done." : "Break's up — ready when you are."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {mode === "focus" ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => reset(5 * 60, "break")}><Coffee className="h-4 w-4" /> 5-min break</Button>
                  <Button size="sm" onClick={() => reset(durationSec, "focus")}><Brain className="h-4 w-4" /> Another block</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => reset(25 * 60, "focus")}><Brain className="h-4 w-4" /> Back to focus</Button>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
