"use client";

import Link from "next/link";
import { Target, TrendingUp, Eye, Activity, Moon, Flag, HelpCircle } from "lucide-react";
import { Card, CardBody, SectionLabel, Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { HealthNarrative } from "@/components/dashboard/health-narrative";
import { UnderstandingEvolution } from "@/components/profile/understanding-evolution";
import { getPath } from "@/lib/paths";

export default function HealthProfilePage() {
  const { hydrated, profile, hasData, weeksTracked, consistency, weeklyScore, recentChanges, focusAreas, lifestyleSummary, mind } = useHealth();
  if (!hydrated) return <Skeleton className="h-64 w-full rounded-2xl" />;

  if (!profile.onboardedAt) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Health Profile</h1>
        <Card className="sa-rise"><CardBody className="py-10 text-center">
          <p className="text-muted">Set up your profile first — it gives Synapse its baseline understanding of you.</p>
          <Link href="/onboarding" className="mt-5 inline-block"><Button>Start onboarding</Button></Link>
        </CardBody></Card>
      </div>
    );
  }

  const improvements = recentChanges.filter((c) => c.improving);
  const daysThisWeek = Math.round(consistency * 7);

  return (
    <div className="space-y-6">
      <header className="sa-rise flex items-center gap-4">
        <SynapseOrb size={52} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your Health Profile</h1>
          <p className="mt-0.5 text-muted">Everything I understand about you — and how that understanding is growing.</p>
        </div>
      </header>

      <HealthNarrative />
      <UnderstandingEvolution />

      {/* Weekly Score */}
      <Card className="sa-rise-2"><CardBody>
        <SectionLabel>{getPath(profile.path).scoreLabel}</SectionLabel>
        <div className="flex items-center gap-5">
          <div className="relative grid h-24 w-24 place-items-center">
            <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ff7a1a" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${weeklyScore} 100`} />
            </svg>
            <span className="absolute text-xl font-semibold text-ink">{weeklyScore}</span>
          </div>
          <div className="text-sm text-muted">
            <p>A blend of how consistently you check in and which trends are heading the right way.</p>
            <p className="mt-1 text-xs">Not a medical score — a gentle progress signal. {daysThisWeek}/7 days active this week.</p>
          </div>
        </div>
      </CardBody></Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="sa-rise-2"><CardBody>
          <SectionLabel className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Goals</SectionLabel>
          {profile.goals.length ? (
            <div className="flex flex-wrap gap-2">{profile.goals.map((g) => (<span key={g} className="rounded-full border bg-surface-2 px-3 py-1 text-sm text-ink">{g}</span>))}</div>
          ) : <p className="text-sm text-muted">—</p>}
          {profile.definitionOfBetter && <p className="mt-3 text-sm text-muted">“{profile.definitionOfBetter}”</p>}
        </CardBody></Card>

        <Card className="sa-rise-2"><CardBody>
          <SectionLabel className="flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" /> Your context</SectionLabel>
          <dl className="space-y-1.5 text-sm">
            {(profile.conditionLabel || profile.conditionDetail) && <Row label="Context" value={(profile.conditionLabel || profile.pathLabel) + (profile.conditionDetail ? ` (${profile.conditionDetail})` : "")} />}
            <Row label="Focus" value={getPath(profile.path).focusNoun} />
            <Row label="Stage" value={profile.recoveryStage} />
            {profile.timeSinceOnset && <Row label="Since" value={profile.timeSinceOnset} />}
            <Row label="Check-ins" value={String(weeksTracked)} />
          </dl>
        </CardBody></Card>

        <Card className="sa-rise-3"><CardBody>
          <SectionLabel className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Recent improvements</SectionLabel>
          {improvements.length ? (
            <ul className="space-y-1.5">{improvements.map((c) => (<li key={c.metric} className="text-sm text-ink">{c.label} <span className="text-emerald-600">↑ {Math.abs(c.deltaNorm)}</span></li>))}</ul>
          ) : <p className="text-sm text-muted">A couple more check-ins and improvements will show here.</p>}
        </CardBody></Card>

        <Card className="sa-rise-3"><CardBody>
          <SectionLabel className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Being monitored</SectionLabel>
          {focusAreas.length ? (
            <div className="flex flex-wrap gap-2">{focusAreas.map((f) => (<span key={f} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">{f}</span>))}</div>
          ) : <p className="text-sm text-muted">Nothing flagged right now.</p>}
          {lifestyleSummary && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Moon className="h-3.5 w-3.5" /> Latest: {lifestyleSummary}</p>}
        </CardBody></Card>
      </div>

      {/* Questions still open — the doc's living-profile section. */}
      {mind.openQuestions.filter((q) => q.status === "open").length > 0 && (
        <Card className="sa-rise-3"><CardBody>
          <SectionLabel className="flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Questions still open</SectionLabel>
          <ul className="space-y-1.5">
            {mind.openQuestions.filter((q) => q.status === "open").map((q) => (
              <li key={q.id} className="text-sm text-ink">{q.question}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">I&apos;m actively working on these through our conversations and small experiments.</p>
        </CardBody></Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/assessments"><Button><Activity className="h-4 w-4" /> Assessment</Button></Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="flex justify-between gap-4 border-b py-1.5 last:border-0"><dt className="text-muted">{label}</dt><dd className="text-right font-medium text-ink">{value}</dd></div>);
}
