"use client";

/**
 * MINIMAL ONBOARDING — two steps, then conversation (founding-doc pivot).
 * The health profile is NOT built here; it emerges naturally over weeks of
 * conversation and check-ins. We only ask what we can't start without:
 * a name, and what to focus on. Everything else, Synapse learns by asking
 * only the next useful question — never a form.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowLeft, HeartPulse, Brain, Dumbbell, Stethoscope,
  Sparkles, Compass, Zap, Flame, Loader2,
} from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { cn } from "@/lib/utils";

const GOALS: { label: string; path: string; icon: typeof Brain }[] = [
  { label: "My recovery after an injury or surgery", path: "recovery_injury", icon: HeartPulse },
  { label: "My recovery from a concussion or neurological condition", path: "recovery_neuro", icon: Brain },
  { label: "A condition my provider asked me to monitor", path: "provider_monitoring", icon: Stethoscope },
  { label: "My cognitive performance (focus, memory, attention)", path: "mental_performance", icon: Sparkles },
  { label: "My athletic readiness and recovery", path: "athlete", icon: Dumbbell },
  { label: "My overall health and wellness", path: "wellness", icon: Compass },
  { label: "My stress and burnout", path: "wellness", icon: Flame },
  { label: "My energy and fatigue", path: "general", icon: Zap },
];

const inputCls = "w-full rounded-xl border bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400";

export function OnboardingFlow() {
  const router = useRouter();
  const { saveProfile } = useHealth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [concerns, setConcerns] = useState("");
  const [finishing, setFinishing] = useState(false);

  const primaryPath = useMemo(() => GOALS.find((x) => goals.includes(x.label))?.path ?? "general", [goals]);
  const pathLabel = useMemo(() => GOALS.find((x) => x.path === primaryPath)?.label ?? "My health", [primaryPath]);
  const TOTAL = 2;

  const toggle = (v: string) => setGoals((g) => (g.includes(v) ? g.filter((x) => x !== v) : [...g, v]));
  const canNext = (step === 0 && name.trim().length > 0) || (step === 1 && goals.length > 0);

  const assembled = () => ({
    displayName: name.trim(),
    path: primaryPath,
    pathLabel,
    goals,
    focusAreas: goals,
    primaryChallenge: concerns.trim(),
    concerns: concerns.trim(),
    recoveryStage: "subacute" as const,
  });

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    // A brief "let me think about what you've told me" — the AI's first read.
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
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="sa-rise mb-5 flex items-center gap-3">
        <SynapseOrb size={44} state={finishing ? "thinking" : "idle"} />
        <div>
          <p className="text-sm font-semibold text-ink">Synapse</p>
          <p className="text-xs text-muted">{finishing ? "Thinking about what you've told me…" : "Two quick things, then we just talk — I'll learn the rest as we go."}</p>
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
            <Shell title="Hi — I'm Synapse." subtitle="I'm here to help you make better everyday health decisions, and I get sharper the longer we work together. What should I call you?">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && canNext && setStep(1)} placeholder="Your first name" className={inputCls} />
            </Shell>
          )}
          {step === 1 && (
            <Shell
              title={`Nice to meet you, ${name.trim() || "friend"}. What matters most right now?`}
              subtitle="Pick what fits — this just tells me where to start looking. Everything else I'll learn by talking with you, not by making you fill out forms."
            >
              <div className="space-y-2">{GOALS.map((g) => { const Icon = g.icon; return (
                <Choice key={g.label} selected={goals.includes(g.label)} onClick={() => toggle(g.label)}>
                  <span className="flex items-center gap-3"><Icon className="h-4 w-4 text-orange-500" /> {g.label}</span>
                </Choice>); })}</div>
              <div>
                <p className="mb-2 mt-1 text-sm font-medium text-ink">Anything on your mind? <span className="font-normal text-muted">(optional — I'll remember it)</span></p>
                <textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={2} placeholder="e.g. I've been exhausted every afternoon and I don't know why." className={cn(inputCls, "resize-none")} />
              </div>
            </Shell>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(0)} className={cn(step === 0 && "invisible")}><ArrowLeft className="h-4 w-4" /> Back</Button>
            {step === 0 ? (
              <Button disabled={!canNext} onClick={() => canNext && setStep(1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button disabled={!canNext || finishing} onClick={finish}>
                {finishing ? <><Loader2 className="h-4 w-4 animate-spin" /> One moment…</> : <>Start talking <ArrowRight className="h-4 w-4" /></>}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-xs text-muted">No long forms. Your profile builds itself from our conversations — you can see it grow under Health profile.</p>
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
