"use client";

/**
 * HOME — not a dashboard. The beginning of a conversation with someone who has
 * been paying attention.
 *
 * It answers three things and nothing else:
 *   1. What am I working toward?            → the lead goal + its one next action (GoalsStrip)
 *   2. What's the one thing worth my energy? → the hero line + that next action
 *   3. Anything I should hear before I begin? → at most one quiet card (an open promise,
 *      a real win, or drift) via CommitmentPrompt, which hides itself when there's nothing.
 *
 * Everything heavier — charts, the weekly focus write-up, what Synapse has learned —
 * lives in a room you choose to step into. The conversation is the interface itself.
 */

import { useMemo } from "react";
import Link from "next/link";
import { Sun, ArrowRight } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { FocusOfWeek } from "@/components/dashboard/focus-of-week";
import { FirstWeek } from "@/components/dashboard/first-week";
import { CommitmentPrompt } from "@/components/dashboard/commitment-prompt";
import { GoalsStrip } from "@/components/goals/goals-strip";
import { AgentConsole } from "@/components/agent/agent-console";
import { sessionOpener } from "@/lib/intelligence";
import { copy } from "@/lib/copy";

export default function HomePage() {
  const { hydrated, profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked, hasData } = useHealth();

  const opener = useMemo(
    () => sessionOpener(profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked),
    [profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked],
  );

  // The first seven days are their own experience — an unfolding investigation —
  // shown in place of the goal strip until there's enough of a picture.
  const distinctDays = useMemo(() => new Set(checkIns.map((c) => c.date.slice(0, 10))).size, [checkIns]);
  const inFirstWeek = !!profile.onboardedAt && distinctDays < 7;

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-4 pt-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-16 w-full rounded-3xl" />
      </div>
    );
  }

  const name = profile.displayName || "there";

  // Cold start — Synapse introduces itself and earns the first hello.
  if (!hasData && !profile.onboardedAt) {
    return (
      <div className="flex min-h-[calc(100dvh-11rem)] flex-col items-center justify-center gap-6 text-center">
        <SynapseOrb size={112} />
        <div>
          <p className="text-sm text-muted">{copy.greeting(name)}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">I&apos;m Synapse. Let&apos;s make real progress — starting today.</h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
            Tell me your name and what you&apos;re focused on — that&apos;s it. Everything else I&apos;ll learn as we talk, and I&apos;ll only ever ask what I genuinely need.
          </p>
        </div>
        <Link href="/onboarding"><Button size="lg">Say hello <ArrowRight className="h-4 w-4" /></Button></Link>
      </div>
    );
  }

  // The single most meaningful thing right now — one line, no wall of cards.
  const oneInsight = opener.highlights.find((h) => h.tone !== "neutral") ?? opener.highlights[0];

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      {/* Greeting + the one thing worth knowing */}
      <section className="sa-rise flex flex-col items-center gap-3 pb-5 pt-1 text-center sm:gap-4 sm:pb-6 sm:pt-4">
        <SynapseOrb size={64} className="sm:hidden" />
        <SynapseOrb size={78} className="hidden sm:block" />
        <div>
          <p className="text-sm text-muted">{copy.greeting(name)}</p>
          <h1 className="mt-1 text-[21px] font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{opener.lead}</h1>
          {oneInsight && <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-muted">{oneInsight.text}</p>}
        </div>
      </section>

      <div className="sa-rise-2 space-y-4">
        {inFirstWeek ? (
          <FirstWeek />
        ) : (
          <>
            {/* 1 + 2: what you're working toward and the one next action */}
            <GoalsStrip />
            {/* 3: the one thing to hear before you begin — hides itself when there's nothing */}
            <CommitmentPrompt />
          </>
        )}

        {/* A quiet nudge, not a competing card */}
        {!dailyDoneToday && (
          <Link href="/daily" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-surface/60 px-4 py-3 text-sm transition hover:bg-surface-2">
            <span className="flex items-center gap-2 text-muted"><Sun className="h-4 w-4 text-orange-500" /> A minute on today&apos;s snapshot sharpens everything I notice for you.</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        )}

        {/* Mounted only to keep the weekly-reasoning engine warm — renders nothing. */}
        <FocusOfWeek silent />
      </div>

      {/* The conversation — the interface itself */}
      <section id="conversation" className="sa-rise-3 mt-6 flex-1 scroll-mt-24">
        <AgentConsole immersive />
      </section>
    </div>
  );
}
