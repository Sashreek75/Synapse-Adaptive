"use client";

/**
 * ONBOARDING — the start of a relationship, built around the PERSON (not a health
 * condition). We capture just enough to personalize from day one: who they want to
 * become, the areas of life they're working on, and how they want Synapse to show
 * up. Health is one focus area among many. Everything deeper Synapse learns by
 * talking, not by forms. Under the hood a "path" is derived from the primary focus
 * area so the (frozen) engine still has a lens — but the user never sees that.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowLeft, Briefcase, GraduationCap, Target, Dumbbell,
  Repeat, Flame, HeartPulse, Compass, Sparkles, Loader2,
} from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { cn } from "@/lib/utils";

/** Life domains → the engine "path" (lens) each maps to. The label is person-first;
 * the path only tells the frozen engine which signals to emphasize. */
const AREAS: { label: string; path: string; icon: typeof Target }[] = [
  { label: "Work & career", path: "general", icon: Briefcase },
  { label: "Studying & learning", path: "mental_performance", icon: GraduationCap },
  { label: "Focus & productivity", path: "mental_performance", icon: Target },
  { label: "Fitness & training", path: "athlete", icon: Dumbbell },
  { label: "Building better habits", path: "general", icon: Repeat },
  { label: "Stress & wellbeing", path: "wellness", icon: Flame },
  { label: "Health & wellbeing", path: "wellness", icon: HeartPulse },
  { label: "Personal growth", path: "general", icon: Compass },
];

const STYLES = ["Gentle & encouraging", "Direct & challenging", "A balance of both"];
const ACCOUNTABILITY = ["Check in on me and keep me accountable", "Mostly stay quiet until I ask"];

const inputCls = "w-full rounded-xl border bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400";
const TOTAL = 3;

export function OnboardingFlow() {
  const router = useRouter();
  const { saveProfile, saveMind, mind } = useHealth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [aspiration, setAspiration] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [style, setStyle] = useState("");
  const [accountability, setAccountability] = useState("");
  const [finishing, setFinishing] = useState(false);

  const primary = useMemo(() => AREAS.find((a) => areas.includes(a.label)), [areas]);
  const primaryPath = primary?.path ?? "general";
  const pathLabel = primary?.label ?? "Personal growth";

  const toggle = (v: string) => setAreas((g) => (g.includes(v) ? g.filter((x) => x !== v) : [...g, v]));
  const canNext =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && areas.length > 0) ||
    (step === 2 && style.length > 0);

  const assembled = () => ({
    displayName: name.trim(),
    path: primaryPath,
    pathLabel,
    goals: areas,
    focusAreas: areas,
    definitionOfBetter: aspiration.trim(),
    primaryChallenge: aspiration.trim(),
    aiPreferences: [style, accountability].filter(Boolean),
    recoveryStage: "subacute" as const,
  });

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    let aiSummary = "";
    try {
      const res = await fetch("/api/profile-summary", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: assembled() }),
      });
      const d = await res.json();
      if (d.summary) aiSummary = d.summary;
    } catch {}
    saveProfile({ ...assembled(), aiSummary, onboardedAt: new Date().toISOString() });
    // Trajectory is first-class: who they're working to become is the objective the
    // engine steers toward. Seed it from the aspiration (or their primary focus).
    const statement = aspiration.trim() || `make progress on ${pathLabel.toLowerCase()}`;
    saveMind({ ...mind, trajectory: { statement, horizon: "months", updatedAt: new Date().toISOString() } });
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="sa-rise mb-5 flex items-center gap-3">
        <SynapseOrb size={44} state={finishing ? "thinking" : "idle"} />
        <div>
          <p className="text-sm font-semibold text-ink">Synapse</p>
          <p className="text-xs text-muted">{finishing ? "Thinking about what you've told me…" : "A few quick things, then we just talk — I'll learn the rest as we go."}</p>
        </div>
      </div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
        <span>Getting started</span>
        <span>Step {step + 1} of {TOTAL}</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
      </div>

      <Card key={step} className="sa-rise">
        <CardBody>
          {step === 0 && (
            <Shell title="Hi — I'm Synapse." subtitle="I'm here to help you become who you're working to become, and I get sharper the longer we work together. What should I call you?">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && canNext && setStep(1)} placeholder="Your first name" className={inputCls} />
            </Shell>
          )}

          {step === 1 && (
            <Shell
              title={`Nice to meet you, ${name.trim() || "friend"}. What are you working toward?`}
              subtitle="Pick the areas you want to make progress in — this just tells me where to start. I'll learn the specifics as we talk."
            >
              <div>
                <textarea value={aspiration} onChange={(e) => setAspiration(e.target.value)} rows={2}
                  placeholder="In your words: who do you want to become, or what are you working toward? (optional)"
                  className={cn(inputCls, "resize-none")} />
              </div>
              <div className="space-y-2">
                {AREAS.map((a) => { const Icon = a.icon; return (
                  <Choice key={a.label} selected={areas.includes(a.label)} onClick={() => toggle(a.label)}>
                    <span className="flex items-center gap-3"><Icon className="h-4 w-4 text-orange-500" /> {a.label}</span>
                  </Choice>); })}
              </div>
            </Shell>
          )}

          {step === 2 && (
            <Shell
              title="How should I show up for you?"
              subtitle="You can change this any time just by telling me. It shapes how I coach, not what I notice."
            >
              <div>
                <p className="mb-2 text-sm font-medium text-ink">When I have something to say, be…</p>
                <div className="space-y-2">
                  {STYLES.map((s) => (
                    <Choice key={s} selected={style === s} onClick={() => setStyle(s)}>{s}</Choice>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Day to day, I should…</p>
                <div className="space-y-2">
                  {ACCOUNTABILITY.map((a) => (
                    <Choice key={a} selected={accountability === a} onClick={() => setAccountability(a)}>{a}</Choice>
                  ))}
                </div>
              </div>
            </Shell>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} className={cn(step === 0 && "invisible")}><ArrowLeft className="h-4 w-4" /> Back</Button>
            {step < TOTAL - 1 ? (
              <Button disabled={!canNext} onClick={() => canNext && setStep((s) => s + 1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button disabled={!canNext || finishing} onClick={finish}>
                {finishing ? <><Loader2 className="h-4 w-4 animate-spin" /> One moment…</> : <>Start talking <Sparkles className="h-4 w-4" /></>}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-xs text-muted">No long forms. Your profile builds itself as we talk — you can watch it grow under You.</p>
    </div>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("w-full rounded-xl border px-4 py-3 text-left text-ink transition-all", selected ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" : "bg-surface hover:bg-surface-2")}>{children}</button>;
}
