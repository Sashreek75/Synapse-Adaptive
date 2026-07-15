"use client";

/**
 * GENERIC TASK RENDERERS
 * ----------------------
 * One renderer per cognitive primitive. They are driven entirely by the params
 * Synapse chose — none of them encodes a fixed "scenario". Trials are generated
 * procedurally from a seed, difficulty is honored (and memory_span adapts within
 * the round via a staircase), and each reports a normalized 0..100 score for its
 * target metric. The runner renders WHATEVER plan the Agent emits by dispatching
 * on `kind` — so a brand-new assessment is just a new plan, never new code here.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowRight, Hand, Brain, Search, Grid3x3, Zap } from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import {
  makeRng, shuffle, normReactionMs, normAccuracy, normSpan, normSearch, normProcessing, normSelfReport, meanNorm,
  type TaskParams,
} from "@/lib/assessments/engine";
import type { MetricKey } from "@/types";
import { cn } from "@/lib/utils";

export interface TaskResult { metric: MetricKey; valueNorm: number; raw: Record<string, number>; }

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function Shell({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: typeof Hand; children: React.ReactNode }) {
  return (
    <Card className="sa-rise overflow-hidden">
      <CardBody>
        <div className="flex items-center gap-2 text-orange-500"><Icon className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</span></div>
        {subtitle && <p className="mt-2 text-lg font-medium leading-snug text-ink">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </CardBody>
    </Card>
  );
}

function Dots({ total, done }: { total: number; done: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full transition-colors", i < done ? "bg-orange-500" : "bg-line")} />
      ))}
    </div>
  );
}

export function TaskView({ item, seed, onDone }: { item: { kind: string; params: TaskParams; targetMetric: MetricKey; title?: string }; seed: number; onDone: (r: TaskResult) => void }) {
  switch (item.kind) {
    case "reaction": return <ReactionTask params={item.params} target={item.targetMetric} onDone={onDone} />;
    case "go_no_go": return <GoNoGoTask params={item.params} target={item.targetMetric} onDone={onDone} />;
    case "memory_span": return <MemorySpanTask params={item.params} seed={seed} onDone={onDone} />;
    case "visual_search": return <VisualSearchTask params={item.params} seed={seed} target={item.targetMetric} onDone={onDone} />;
    case "pattern": return <PatternTask params={item.params} seed={seed} target={item.targetMetric} onDone={onDone} />;
    case "self_report": return <SelfReportTask params={item.params} metric={item.params.metric ?? item.targetMetric} onDone={onDone} />;
    default: return null;
  }
}

/* ----------------------------- Reaction ----------------------------------- */
function ReactionTask({ params, target = "reaction_time", onDone }: { params: TaskParams; target?: MetricKey; onDone: (r: TaskResult) => void }) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "go" | "early">("idle");
  const [rts, setRts] = useState<number[]>([]);
  const startRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trials = params.trials;

  function arm() {
    setPhase("waiting");
    timer.current = setTimeout(() => { startRef.current = performance.now(); setPhase("go"); }, 800 + Math.random() * 1800);
  }
  function tap() {
    if (phase === "idle") return arm();
    if (phase === "early") return arm();
    if (phase === "waiting") { if (timer.current) clearTimeout(timer.current); setPhase("early"); return; }
    if (phase === "go") {
      const v = Math.round(performance.now() - startRef.current);
      const next = [...rts, v];
      setRts(next);
      if (next.length >= trials) {
        const kept = next.length >= 4 ? [...next].sort((a, b) => a - b).slice(0, -1) : next;
        const m = median(kept);
        onDone({ metric: target, valueNorm: normReactionMs(m), raw: { meanMs: Math.round(m) } });
      } else { setPhase("idle"); }
    }
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Shell title="Reaction time" subtitle="Tap the panel the instant it turns green." icon={Zap}>
      <button onClick={tap}
        className={cn("grid h-52 w-full place-items-center rounded-2xl text-lg font-semibold text-white transition-colors",
          phase === "idle" && "bg-navy-700 hover:bg-navy-600",
          phase === "waiting" && "bg-orange-600",
          phase === "go" && "bg-emerald-500 sa-pulse",
          phase === "early" && "bg-navy-900")}>
        {phase === "idle" && (rts.length ? "Tap to start the next one" : "Tap to start")}
        {phase === "waiting" && "Wait for green…"}
        {phase === "go" && "Tap now!"}
        {phase === "early" && "Too soon — tap to try again"}
      </button>
      <div className="mt-4"><Dots total={trials} done={rts.length} /></div>
    </Shell>
  );
}

/* ----------------------------- Go / No-Go --------------------------------- */
function GoNoGoTask({ params, target, onDone }: { params: TaskParams; target: MetricKey; onDone: (r: TaskResult) => void }) {
  const trials = params.trials;
  const seq = useMemo(() => Array.from({ length: trials }, () => Math.random() > 0.32), [trials]); // ~68% go
  const windowMs = Math.max(560, 1180 - params.difficulty * 120);
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState<null | "hit" | "miss" | "false">(null);
  const respondedRef = useRef(false);
  const shownAt = useRef(0);
  const stats = useRef({ correct: 0, rts: [] as number[] });

  useEffect(() => {
    if (idx >= trials) {
      const acc = stats.current.correct / trials;
      const rts = stats.current.rts;
      const valueNorm = target === "reaction_time"
        ? normReactionMs(rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 700)
        : normAccuracy(acc);
      onDone({ metric: target, valueNorm, raw: { accuracyPct: Math.round(acc * 100), meanMs: Math.round(rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0) } });
      return;
    }
    respondedRef.current = false;
    shownAt.current = performance.now();
    const t = setTimeout(() => {
      if (!respondedRef.current) {
        // no response: correct only if it was a NO-GO
        if (!seq[idx]) { stats.current.correct++; setFlash(null); }
        else setFlash("miss");
      }
      setTimeout(() => { setFlash(null); setIdx((i) => i + 1); }, 180);
    }, windowMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function tap() {
    if (idx >= trials || respondedRef.current) return;
    respondedRef.current = true;
    if (seq[idx]) { stats.current.correct++; stats.current.rts.push(Math.round(performance.now() - shownAt.current)); setFlash("hit"); }
    else { setFlash("false"); }
  }

  const isGo = idx < trials && seq[idx];
  return (
    <Shell title="Go / No-Go" subtitle="Tap on GREEN. Hold back on ORANGE." icon={Hand}>
      <button onClick={tap}
        className={cn("relative grid h-52 w-full place-items-center rounded-2xl transition-colors",
          idx >= trials ? "bg-navy-900" : isGo ? "bg-emerald-500" : "bg-orange-500")}>
        <span className="grid h-24 w-24 place-items-center rounded-full bg-white/20 text-white">
          {isGo ? <span className="text-base font-semibold">TAP</span> : <span className="text-base font-semibold">WAIT</span>}
        </span>
        {flash && (
          <span className={cn("absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold",
            flash === "hit" ? "bg-white/90 text-emerald-700" : "bg-white/90 text-orange-700")}>
            {flash === "hit" ? "nice" : flash === "false" ? "hold next time" : "missed"}
          </span>
        )}
      </button>
      <div className="mt-4"><Dots total={trials} done={Math.min(idx, trials)} /></div>
    </Shell>
  );
}

/* ----------------------------- Memory span (staircase) -------------------- */
function MemorySpanTask({ params, seed, onDone }: { params: TaskParams; seed: number; onDone: (r: TaskResult) => void }) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = params.trials;
  const [span, setSpan] = useState(Math.min(3 + Math.floor(params.difficulty / 2), 5));
  const [round, setRound] = useState(0);
  const [seq, setSeq] = useState<number[]>([]);
  const [phase, setPhase] = useState<"show" | "input" | "between">("show");
  const [active, setActive] = useState<number | null>(null);
  const [entry, setEntry] = useState<number[]>([]);
  const maxRef = useRef(0);

  // Build + play a sequence whenever a new round begins.
  useEffect(() => {
    if (round >= rounds) {
      onDone({ metric: "working_memory", valueNorm: normSpan(maxRef.current || span), raw: { maxSpan: maxRef.current || span } });
      return;
    }
    const s = Array.from({ length: span }, () => Math.floor(rng() * 9));
    setSeq(s); setEntry([]); setPhase("show");
    let i = 0;
    const play = () => {
      setActive(s[i]);
      setTimeout(() => {
        setActive(null);
        i++;
        if (i < s.length) setTimeout(play, 220);
        else setTimeout(() => setPhase("input"), 350);
      }, 520);
    };
    const start = setTimeout(play, 600);
    return () => clearTimeout(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function tapTile(n: number) {
    if (phase !== "input") return;
    const next = [...entry, n];
    setEntry(next);
    const i = next.length - 1;
    if (next[i] !== seq[i]) { // wrong → shorten, next round
      setPhase("between");
      setSpan((v) => Math.max(2, v - 1));
      setTimeout(() => setRound((r) => r + 1), 700);
      return;
    }
    if (next.length === seq.length) { // full correct → record, lengthen
      maxRef.current = Math.max(maxRef.current, seq.length);
      setPhase("between");
      setSpan((v) => Math.min(9, v + 1));
      setTimeout(() => setRound((r) => r + 1), 700);
    }
  }

  return (
    <Shell title="Memory span" subtitle={phase === "input" ? "Now tap the tiles in the same order." : "Watch the sequence…"} icon={Brain}>
      <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, n) => (
          <button key={n} disabled={phase !== "input"} onClick={() => tapTile(n)}
            className={cn("aspect-square rounded-xl border transition-all",
              active === n ? "scale-105 bg-orange-500 shadow-lift" : "bg-surface-2",
              phase === "input" ? "hover:border-orange-400 hover:bg-surface" : "cursor-default",
              entry.includes(n) && phase === "input" && "bg-navy-200 dark:bg-navy-700")} />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-muted">
        <span>Round {Math.min(round + 1, rounds)} / {rounds}</span>
        <span>Span {seq.length || span}</span>
      </div>
    </Shell>
  );
}

/* ----------------------------- Visual search ------------------------------ */
const SEARCH_PAIRS: [string, string][] = [["E", "F"], ["O", "Q"], ["C", "G"], ["P", "R"], ["M", "N"], ["V", "Y"], ["◆", "◇"], ["▲", "△"]];
function VisualSearchTask({ params, seed, target, onDone }: { params: TaskParams; seed: number; target: MetricKey; onDone: (r: TaskResult) => void }) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = params.trials;
  const n = 9 + params.difficulty * 5; // 14..34 cells
  const [round, setRound] = useState(0);
  const board = useMemo(() => {
    const [distract, tgt] = SEARCH_PAIRS[Math.floor(rng() * SEARCH_PAIRS.length)];
    const targetIdx = Math.floor(rng() * n);
    return { distract, tgt, targetIdx };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const shownAt = useRef(performance.now());
  const stats = useRef({ correct: 0, times: [] as number[] });
  useEffect(() => { shownAt.current = performance.now(); }, [round]);

  function tap(i: number) {
    const dt = performance.now() - shownAt.current;
    stats.current.times.push(dt);
    if (i === board.targetIdx) stats.current.correct++;
    if (round + 1 >= rounds) {
      const acc = stats.current.correct / rounds;
      const med = median(stats.current.times);
      const valueNorm = target === "reaction_time" ? normReactionMs(med)
        : target === "processing_speed" ? normProcessing(acc, med)
        : normSearch(acc, med);
      onDone({ metric: target, valueNorm, raw: { accuracyPct: Math.round(acc * 100), medianMs: Math.round(med) } });
    } else setRound((r) => r + 1);
  }

  const cols = n <= 16 ? 4 : n <= 25 ? 5 : 6;
  return (
    <Shell title="Visual search" subtitle="Tap the one that's different — quickly." icon={Search}>
      <div className="mx-auto grid max-w-[320px] gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }).map((_, i) => (
          <button key={i} onClick={() => tap(i)}
            className="grid aspect-square place-items-center rounded-lg bg-surface-2 text-lg font-semibold text-ink transition-colors hover:bg-surface hover:text-orange-500">
            {i === board.targetIdx ? board.tgt : board.distract}
          </button>
        ))}
      </div>
      <div className="mt-5 text-center"><Dots total={rounds} done={round} /></div>
    </Shell>
  );
}

/* ----------------------------- Pattern ------------------------------------ */
function PatternTask({ params, seed, target, onDone }: { params: TaskParams; seed: number; target: MetricKey; onDone: (r: TaskResult) => void }) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = params.trials;
  const [round, setRound] = useState(0);
  const correctRef = useRef(0);

  const puzzle = useMemo(() => {
    const d = params.difficulty;
    const start = 1 + Math.floor(rng() * 6);
    let rule: (i: number) => number;
    let next: number;
    if (d >= 4 && rng() > 0.5) { const f = 2 + Math.floor(rng() * 2); rule = (i) => start * Math.pow(f, i); }
    else { const step = (1 + Math.floor(rng() * (2 + d))) * (rng() > 0.5 || d < 2 ? 1 : 1); rule = (i) => start + step * i; }
    const seqLen = 4;
    const shown = Array.from({ length: seqLen }, (_, i) => rule(i));
    next = rule(seqLen);
    const distract = new Set<number>([next]);
    while (distract.size < 4) { const cand = next + (Math.floor(rng() * 9) - 4) || next + 1; if (cand !== next && cand > 0) distract.add(cand); }
    const options = shuffle(rng, [...distract]);
    return { shown, next, options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function pick(v: number) {
    if (v === puzzle.next) correctRef.current++;
    if (round + 1 >= rounds) onDone({ metric: target, valueNorm: normAccuracy(correctRef.current / rounds), raw: { accuracyPct: Math.round((correctRef.current / rounds) * 100) } });
    else setRound((r) => r + 1);
  }

  return (
    <Shell title="Pattern recognition" subtitle="What comes next in the sequence?" icon={Grid3x3}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {puzzle.shown.map((v, i) => (
          <span key={i} className="grid h-14 w-14 place-items-center rounded-xl bg-surface-2 text-xl font-semibold text-ink">{v}</span>
        ))}
        <span className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-orange-300 text-xl font-semibold text-orange-500">?</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {puzzle.options.map((v) => (
          <button key={v} onClick={() => pick(v)}
            className="rounded-xl border bg-surface px-4 py-4 text-lg font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-orange-400 hover:text-orange-500 hover:shadow-soft">{v}</button>
        ))}
      </div>
      <div className="mt-5 text-center"><Dots total={rounds} done={round} /></div>
    </Shell>
  );
}

/* ----------------------------- Self report -------------------------------- */
const SELF_COPY: Record<string, { prompt: string; low: string; high: string }> = {
  fatigue: { prompt: "How tired have you felt recently?", low: "Very low", high: "Very high" },
  stress: { prompt: "How stressed have you felt recently?", low: "Very low", high: "Very high" },
  sleep_quality: { prompt: "How restorative has your sleep felt?", low: "Poor", high: "Great" },
  mood: { prompt: "How has your mood been overall?", low: "Low", high: "Great" },
  symptoms: { prompt: "How much have your symptoms interfered with your day?", low: "Not at all", high: "A lot" },
};
function SelfReportTask({ params, metric, onDone }: { params: TaskParams; metric: MetricKey; onDone: (r: TaskResult) => void }) {
  const copy = SELF_COPY[metric] ?? SELF_COPY.fatigue;
  const [value, setValue] = useState(3);
  return (
    <Shell title="Quick check-in" subtitle={params.prompt || copy.prompt} icon={Check}>
      <p className="text-sm text-muted">Just how it&apos;s been for you — there&apos;s no right answer.</p>
      <div className="mt-6 flex items-center justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setValue(n)}
            className={cn("h-14 flex-1 rounded-xl border text-base font-semibold transition-all",
              value === n ? "border-orange-400 bg-orange-500 text-white shadow-soft" : "bg-surface-2 text-muted hover:bg-surface")}>{n}</button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted"><span>{params.lowLabel || copy.low}</span><span>{params.highLabel || copy.high}</span></div>
      <Button className="mt-7 w-full" onClick={() => onDone({ metric, valueNorm: normSelfReport(value), raw: { level: value } })}>
        Continue <ArrowRight className="h-4 w-4" />
      </Button>
    </Shell>
  );
}

export { meanNorm };
