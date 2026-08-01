"use client";

/**
 * ADAPTIVE DAILY CHECK-IN
 * -----------------------
 * Synapse composes the WHOLE check-in fresh each day (/api/daily-plan): the
 * greeting and every item — sliders, multiple-choice, open notes, or a quick
 * reaction mini-game — chosen from this person's Playbook, open questions,
 * beliefs, trends, and recent notes. No two days look the same. The plan is
 * cached per day so it's stable and costs no extra tokens on re-opens. If the
 * model is unavailable or returns something unusable, a deterministic check-in
 * takes over — it always works.
 *
 * Store contract: addCheckIn with 0-100 metrics; addContextNote for anything the
 * person tells us that isn't a metric.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Battery, Activity, Check, Smile, CalendarDays, Sparkles, Zap, HelpCircle, Flag } from "lucide-react";
import { Card, CardBody, Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { getPath } from "@/lib/paths";
import { dailyReflection, type DailyReflection } from "@/lib/intelligence";
import { addCommitment, loadCommitments } from "@/lib/commitments";
import { readMomentum, commitmentHint } from "@/lib/momentum";
import { witness } from "@/lib/activity";
import { cn } from "@/lib/utils";
import type { MetricKey, MetricSeries, SignalId } from "@/types";
import type { DailyCheckinOutput, DailyItemOutput } from "@/ai/schemas";

const wordFor = (labels: string[], v: number) => labels[Math.min(labels.length - 1, Math.floor((v / 100) * labels.length))];

function seriesWithToday(series: MetricSeries[], metrics: Partial<Record<MetricKey, number>>, date: string): MetricSeries[] {
  const map = new Map<SignalId, MetricSeries>(series.map((s) => [s.metric, { metric: s.metric, points: [...s.points] }]));
  for (const [m, v] of Object.entries(metrics) as [MetricKey, number][]) {
    if (v == null) continue;
    if (!map.has(m)) map.set(m, { metric: m, points: [] });
    map.get(m)!.points.push({ metric: m, valueNorm: v, recordedAt: date });
  }
  return [...map.values()];
}

/** ms → 0-100 reaction score (faster = higher; ~250ms≈100, ~1050ms≈0). */
const reactionScore = (ms: number) => Math.max(0, Math.min(100, Math.round(100 - (ms - 250) / 8)));

/* ---- Deterministic fallback phrasing (only used if the model is unavailable) ---- */
const SLEEP = ["Rough", "Light", "Okay", "Good", "Great"];
const ENERGY = ["Drained", "Low", "Okay", "Good", "Strong"];
const STRESS = ["Calm", "Low", "Moderate", "High", "Very high"];
const MOOD = ["Low", "Flat", "Okay", "Good", "Great"];
const SYMPTOMS = ["Barely", "A little", "Somewhat", "Quite a bit", "A lot"];
const SLEEP_Q = ["How did you sleep?", "Was last night restorative?", "How rested do you feel this morning?"];
const ENERGY_Q = ["Energy right now?", "How much is in the tank today?", "Where's your energy sitting today?"];
const STRESS_Q = ["Stress level?", "How much pressure are you carrying today?", "How heavy is today feeling?"];
const MOOD_Q = ["Mood today?", "How's your headspace today?", "How are you feeling, honestly?"];
const EVENT_Q = ["Anything notable happen today?", "Anything I should know about today?", "Did today throw anything at you?"];
const PROGRESS_Q = ["What did you move forward on today?", "What did you make progress on today?", "What's one thing you pushed forward today?", "What did you get done toward your goal today?", "Where did you make headway today?"];

function daySeed(): number {
  const s = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const variant = <T,>(xs: T[], seed: number, salt: number): T => xs[(seed + salt) % xs.length];

const SCALE_ICON: Record<string, typeof Moon> = {
  sleep_quality: Moon, fatigue: Battery, stress: Activity, mood: Smile, symptoms: Activity, reaction_time: Zap,
};

/** Client-side sanity check for a cached/returned generated plan. */
function isValidCheckin(p: unknown): p is DailyCheckinOutput {
  if (!p || typeof p !== "object") return false;
  const plan = p as DailyCheckinOutput;
  if (typeof plan.greeting !== "string" || !plan.greeting) return false;
  if (!Array.isArray(plan.items) || plan.items.length < 3) return false;
  const core = new Set(["sleep_quality", "fatigue", "stress", "mood", "symptoms"]);
  let coreCaptures = 0;
  for (const it of plan.items) {
    if (!it || typeof (it as { type?: string }).type !== "string") return false;
    if (it.type === "scale" && core.has(it.metric)) coreCaptures++;
    if (it.type === "choice" && Array.isArray(it.options) && it.options.some((o) => o.metric && core.has(o.metric) && o.value != null)) coreCaptures++;
  }
  return coreCaptures >= 1;
}

/** A brief, non-leading feeling summary (a secondary lens for the model). */
function feelingSummary(m: Partial<Record<MetricKey, number>>): string {
  const w = (labels: string[], v: number) => labels[Math.min(labels.length - 1, Math.floor((v / 100) * labels.length))];
  const bits: string[] = [];
  if (m.sleep_quality != null) bits.push("sleep " + w(SLEEP, m.sleep_quality).toLowerCase());
  if (m.fatigue != null) bits.push("energy " + w(ENERGY, 100 - m.fatigue).toLowerCase());
  if (m.stress != null) bits.push("stress " + w(STRESS, m.stress).toLowerCase());
  if (m.mood != null) bits.push("mood " + w(MOOD, m.mood).toLowerCase());
  return bits.join(", ");
}

/** Parse the model labelled instant read into the reflection shape (graceful if it strays). */
function parseReflection(text: string): DailyReflection | null {
  const t = (text || "").trim();
  if (!t) return null;
  const nl = String.fromCharCode(10);
  const pick = (label: string) => {
    const line = t.split(nl).find((l) => l.trim().toUpperCase().startsWith(label + ":"));
    return line ? line.slice(line.indexOf(":") + 1).trim() : "";
  };
  const lead = pick("LEAD"), insight = pick("INSIGHT"), action = pick("TRY"), watch = pick("WATCH");
  if (!lead && !action) return { lead: t, points: [], action: null, watch: null, confidence: "moderate" };
  return { lead: lead || t, points: insight ? [insight] : [], action: action || null, watch: watch || null, confidence: "moderate" };
}

/**
 * DETERMINISTIC FALLBACK — composed, and DIFFERENT each day, so an offline check-in still
 * feels alive instead of four identical sliders. Rotates item TYPES and phrasing by day seed
 * and renders through the same pipeline as a model-authored plan. Only used when the model is
 * unavailable (no key / quota / error).
 */
function buildFallbackPlan(seed: number): DailyCheckinOutput {
  const sleepScale: DailyItemOutput = { type: "scale", metric: "sleep_quality", question: variant(SLEEP_Q, seed, 0), lowLabel: "Rough", highLabel: "Great" };
  const energyScale: DailyItemOutput = { type: "scale", metric: "fatigue", question: variant(ENERGY_Q, seed, 1), lowLabel: "Drained", highLabel: "Energized", invert: true };
  const stressScale: DailyItemOutput = { type: "scale", metric: "stress", question: variant(STRESS_Q, seed, 2), lowLabel: "Calm", highLabel: "Very high" };
  const moodScale: DailyItemOutput = { type: "scale", metric: "mood", question: variant(MOOD_Q, seed, 3), lowLabel: "Low", highLabel: "Great" };
  const moodChoice: DailyItemOutput = { type: "choice", question: variant(MOOD_Q, seed, 5), options: [
    { label: "Low", metric: "mood", value: 15 }, { label: "Flat", metric: "mood", value: 38 }, { label: "Okay", metric: "mood", value: 58 }, { label: "Good", metric: "mood", value: 80 }, { label: "Great", metric: "mood", value: 95 },
  ] };
  const energyChoice: DailyItemOutput = { type: "choice", question: variant(ENERGY_Q, seed, 6), options: [
    { label: "Drained", metric: "fatigue", value: 90 }, { label: "Low", metric: "fatigue", value: 68 }, { label: "Okay", metric: "fatigue", value: 45 }, { label: "Good", metric: "fatigue", value: 25 }, { label: "Strong", metric: "fatigue", value: 10 },
  ] };
  const stressChoice: DailyItemOutput = { type: "choice", question: variant(STRESS_Q, seed, 8), options: [
    { label: "Calm", metric: "stress", value: 12 }, { label: "A bit", metric: "stress", value: 38 }, { label: "Moderate", metric: "stress", value: 58 }, { label: "High", metric: "stress", value: 80 }, { label: "Very high", metric: "stress", value: 95 },
  ] };
  const weighNote: DailyItemOutput = { type: "note", question: "Anything weighing on you today?", chips: ["Nothing much", "Work", "Sleep", "People", "Health", "A lot"] };
  const eventNote: DailyItemOutput = { type: "note", question: variant(EVENT_Q, seed, 7), chips: ["Nothing big", "Busy day", "Rough patch", "Good news"] };

  const templates: DailyItemOutput[][] = [
    [sleepScale, energyChoice, stressScale, weighNote],
    [moodChoice, energyScale, weighNote],
    [moodScale, sleepScale, stressChoice, eventNote],
    [stressScale, energyChoice, moodChoice, eventNote],
  ];
  const gh = new Date().getHours();
  const greeting = gh < 12
    ? variant(["Morning — let's line up today.", "A quick morning check-in before you dive in.", "Let's set the tone for today."], seed, 4)
    : gh < 18
    ? variant(["A midday check-in — how's it going so far?", "Quick pulse on your day so far.", "Let's catch where today's at."], seed, 4)
    : variant(["Let's take a quick read on how today went.", "Evening check-in — how did today go?", "Let's capture today while it's fresh."], seed, 4);
  return { greeting, items: templates[seed % templates.length] };
}

export function DailyCheckIn() {
  const router = useRouter();
  const { dailyDoneToday, addCheckIn, addContextNote, recentChanges, contextNotes, profile, series, checkIns, mind } = useHealth();
  const { plan: tier } = useSubscription();

  const [plan, setPlan] = useState<DailyCheckinOutput | null | undefined>(undefined);
  // Generated-item answers, keyed by item index.
  const [ans, setAns] = useState<Record<number, { scale?: number; choice?: number; text?: string; chip?: string; reaction?: number }>>({});

  // Fallback state.
  const [sleep, setSleep] = useState(50);
  const [energy, setEnergy] = useState(50);
  const [stress, setStress] = useState(50);
  const [mood, setMood] = useState(50);
  const [hasSymptoms, setHasSymptoms] = useState(false);
  const [symptoms, setSymptoms] = useState(40);
  const [lifeEvent, setLifeEvent] = useState("");
  const [fallbackAnswer, setFallbackAnswer] = useState("");
  const [progress, setProgress] = useState("");

  const [saved, setSaved] = useState(false);
  const [reflection, setReflection] = useState<DailyReflection | null>(null);
  const [reflecting, setReflecting] = useState(false);

  const seed = useMemo(daySeed, []);
  const fq = useMemo(() => ({
    sleep: variant(SLEEP_Q, seed, 0), energy: variant(ENERGY_Q, seed, 1),
    stress: variant(STRESS_Q, seed, 2), mood: variant(MOOD_Q, seed, 3), event: variant(EVENT_Q, seed, 7),
  }), [seed]);
  const progressLabel = useMemo(() => {
    if (plan && plan.progressPrompt) return plan.progressPrompt;
    const h = new Date().getHours();
    if (h < 12) return "What do you want to move forward today?";
    if (h < 18) return variant(["What have you moved forward so far today?", "What's one thing you've pushed forward so far?", "Where have you made headway so far?"], seed, 9);
    return variant(PROGRESS_Q, seed, 9);
  }, [plan, seed]);

  useEffect(() => {
    const key = `synapse.dailyplan.v3.${new Date().toISOString().slice(0, 10)}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (isValidCheckin(cached)) { setPlan(cached); return; }
    } catch {}
    let active = true;
    fetch("/api/daily-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: profile.path,
        pathLabel: profile.pathLabel,
        focusNoun: getPath(profile.path).focusNoun,
        goals: profile.goals,
        trends: recentChanges.map((c) => ({ metric: c.metric, label: c.label, improving: c.improving, delta: c.deltaNorm })),
        notes: contextNotes.slice(-4).map((n) => ({ prompt: n.prompt, answer: n.answer })),
        playbook: mind.playbook.slice(-8).map((p) => p.statement),
        beliefs: mind.beliefs.map((b) => b.statement),
        openQuestions: mind.openQuestions.filter((q) => q.status === "open").map((q) => q.question),
        checkInCount: checkIns.length,
        dayOfWeek: new Date().toLocaleDateString(undefined, { weekday: "long" }),
        partOfDay: (() => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; })(),
        localTime: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (isValidCheckin(d?.plan)) { setPlan(d.plan); try { localStorage.setItem(key, JSON.stringify(d.plan)); } catch {} }
        else setPlan(buildFallbackPlan(seed));
      })
      .catch(() => { if (active) setPlan(buildFallbackPlan(seed)); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setItem(i: number, patch: Partial<{ scale: number; choice: number; text: string; chip: string; reaction: number }>) {
    setAns((cur) => ({ ...cur, [i]: { ...cur[i], ...patch } }));
  }

  // The instant read after a check-in: MODEL-driven, tailored to their goals and to
  // exactly what they wrote today. The deterministic reflection is only an offline safety net.
  async function runInstantRead(metrics: Partial<Record<MetricKey, number>>, date: string, written: string[]) {
    setSaved(true); setReflecting(true); setReflection(null);
    try { witness("snapshot", written.map((w) => (w || "").trim()).filter(Boolean)[0]); } catch {}
    let fallback: DailyReflection | null = null;
    try { fallback = dailyReflection(seriesWithToday(series, metrics, date), profile.path); } catch {}
    const nl = String.fromCharCode(10);
    try {
      const said = written.map((w) => (w || "").trim()).filter(Boolean).join(" | ");
      const feeling = feelingSummary(metrics);
      const mom = readMomentum(loadCommitments());
      const ctx = [
        "Right now it is " + new Date().toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + ". Anchor any time words to this; a step they set for a later day is not due now.",
        "The user just finished the check-in below. Give an INSTANT, genuinely useful read, specific to THEM and their goals, never generic wellbeing.",
        mind.trajectory && mind.trajectory.statement ? "They are working to become: " + mind.trajectory.statement + "." : "",
        profile.goals && profile.goals.length ? "Their focus areas: " + profile.goals.join(", ") + "." : "",
        profile.definitionOfBetter ? "What better looks like to them: " + profile.definitionOfBetter + "." : "",
        said ? ("In their OWN words today: " + JSON.stringify(said) + ". Reference this directly so they know you truly read it.") : "",
        feeling ? ("How they are feeling today (a secondary lens, do NOT lead with this): " + feeling + ".") : "",
        mom.observation ? ("Where their momentum is trending (factor this into the ONE step: push if building, protect and shrink if fragile): " + mom.observation) : "",
        "Reply in EXACTLY this labelled format. Each line 1-2 sentences, warm, concrete, second person:",
        "LEAD: the single most useful thing you notice today, tied to what they did or their goal.",
        "INSIGHT: one non-obvious connection or a genuine encouragement (omit this line entirely if you have nothing real).",
        "TRY: one concrete step toward their goal for tomorrow. Match it to their energy today, keep the destination, never busywork.",
        "WATCH: one thing you will keep an eye on next.",
        "No preamble and no markdown. Just those labelled lines.",
      ].filter(Boolean).join(nl);
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: said || "Here is my check-in for today.", tier, context: ctx }) });
      const data = await res.json();
      const parsed = parseReflection(String((data && data.content) || ""));
      setReflection(parsed || fallback);
    } catch { setReflection(fallback); }
    finally { setReflecting(false); }
  }
  function saveGenerated(items: DailyItemOutput[]) {
    const date = new Date().toISOString();
    const metrics: Partial<Record<MetricKey, number>> = {};
    const notes: { prompt: string; answer: string }[] = [];
    items.forEach((it, i) => {
      const a = ans[i] ?? {};
      if (it.type === "scale") {
        const v = a.scale ?? 50;
        metrics[it.metric] = it.invert ? 100 - v : v;
      } else if (it.type === "choice") {
        if (a.choice == null) return;
        const opt = it.options[a.choice];
        if (opt?.metric && opt.value != null) metrics[opt.metric] = opt.value;
        else if (opt) notes.push({ prompt: it.question, answer: opt.label });
      } else if (it.type === "note") {
        const answer = (a.text || "").trim() || a.chip || "";
        if (answer) notes.push({ prompt: it.question, answer });
      } else if (it.type === "reaction") {
        if (a.reaction != null) metrics.reaction_time = a.reaction;
      }
    });
    if (progress.trim()) addContextNote(progressLabel, progress.trim());
    addCheckIn({ date, kind: "daily", metrics, note: "Daily check-in" });
    for (const n of notes) addContextNote(n.prompt, n.answer);
    void runInstantRead(metrics, date, [progress.trim(), ...notes.map((n) => n.answer)]);
  }

  function saveFallback() {
    const date = new Date().toISOString();
    const metrics: Partial<Record<MetricKey, number>> = { sleep_quality: sleep, fatigue: 100 - energy, stress, mood };
    if (hasSymptoms) metrics.symptoms = symptoms;
    if (progress.trim()) addContextNote(progressLabel, progress.trim());
    addCheckIn({ date, kind: "daily", metrics, note: "Daily check-in" });
    if (fallbackAnswer.trim()) addContextNote(fq.event, fallbackAnswer.trim());
    if (lifeEvent.trim()) addContextNote(fq.event, lifeEvent.trim());
    void runInstantRead(metrics, date, [progress.trim(), fallbackAnswer.trim(), lifeEvent.trim()]);
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="sa-rise overflow-hidden"><div className="mesh"><CardBody className="py-8">
          <div className="flex items-center gap-3">
            <SynapseOrb size={40} state={reflecting ? "thinking" : "idle"} className="shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Here&apos;s what I noticed just now</h2>
              <p className="text-xs text-muted">A quick read on today — from your own data.</p>
            </div>
          </div>
          {reflecting ? (
            <p className="mt-4 text-sm text-muted">Reading your day — one sec…</p>
          ) : reflection ? (
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
              <p>{reflection.lead}</p>
              {reflection.points.map((p, i) => <p key={i} className="rounded-xl bg-surface-2 p-3">{p}</p>)}
              {reflection.action && (
                <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-ink dark:border-orange-500/20 dark:bg-orange-500/10">
                  <span className="font-semibold text-orange-700 dark:text-orange-300">Try this: </span>{reflection.action}
                </p>
              )}
              {reflection.watch && <p className="text-muted">{reflection.watch}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Logged. Now the part that matters — let&apos;s turn today into one small step you&apos;ll actually take, just below.</p>
          )}
        </CardBody></div></Card>
        {!reflecting && <CommitmentCapture suggestion={reflection?.action ?? ""} towards={mind.trajectory?.statement ?? undefined} />}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => router.push("/dashboard")}>Done for today <Check className="h-4 w-4" /></Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push("/dashboard#conversation")}>Talk this through</Button>
        </div>
      </div>
    );
  }

  if (plan === undefined) {
    return (
      <div className="mx-auto max-w-md">
        <header className="sa-rise mb-4 flex items-center gap-3">
          <SynapseOrb size={44} state="thinking" className="shrink-0" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Today&apos;s check-in</h1>
            <p className="text-muted">Composing today&apos;s questions for you…</p>
          </div>
        </header>
        <Card className="sa-rise-2"><CardBody className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}><Skeleton className="h-4 w-2/3 rounded" /><Skeleton className="mt-3 h-2.5 w-full rounded-full" /></div>
          ))}
        </CardBody></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="sa-rise mb-4 flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Today&apos;s check-in</h1>
          <p className="text-muted">A moment to reflect on your day — what you moved forward on, and how you&apos;re doing.</p>
          <p className="mt-0.5 text-xs text-muted">I tune this as I learn you. It only takes a moment.</p>
        </div>
      </header>

      <Card className="sa-rise-2"><CardBody className="space-y-6">
        {dailyDoneToday && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">You&apos;ve already checked in today — adding another just updates today.</p>
        )}

        <div>
          <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink"><Flag className="h-4 w-4 text-orange-500" /> {progressLabel}</p>
          <input value={progress} onChange={(e) => setProgress(e.target.value)}
            placeholder="Even a small step — a task, a workout, a page written, a hard conversation…"
            className="w-full rounded-xl border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none" />
          <p className="mt-1.5 text-xs text-muted">This is the heart of it — whatever you&apos;re working toward. The rest below is just how you&apos;re feeling: one lens, not the point.</p>
        </div>

        {plan ? (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /> {plan.greeting}
            </p>
            {plan.items.map((it, i) => (
              <ItemView key={i} item={it} answer={ans[i]} onChange={(patch) => setItem(i, patch)} />
            ))}
            {plan.closing && <p className="text-sm text-muted">{plan.closing}</p>}
            <Button className="w-full" onClick={() => saveGenerated(plan.items)}>Log today <Check className="h-4 w-4" /></Button>
          </>
        ) : (
          <>
            <Q icon={Moon} label={fq.sleep} value={sleep} setValue={setSleep} labels={SLEEP} />
            <Q icon={Battery} label={fq.energy} value={energy} setValue={setEnergy} labels={ENERGY} />
            <Q icon={Activity} label={fq.stress} value={stress} setValue={setStress} labels={STRESS} />
            <Q icon={Smile} label={fq.mood} value={mood} setValue={setMood} labels={MOOD} />
            <div>
              <button type="button" onClick={() => setHasSymptoms((v) => !v)} aria-pressed={hasSymptoms}
                className="flex w-full items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface">
                <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-navy-500" /> Anything dragging on you today?</span>
                <span className="text-xs text-muted">{hasSymptoms ? "Yes" : "No — tap if so"}</span>
              </button>
              {hasSymptoms && <div className="mt-4"><Q icon={Activity} label="How much did it get in your way?" value={symptoms} setValue={setSymptoms} labels={SYMPTOMS} /></div>}
            </div>
            <div>
              <label htmlFor="life-event" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
                <CalendarDays className="h-4 w-4 text-navy-500" /> {fq.event} <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="life-event" value={lifeEvent} onChange={(e) => setLifeEvent(e.target.value)}
                placeholder="Travel, a big deadline, poor night, good news…"
                className="w-full rounded-xl border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none" />
            </div>
            <Button className="w-full" onClick={saveFallback}>Log today <Check className="h-4 w-4" /></Button>
          </>
        )}
      </CardBody></Card>
    </div>
  );
}

/* ---- Generated item renderers ---- */
function ItemView({ item, answer, onChange }: { item: DailyItemOutput; answer?: { scale?: number; choice?: number; text?: string; chip?: string; reaction?: number }; onChange: (patch: Partial<{ scale: number; choice: number; text: string; chip: string; reaction: number }>) => void }) {
  if (item.type === "scale") {
    const Icon = SCALE_ICON[item.metric] ?? Activity;
    const v = answer?.scale ?? 50;
    return (
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink"><Icon className="h-4 w-4 text-navy-500" /> {item.question}</p>
        <input type="range" min={0} max={100} value={v} onChange={(e) => onChange({ scale: Number(e.target.value) })} className="w-full accent-orange-500" />
        <div className="mt-1 flex items-center justify-between text-xs text-muted"><span>{item.lowLabel}</span><span>{item.highLabel}</span></div>
      </div>
    );
  }
  if (item.type === "choice") {
    return (
      <div className="rounded-xl bg-surface-2 p-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-ink"><Sparkles className="h-4 w-4 shrink-0 text-orange-500" /> {item.question}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {item.options.map((o, oi) => (
            <button key={oi} type="button" onClick={() => onChange({ choice: answer?.choice === oi ? undefined : oi })} aria-pressed={answer?.choice === oi}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", answer?.choice === oi ? "border-orange-500 bg-orange-500/10 text-ink" : "bg-surface text-muted hover:text-ink")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (item.type === "note") {
    return (
      <div className="rounded-xl bg-surface-2 p-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-ink"><HelpCircle className="h-4 w-4 shrink-0 text-orange-500" /> {item.question}</p>
        {item.chips && item.chips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {item.chips.map((c) => (
              <button key={c} type="button" onClick={() => onChange({ chip: answer?.chip === c ? undefined : c, text: "" })} aria-pressed={answer?.chip === c && !answer?.text}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", answer?.chip === c && !answer?.text ? "border-orange-500 bg-orange-500/10 text-ink" : "bg-surface text-muted hover:text-ink")}>
                {c}
              </button>
            ))}
          </div>
        )}
        <input value={answer?.text ?? ""} onChange={(e) => onChange({ text: e.target.value })}
          placeholder="…or answer in your own words"
          className="mt-2.5 w-full rounded-xl border bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:outline-none" />
      </div>
    );
  }
  // reaction game
  return <ReactionGame prompt={item.question} done={answer?.reaction != null} onDone={(score) => onChange({ reaction: score })} />;
}

function ReactionGame({ prompt, done, onDone }: { prompt: string; done: boolean; onDone: (score: number) => void }) {
  const [state, setState] = useState<"idle" | "waiting" | "go" | "tooSoon" | "done">(done ? "done" : "idle");
  const [ms, setMs] = useState<number | null>(null);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function start() {
    setState("waiting");
    timer.current = setTimeout(() => { goAt.current = performance.now(); setState("go"); }, 1000 + Math.random() * 2200);
  }
  function tap() {
    if (state === "waiting") { if (timer.current) clearTimeout(timer.current); setState("tooSoon"); return; }
    if (state === "go") {
      const t = Math.round(performance.now() - goAt.current);
      setMs(t); setState("done"); onDone(reactionScore(t));
    }
  }

  const box: Record<string, { cls: string; label: string }> = {
    idle: { cls: "bg-surface-2 text-muted", label: "Tap to start" },
    waiting: { cls: "bg-navy-900 text-white", label: "Wait for green…" },
    go: { cls: "bg-emerald-500 text-white", label: "TAP!" },
    tooSoon: { cls: "bg-orange-500 text-white", label: "Too soon — tap to retry" },
    done: { cls: "bg-surface-2 text-ink", label: ms != null ? `${ms} ms — nice` : "Done" },
  };
  const b = box[state];

  return (
    <div className="rounded-xl bg-surface-2 p-3.5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink"><Zap className="h-4 w-4 shrink-0 text-orange-500" /> {prompt}</p>
      <p className="mt-0.5 text-xs text-muted">A 5-second reaction game — it tells me something a slider can&apos;t.</p>
      <button type="button"
        onClick={() => (state === "idle" || state === "tooSoon" ? start() : tap())}
        className={cn("mt-2.5 grid h-24 w-full place-items-center rounded-2xl text-base font-semibold transition-colors", b.cls)}>
        {b.label}
      </button>
    </div>
  );
}

function Q({ icon: Icon, label, value, setValue, labels }: { icon: typeof Moon; label: string; value: number; setValue: (n: number) => void; labels: string[] }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-ink"><Icon className="h-4 w-4 text-navy-500" /> {label}</span>
        <span className="text-sm text-muted">{wordFor(labels, value)}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-orange-500" />
    </div>
  );
}

/* ---- One promise before you go: turns the read into a commitment Synapse will hold ---- */
export function CommitmentCapture({ suggestion, towards }: { suggestion: string; towards?: string }) {
  const [text, setText] = useState(suggestion);
  const [committed, setCommitted] = useState<string | null>(null);
  useEffect(() => { setText(suggestion); }, [suggestion]);
  useEffect(() => {
    const t = new Date().toISOString().slice(0, 10);
    const todays = loadCommitments().find((c) => c.status === "open" && c.createdAt.slice(0, 10) === t);
    if (todays) setCommitted(todays.text);
  }, []);
  if (committed) {
    return (
      <Card><CardBody className="flex items-start gap-3">
        <Flag className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        <p className="text-sm text-ink">Locked in: <span className="font-medium">{committed}</span>. It is a promise now, not a plan — I will pick it back up next time we talk.</p>
      </CardBody></Card>
    );
  }
  return (
    <Card><CardBody className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-ink"><Flag className="h-4 w-4 text-orange-500" /> One thing before we go</p>
        <p className="mt-0.5 text-xs text-muted">What is the single step you'll commit to before we next talk? Small enough to actually happen.</p>
        {commitmentHint(readMomentum(loadCommitments())) && <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">{commitmentHint(readMomentum(loadCommitments()))}</p>}
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. email three professors"
        className="w-full rounded-xl border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none" />
      <Button className="w-full" disabled={!text.trim()} onClick={() => { const c = addCommitment(text.trim(), towards); setCommitted(c.text); }}>
        This is my commitment <Check className="h-4 w-4" />
      </Button>
    </CardBody></Card>
  );
}

