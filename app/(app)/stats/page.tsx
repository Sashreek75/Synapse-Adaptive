"use client";

/**
 * PROGRESS — one question, answered honestly: "am I actually getting better?"
 *
 * Nobody opens Synapse because they want charts. They want to know if the work is
 * working. So this page leads with a plain-language verdict drawn from the person's
 * own check-ins, backs it with at most ONE trend worth looking at, and offers to
 * talk it through. No KPI wall, no grid of every metric, no correlation matrix —
 * if a graph doesn't help answer the one question, it isn't here.
 */

import { useMemo } from "react";
import Link from "next/link";
import { Sun, MessageCircle } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { Card, CardBody, Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { signalMeta } from "@/lib/signals";
import { computeTrend } from "@/lib/stats";
import { computeStreak } from "@/lib/intelligence";

export default function StatsPage() {
  const { hydrated, hasData, series, weeksTracked, consistency, checkIns } = useHealth();

  const cards = useMemo(() => series.filter((s) => s.points.length >= 1).map((s) => {
    const meta = signalMeta(s.metric);
    const t = computeTrend(s);
    const improving = meta.direction === "higher_is_better" ? t.delta > 0 : t.delta < 0;
    const flat = Math.abs(t.delta) < 2 || s.points.length < 2;
    return { key: s.metric, meta, latest: Math.round(t.latest), baseline: Math.round(t.baseline), delta: Math.round(t.delta), improving, flat, values: s.points.map((p) => p.valueNorm) };
  }), [series]);

  const featured = useMemo(() => {
    if (!cards.length) return null;
    const bigMove = [...cards].filter((c) => !c.flat).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    return bigMove ?? [...cards].sort((a, b) => b.values.length - a.values.length)[0];
  }, [cards]);

  const streak = useMemo(() => computeStreak(checkIns), [checkIns]);

  const verdict = useMemo(() => {
    const daysActive = Math.round(consistency * 7);
    const improvingCount = cards.filter((c) => !c.flat && c.improving).length;
    const slidingCount = cards.filter((c) => !c.flat && !c.improving).length;
    const net = improvingCount - slidingCount;
    const showUp = `you've shown up ${daysActive}/7 days lately`;
    const streakBit = streak.currentStreak >= 3 ? ` You're on a ${streak.currentStreak}-day streak — that consistency is the real engine.` : "";
    if (checkIns.length < 3) {
      return { head: "Too early to say — but you've started.", detail: `${checkIns.length} check-in${checkIns.length === 1 ? "" : "s"} in. Give it a few more days and I'll have an honest read for you.` };
    }
    if (net > 0) {
      return { head: "Yes — you're trending the right way.", detail: `${improvingCount} of the things I watch ${improvingCount === 1 ? "is" : "are"} improving${slidingCount ? `, ${slidingCount} slipping` : ""}, and ${showUp}.${streakBit}` };
    }
    if (net < 0) {
      return { head: "Honestly? Not this stretch.", detail: `More is sliding than improving right now. That's data, not a verdict — let's talk about the one thing to change.${streakBit}` };
    }
    return { head: "Roughly holding steady.", detail: `Nothing's running away in either direction. Showing up more often (${daysActive}/7 days) is the lever that tips it.${streakBit}` };
  }, [cards, consistency, streak.currentStreak, checkIns.length]);

  if (!hydrated) return <div className="space-y-4"><Skeleton className="h-9 w-48" /><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-48 w-full rounded-2xl" /></div>;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <SynapseOrb size={72} className="mx-auto" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Your progress shows up here</h1>
        <p className="mt-2 leading-relaxed text-muted">Once you&apos;ve done a check-in or two, I&apos;ll give you the honest answer to the only question that matters — am I actually getting better?</p>
        <Link href="/daily" className="mt-6 inline-block"><Button>Start today&apos;s check-in <Sun className="h-4 w-4" /></Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-4">
        <SynapseOrb size={46} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your progress</h1>
          <p className="text-sm text-muted">The honest answer to: am I actually getting better?</p>
        </div>
      </header>

      {/* THE VERDICT — the whole point of the page */}
      <Card className="overflow-hidden"><div className="mesh"><CardBody className="sm:p-7">
        <h2 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">{verdict.head}</h2>
        <p className="mt-2 leading-relaxed text-muted">{verdict.detail}</p>
      </CardBody></div></Card>

      {/* ONE trend worth looking at */}
      {featured && (
        <Card className="overflow-hidden">
          <CardBody>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">What&apos;s moving most</p>
            <h3 className="mt-0.5 text-lg font-semibold text-ink">{featured.meta.label}</h3>
            <div className="mt-3 text-navy-500">
              <TrendChart values={featured.values} baseline={featured.baseline} positive={featured.improving} height={160} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>Latest <b className="text-ink">{featured.latest}</b> · baseline {featured.baseline}</span>
              <span>dotted line = your baseline</span>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="bg-surface/60">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Want me to make sense of this with you — and decide what to change?</p>
          <Link href="/dashboard#conversation"><Button size="sm" variant="outline">Talk it through <MessageCircle className="h-4 w-4" /></Button></Link>
        </CardBody>
      </Card>

      <p className="px-1 text-center text-[11px] text-muted">
        Drawn from your own check-ins across {weeksTracked} {weeksTracked === 1 ? "week" : "weeks"} — signals I reason from, not verdicts.
      </p>
    </div>
  );
}
