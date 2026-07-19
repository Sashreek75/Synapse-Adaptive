"use client";

/**
 * HOME — not a dashboard. The beginning of a conversation with someone who has
 * been paying attention.
 *
 * Founding doc, verbatim intent: "The homepage should feel like opening ChatGPT.
 * Large. Minimal. Elegant. Conversation-first." So Home is: a calm greeting and
 * the ONE thing worth knowing, the single focus for the week (compact), a quietly
 * generated read of what's actually moving — and then the conversation, which is
 * the interface itself. Everything heavier lives in a room you step into.
 */

import { useMemo } from "react";
import Link from "next/link";
import { HeartPulse, Sun, ArrowRight, CheckCircle2 } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { FocusOfWeek } from "@/components/dashboard/focus-of-week";
import { GeneratedDashboard } from "@/components/dashboard/generated-dashboard";
import { FirstWeek } from "@/components/dashboard/first-week";
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
  // shown in place of the engine strips until there's enough data for a real read.
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
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">I&apos;m Synapse. Let&apos;s start understanding you.</h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
            Tell me your name and what you&apos;re focused on — that&apos;s it. Everything else I&apos;ll learn as we talk, and I&apos;ll only ever ask what I genuinely need.
          </p>
        </div>
        <Link href="/onboarding"><Button size="lg">Say hello <HeartPulse className="h-4 w-4" /></Button></Link>
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

      {/* Proactive: it's a new day — lead with the core loop, the check-in */}
      <div className="sa-rise-2 space-y-4">
        {!dailyDoneToday ? (
          <section className="overflow-hidden rounded-3xl border bg-surface shadow-soft">
            <div className="mesh flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400"><Sun className="h-3.5 w-3.5" /> A new day</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Let&apos;s do today&apos;s check-in</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {opener.recommendation?.title ? `A minute now, and I'll fold it into today's thinking — ${opener.recommendation.title.toLowerCase()}.` : "A minute now sharpens everything I notice for you."}
                </p>
              </div>
              <Link href="/daily" className="shrink-0"><Button>Check in <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </section>
        ) : (
          <p className="flex items-center gap-2 px-1 text-sm text-muted"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> You&apos;ve checked in today — I&apos;m folding it into what I know about you.</p>
        )}

        {inFirstWeek ? (
          <FirstWeek />
        ) : (
          <>
            <FocusOfWeek />
            <GeneratedDashboard />
          </>
        )}
      </div>

      {/* The conversation — the interface itself */}
      <section id="conversation" className="sa-rise-3 mt-6 flex-1 scroll-mt-24">
        <AgentConsole immersive />
      </section>
    </div>
  );
}
