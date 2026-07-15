"use client";

/**
 * PERSONALIZED DAILY CHECK-IN
 * ---------------------------
 * Synapse composes today's questions — for real. On mount we ask
 * /api/daily-plan for a model-authored plan (greeting, personally phrased
 * sliders, one sharp context question) built from THIS user's trends, goals,
 * and recent notes. The plan is cached per-day in localStorage
 * (synapse.dailyplan.<YYYY-MM-DD>) so it stays stable all day and costs zero
 * extra tokens on re-opens. If the model is unavailable or returns something
 * unusable, the original deterministic variant system below takes over — the
 * check-in always works.
 *
 * Store contract (unchanged): addCheckIn with 0-100 metrics
 * (sleep_quality = sleep*20, fatigue = (6-energy)*20 — the energy slider is
 * inverted, stress = stress*20, mood = mood*20, symptoms optional *20),
 * addContextNote for the context question + life event.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Battery, Activity, Check, Smile, Stethoscope, CalendarDays, Sparkles } from "lucide-react";
import { Card, CardBody, Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { goalMetricsForPath } from "@/lib/paths";
import { dailyReflection, type DailyReflection } from "@/lib/intelligence";
import { cn } from "@/lib/utils";
import type { MetricKey, MetricSeries } from "@/types";

/** Map a 0-100 value to its nearest anchor word for a 5-word scale. */
const wordFor = (labels: string[], v: number) => labels[Math.min(labels.length - 1, Math.floor((v / 100) * labels.length))];

/** Append today's just-entered values to the existing series (for instant reflection). */
function seriesWithToday(series: MetricSeries[], metrics: Partial<Record<MetricKey, number>>, date: string): MetricSeries[] {
  const map = new Map<MetricKey, MetricSeries>(series.map((s) => [s.metric, { metric: s.metric, points: [...s.points] }]));
  for (const [m, v] of Object.entries(metrics) as [MetricKey, number][]) {
    if (v == null) continue;
    if (!map.has(m)) map.set(m, { metric: m, points: [] });
    map.get(m)!.points.push({ metric: m, valueNorm: v, recordedAt: date });
  }
  return [...map.values()];
}

const SLEEP = ["Rough", "Light", "Okay", "Good", "Great"];
const ENERGY = ["Drained", "Low", "Okay", "Good", "Strong"];
const STRESS = ["Calm", "Low", "Moderate", "High", "Very high"];
const MOOD = ["Low", "Flat", "Okay", "Good", "Great"];
const SYMPTOMS = ["Barely", "A little", "Somewhat", "Quite a bit", "A lot"];

/* ---- Deterministic fallback: phrasing varies by day so check-ins never feel canned. ---- */
const SLEEP_Q = ["How did you sleep?", "Was last night restorative?", "How rested do you feel this morning?", "How was your night?"];
const ENERGY_Q = ["Energy right now?", "How much is in the tank today?", "How charged do you feel right now?", "Where's your energy sitting today?"];
const STRESS_Q = ["Stress level?", "How much pressure are you carrying today?", "How wound up do you feel right now?", "How heavy is today feeling?"];
const MOOD_Q = ["Mood today?", "How's your headspace today?", "Where's your mood sitting?", "How are you feeling, honestly?"];
const SYMPTOM_Q = ["Any symptoms today?", "Anything bothering you physically today?", "Anything flaring up today?"];
const EVENT_Q = ["Anything notable happen today?", "Anything I should know about today?", "Did today throw anything at you?"];

/** Deterministic day seed — same questions all day, fresh ones tomorrow. */
function daySeed(): number {
  const s = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const variant = <T,>(xs: T[], seed: number, salt: number): T => xs[(seed + salt) % xs.length];

/* ---- Fallback adaptive question Synapse picks from the user's data. ---- */
interface AdaptiveQ { prompt: string; chips: string[]; }

const GENERAL_ADAPTIVE: AdaptiveQ[] = [
  { prompt: "What helped you feel most like yourself lately?", chips: ["Movement", "Rest", "People", "Getting outside", "Not sure"] },
  { prompt: "What's been taking most of your attention this week?", chips: ["Work/school", "Family", "Health", "Everything at once", "Not much"] },
  { prompt: "If tomorrow went well, what would make the difference?", chips: ["Better sleep", "Less stress", "More energy", "A win at work", "Not sure"] },
];

function adaptiveFor(dips: Set<MetricKey>, goals: Set<MetricKey>, seed: number): AdaptiveQ {
  // Active dips outrank standing goals — I ask about what's actually moving.
  for (const watched of [dips, goals]) {
    if (watched.has("fatigue")) return { prompt: "What's been draining you most lately?", chips: ["Work/school", "Poor sleep", "Training", "Emotions", "Not sure"] };
    if (watched.has("stress")) return { prompt: "Where's most of the pressure coming from right now?", chips: ["Work/school", "Family", "Health worries", "Money", "Not sure"] };
    if (watched.has("sleep_quality")) return { prompt: "What's getting in the way of your sleep most?", chips: ["Late screens", "Stress", "An irregular schedule", "Discomfort", "Not sure"] };
  }
  return variant(GENERAL_ADAPTIVE, seed, 11);
}

/* ---- Synapse-authored plan (from /api/daily-plan) ---- */
type SliderMetric = "sleep_quality" | "fatigue" | "stress" | "mood" | "symptoms";

interface PlanSlider { metric: SliderMetric; question: string; lowLabel: string; highLabel: string; }
interface DailyPlan { greeting: string; sliders: PlanSlider[]; contextQuestion: { prompt: string; chips: string[] }; }

const SLIDER_ICONS: Record<SliderMetric, typeof Moon> = {
  sleep_quality: Moon, fatigue: Battery, stress: Activity, mood: Smile, symptoms: Stethoscope,
};

const SLIDER_METRICS = new Set<string>(["sleep_quality", "fatigue", "stress", "mood", "symptoms"]);

/** Client-side sanity check — the route validates, but the cache could be stale/corrupt. */
function isValidPlan(p: unknown): p is DailyPlan {
  if (!p || typeof p !== "object") return false;
  const plan = p as DailyPlan;
  if (typeof plan.greeting !== "string" || !plan.greeting) return false;
  if (!Array.isArray(plan.sliders) || plan.sliders.length < 3) return false;
  const metrics = new Set<string>();
  for (const s of plan.sliders) {
    if (!s || !SLIDER_METRICS.has(s.metric) || metrics.has(s.metric)) return false;
    if (![s.question, s.lowLabel, s.highLabel].every((t) => typeof t === "string" && t)) return false;
    metrics.add(s.metric);
  }
  if (!metrics.has("sleep_quality") || !metrics.has("fatigue")) return false;
  const cq = plan.contextQuestion;
  if (!cq || typeof cq.prompt !== "string" || !cq.prompt) return false;
  if (!Array.isArray(cq.chips) || cq.chips.length < 3 || !cq.chips.every((c) => typeof c === "string" && c)) return false;
  return true;
}

/** 20-second daily check-in, composed fresh by Synapse each day. */
export function DailyCheckIn() {
  const router = useRouter();
  const { dailyDoneToday, addCheckIn, addContextNote, recentChanges, contextNotes, profile, series } = useHealth();

  // Synapse's plan for today: undefined = loading, null = use deterministic fallback.
  const [plan, setPlan] = useState<DailyPlan | null | undefined>(undefined);
  const [vals, setVals] = useState<Record<string, number>>({});

  // Fallback slider state (0-100 so people can express nuance, not 5 notches).
  const [sleep, setSleep] = useState(50);
  const [energy, setEnergy] = useState(50);
  const [stress, setStress] = useState(50);
  const [mood, setMood] = useState(50);

  const [hasSymptoms, setHasSymptoms] = useState(false);
  const [symptoms, setSymptoms] = useState(40);
  const [lifeEvent, setLifeEvent] = useState("");
  const [adaptiveAnswer, setAdaptiveAnswer] = useState("");
  const [customAnswer, setCustomAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  const [reflection, setReflection] = useState<DailyReflection | null>(null);

  const seed = useMemo(daySeed, []);
  const q = useMemo(() => ({
    sleep: variant(SLEEP_Q, seed, 0),
    energy: variant(ENERGY_Q, seed, 1),
    stress: variant(STRESS_Q, seed, 2),
    mood: variant(MOOD_Q, seed, 3),
    symptomsToggle: variant(SYMPTOM_Q, seed, 5),
    event: variant(EVENT_Q, seed, 7),
  }), [seed]);

  const adaptive = useMemo(() => {
    const dips = new Set<MetricKey>(recentChanges.filter((c) => !c.improving).map((c) => c.metric));
    const goals = new Set<MetricKey>(goalMetricsForPath(profile.path));
    return adaptiveFor(dips, goals, seed);
  }, [recentChanges, profile.path, seed]);

  // Fetch (or restore) Synapse's plan for today — stable all day, no token burn on re-opens.
  useEffect(() => {
    const key = `synapse.dailyplan.${new Date().toISOString().slice(0, 10)}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (isValidPlan(cached)) { setPlan(cached); return; }
    } catch {}
    let active = true;
    fetch("/api/daily-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: profile.path,
        pathLabel: profile.pathLabel,
        goals: profile.goals,
        trends: recentChanges.map((c) => ({ metric: c.metric, label: c.label, improving: c.improving, delta: c.deltaNorm })),
        notes: contextNotes.slice(-3).map((n) => ({ prompt: n.prompt, answer: n.answer })),
        dayOfWeek: new Date().toLocaleDateString(undefined, { weekday: "long" }),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (isValidPlan(d?.plan)) {
          setPlan(d.plan);
          try { localStorage.setItem(key, JSON.stringify(d.plan)); } catch {}
        } else {
          setPlan(null); // deterministic fallback
        }
      })
      .catch(() => { if (active) setPlan(null); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The symptoms toggle stays as-is, so a model "symptoms" slider isn't rendered twice.
  const planSliders = useMemo(() => (plan ? plan.sliders.filter((s) => s.metric !== "symptoms") : []), [plan]);

  function save() {
    const date = new Date().toISOString();
    let metrics: Partial<Record<MetricKey, number>>;
    if (plan) {
      metrics = {};
      for (const s of planSliders) {
        const v = vals[s.metric] ?? 50;
        // The fatigue slider asks about ENERGY (0-100), so invert into fatigue.
        metrics[s.metric] = s.metric === "fatigue" ? 100 - v : v;
      }
    } else {
      metrics = { sleep_quality: sleep, fatigue: 100 - energy, stress, mood };
    }
    if (hasSymptoms) metrics.symptoms = symptoms;
    addCheckIn({ date, kind: "daily", metrics, note: "Daily check-in" });
    const answer = customAnswer.trim() || adaptiveAnswer;
    if (answer) addContextNote(plan ? plan.contextQuestion.prompt : adaptive.prompt, answer);
    if (lifeEvent.trim()) addContextNote(q.event, lifeEvent.trim());
    // Instant, specific reflection — computed from the data including today.
    try { setReflection(dailyReflection(seriesWithToday(series, metrics, date), profile.path)); } catch { setReflection(null); }
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="sa-rise overflow-hidden"><div className="mesh"><CardBody className="py-8">
          <div className="flex items-center gap-3">
            <SynapseOrb size={40} className="shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Here&apos;s what I noticed just now</h2>
              <p className="text-xs text-muted">A quick read on today — I put it together from your own data.</p>
            </div>
          </div>
          {reflection ? (
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
              <p>{reflection.lead}</p>
              {reflection.points.map((p, i) => (
                <p key={i} className="rounded-xl bg-surface-2 p-3">{p}</p>
              ))}
              {reflection.action && (
                <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-ink dark:border-orange-500/20 dark:bg-orange-500/10">
                  <span className="font-semibold text-orange-700 dark:text-orange-300">Try this: </span>{reflection.action}
                </p>
              )}
              {reflection.watch && <p className="text-muted">{reflection.watch}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Logged — thank you. A couple more check-ins and I&apos;ll start connecting the dots for you.</p>
          )}
        </CardBody></div></Card>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => router.push("/dashboard")}>Go to dashboard <Check className="h-4 w-4" /></Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push("/dashboard#conversation")}>Talk this through</Button>
        </div>
      </div>
    );
  }

  // Synapse is composing today's plan.
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
            <div key={i}>
              <Skeleton className="h-4 w-2/3 rounded" />
              <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
            </div>
          ))}
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardBody></Card>
      </div>
    );
  }

  const contextPrompt = plan ? plan.contextQuestion.prompt : adaptive.prompt;
  const contextChips = plan ? plan.contextQuestion.chips : adaptive.chips;

  return (
    <div className="mx-auto max-w-md">
      <header className="sa-rise mb-4 flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Today&apos;s check-in</h1>
          <p className="text-muted">I put today&apos;s questions together for you — 20 seconds.</p>
          <p className="mt-0.5 text-xs text-muted">Different day, different questions — I tune these as I learn you.</p>
        </div>
      </header>

      <Card className="sa-rise-2"><CardBody className="space-y-6">
        {plan && (
          <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /> {plan.greeting}
          </p>
        )}
        {dailyDoneToday && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">You&apos;ve already checked in today — adding another is totally fine, it&apos;ll just update today.</p>
        )}

        {plan ? (
          planSliders.map((s) => (
            <PlanQ
              key={s.metric}
              icon={SLIDER_ICONS[s.metric]}
              question={s.question}
              low={s.lowLabel}
              high={s.highLabel}
              value={vals[s.metric] ?? 50}
              setValue={(n) => setVals((cur) => ({ ...cur, [s.metric]: n }))}
            />
          ))
        ) : (
          <>
            <Q icon={Moon} label={q.sleep} value={sleep} setValue={setSleep} labels={SLEEP} />
            <Q icon={Battery} label={q.energy} value={energy} setValue={setEnergy} labels={ENERGY} />
            <Q icon={Activity} label={q.stress} value={stress} setValue={setStress} labels={STRESS} />
            <Q icon={Smile} label={q.mood} value={mood} setValue={setMood} labels={MOOD} />
          </>
        )}

        <div>
          <button
            type="button"
            onClick={() => setHasSymptoms((v) => !v)}
            aria-pressed={hasSymptoms}
            className="flex w-full items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            <span className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-navy-500" /> {q.symptomsToggle}</span>
            <span className="text-xs text-muted">{hasSymptoms ? "Yes" : "No — tap if so"}</span>
          </button>
          {hasSymptoms && (
            <div className="mt-4">
              <Q icon={Stethoscope} label="How much did they interfere?" value={symptoms} setValue={setSymptoms} labels={SYMPTOMS} />
            </div>
          )}
        </div>

        {/* Synapse's one context question — model-authored when live, adaptive fallback otherwise. */}
        <div className="rounded-xl bg-surface-2 p-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Sparkles className="h-4 w-4 shrink-0 text-orange-500" /> {contextPrompt}
          </p>
          <p className="mt-0.5 text-xs text-muted">I picked this one from what I&apos;ve been seeing in your data — optional.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {contextChips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setAdaptiveAnswer((cur) => (cur === c ? "" : c)); setCustomAnswer(""); }}
                aria-pressed={adaptiveAnswer === c && !customAnswer}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  adaptiveAnswer === c && !customAnswer
                    ? "border-orange-500 bg-orange-500/10 text-ink"
                    : "bg-surface text-muted hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="…or answer in your own words"
            className="mt-2.5 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="life-event" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
            <CalendarDays className="h-4 w-4 text-navy-500" /> {q.event} <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="life-event"
            value={lifeEvent}
            onChange={(e) => setLifeEvent(e.target.value)}
            placeholder="Travel, a big deadline, poor night, good news…"
            className="w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">I&apos;ll remember this as context when I read your trends.</p>
        </div>

        <Button className="w-full" onClick={save}>Log today <Check className="h-4 w-4" /></Button>
      </CardBody></Card>
    </div>
  );
}

/** Fallback slider (0-100 so people can express nuance, not 5 notches). */
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

/** Synapse-authored slider — the model wrote the question and both end labels. */
function PlanQ({ icon: Icon, question, low, high, value, setValue }: { icon: typeof Moon; question: string; low: string; high: string; value: number; setValue: (n: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink"><Icon className="h-4 w-4 text-navy-500" /> {question}</p>
      <input type="range" min={0} max={100} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-orange-500" />
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}