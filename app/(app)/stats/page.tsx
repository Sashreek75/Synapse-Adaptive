"use client";

/**
 * YOUR NUMBERS — the visual read, on demand.
 *
 * Synapse leads with understanding, not charts — but you should always be able to
 * SEE your own data when you want to. This is that page: every metric Synapse is
 * tracking, with a plain-language reading and a small trend line. Charts are
 * supporting evidence here, never the headline.
 */

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, Sun, MessageCircle } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { Card, CardBody, Button, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { Sparkline } from "@/components/ui/sparkline";
import { METRIC_META } from "@/lib/metrics";
import { computeTrend } from "@/lib/stats";
import { cn } from "@/lib/utils";

export default function StatsPage() {
  const { hydrated, hasData, series, weeksTracked } = useHealth();

  if (!hydrated) return <div className="space-y-4"><Skeleton className="h-9 w-48" /><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <SynapseOrb size={72} className="mx-auto" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Your numbers live here</h1>
        <p className="mt-2 leading-relaxed text-muted">Once you&apos;ve done a check-in or two, I&apos;ll chart what you&apos;re tracking and tell you plainly what each trend means.</p>
        <Link href="/daily" className="mt-6 inline-block"><Button>Start today&apos;s check-in <Sun className="h-4 w-4" /></Button></Link>
      </div>
    );
  }

  const cards = series
    .filter((s) => s.points.length >= 1)
    .map((s) => {
      const meta = METRIC_META[s.metric];
      const t = computeTrend(s);
      const improving = meta.direction === "higher_is_better" ? t.delta > 0 : t.delta < 0;
      const flat = Math.abs(t.delta) < 2 || s.points.length < 2;
      const values = s.points.map((p) => p.valueNorm);
      return { key: s.metric, meta, latest: Math.round(t.latest), delta: Math.round(t.delta), improving, flat, values };
    });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <SynapseOrb size={48} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your numbers</h1>
          <p className="text-sm text-muted">Everything I&apos;m tracking · {weeksTracked} check-in{weeksTracked === 1 ? "" : "s"} so far</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Arrow = c.flat ? Minus : c.improving ? ArrowUpRight : ArrowDownRight;
          const tone = c.flat ? "text-muted" : c.improving ? "text-emerald-600" : "text-orange-600";
          return (
            <Card key={c.key} className="sa-card-hover">
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.meta.label}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">{c.meta.description}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-0.5 text-sm font-semibold", tone)}>
                    <Arrow className="h-4 w-4" />{c.flat ? "steady" : Math.abs(c.delta)}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <span className="text-3xl font-semibold tracking-tight text-ink">{c.latest}<span className="ml-1 text-sm font-normal text-muted">/100</span></span>
                  <Sparkline values={c.values} positive={c.improving} width={140} height={40} />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="bg-surface/60">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Want me to make sense of these instead of just showing them?</p>
          <Link href="/dashboard#conversation"><Button size="sm" variant="outline">Talk it through <MessageCircle className="h-4 w-4" /></Button></Link>
        </CardBody>
      </Card>

      <p className="px-1 text-center text-[11px] text-muted">Scores are normalized 0–100 from your own check-ins — general wellness signals, not medical measurements.</p>
    </div>
  );
}
