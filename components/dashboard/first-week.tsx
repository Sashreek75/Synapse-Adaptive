"use client";

/**
 * THE FIRST WEEK — an unfolding investigation, not a waiting room.
 *
 * A zero-history user should feel value on Day 1 and curiosity strong enough to
 * return on Day 2, WITHOUT Synapse pretending to know things it hasn't learned.
 * This surface makes the learning process itself visible and honest: what I know
 * so far (only what you told me + the days you've logged), what I'm still learning,
 * and exactly what the next check-in unlocks. It retires on its own once there's
 * enough data (7 distinct check-in days) and the real engine takes over.
 *
 * No new intelligence: reads only counts, dates, and the metrics you've logged.
 */

import { useMemo } from "react";
import Link from "next/link";
import { Compass, Check, ArrowRight, Sparkles, Lock } from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { metricLabel } from "@/lib/metrics";
import { getPath } from "@/lib/paths";
import type { MetricSeries } from "@/types";

const TARGET_DAYS = 7;

function humanList(items: string[]): string {
  const xs = items.filter(Boolean);
  if (!xs.length) return "your check-ins";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
}

/** The two things they've logged most — used to make the "next unlock" personal. */
function leadPair(series: MetricSeries[]): string[] {
  return [...series]
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 2)
    .map((s) => metricLabel(s.metric).toLowerCase());
}

function stageFor(
  days: number,
  ctx: { logged: string; pair: string[]; remaining: number },
): { title: string; body: string; hook: string } {
  const { logged, pair, remaining } = ctx;
  const remainWord = `${remaining} more check-in${remaining === 1 ? "" : "s"}`;

  if (days <= 0) return {
    title: "Let's begin the investigation.",
    body: "I don't know anything about you yet — and I won't pretend to. Your very first check-in is the first thing I'll ever learn about you.",
    hook: "The moment you check in, I'll reflect today back to you — and start looking for your patterns.",
  };
  if (days === 1) return {
    title: "Day one is in.",
    body: "That's a single data point — a dot, not a pattern yet. One more check-in gives me a second, and I can start to see how you move.",
    hook: "Your next check-in unlocks my first real comparison.",
  };
  if (days <= 3) return {
    title: "A picture is starting to form.",
    body: pair.length >= 2
      ? `I'm holding your ${logged} side by side. Too early to trust anything — but I'm watching how they move with each other.`
      : "I'm gathering your first few days. Too early to trust a pattern — I'm just watching for now.",
    hook: "A few more days and I can tell a real signal from an off day.",
  };
  // days 4-6 — name the specific discovery that's almost in reach
  return {
    title: "Signals are starting to show.",
    body: `I'm being careful not to over-read ${days} days of data — but I'm close.`,
    hook: pair.length >= 2
      ? `Soon I'll be able to say whether your ${pair[0]} and ${pair[1]} really move together — ${remainWord} to go.`
      : `${remainWord} and I'll have enough for my first genuine read on you.`,
  };
}

export function FirstWeek() {
  const { profile, checkIns, series, dailyDoneToday } = useHealth();

  const distinctDays = useMemo(
    () => new Set(checkIns.map((c) => c.date.slice(0, 10))).size,
    [checkIns],
  );

  if (!profile.onboardedAt || distinctDays >= TARGET_DAYS) return null;

  const focusNoun = getPath(profile.path).focusNoun;
  const pair = leadPair(series);
  const logged = humanList(series.map((s) => metricLabel(s.metric).toLowerCase()).slice(0, 3));
  const remaining = TARGET_DAYS - distinctDays;
  const stage = stageFor(distinctDays, { logged, pair, remaining });

  const known: string[] = [
    profile.displayName ? `Your name — ${profile.displayName}` : "A little about your goals",
    profile.goals[0] ? `You're focused on ${profile.goals[0].toLowerCase()}` : `You care about your ${focusNoun}`,
    distinctDays > 0 ? `${distinctDays} day${distinctDays === 1 ? "" : "s"} of check-ins` : "That we're just getting started",
  ];
  const learning = [
    "Your daily rhythm — when you're at your best",
    "What lifts you and what quietly drains you",
    "How you work best, and what gets in the way",
  ];

  return (
    <Card className="overflow-hidden">
      <div className="mesh">
        <CardBody className="space-y-5 p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <SynapseOrb size={38} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  <Compass className="h-3.5 w-3.5" /> Getting to know you
                </p>
                <span className="text-[11px] font-medium text-muted">{distinctDays}/{TARGET_DAYS} check-ins</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold leading-tight text-ink">{stage.title}</h2>
            </div>
          </div>

          {/* Progress — filled so far, the next segment "primed", the rest waiting */}
          <div>
            <div className="flex items-center gap-1.5" aria-label={`${distinctDays} of ${TARGET_DAYS} check-in days`}>
              {Array.from({ length: TARGET_DAYS }).map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-2 flex-1 rounded-full transition-colors " +
                    (i < distinctDays
                      ? "bg-orange-500"
                      : i === distinctDays
                      ? "bg-orange-500/30"
                      : "bg-line/70 dark:bg-white/10")
                  }
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">I only trust a pattern once I&apos;ve watched it hold — that&apos;s why this takes a few days, not seconds.</p>
          </div>

          <p className="text-[15px] leading-relaxed text-ink/90">{stage.body}</p>

          {/* What I know vs what I'm still learning — the honesty at the heart of it */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-surface/70 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" /> What I know so far
              </p>
              <ul className="space-y-1.5">
                {known.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />{k}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-surface/70 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Lock className="h-3.5 w-3.5" /> Still learning
              </p>
              <ul className="space-y-1.5">
                {learning.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-navy-300" />{k}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* The next unlock — the reason to come back */}
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-ink">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              {dailyDoneToday ? <span>Today&apos;s in. {stage.hook}</span> : <span>{stage.hook}</span>}
            </p>
            {!dailyDoneToday && (
              <Link href="/daily" className="shrink-0">
                <Button size="sm" className="w-full sm:w-auto">Check in now <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            )}
          </div>
        </CardBody>
      </div>
    </Card>
  );
}
