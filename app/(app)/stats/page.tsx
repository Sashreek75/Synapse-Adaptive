"use client";

/**
 * YOUR NUMBERS — a real dashboard, on demand.
 *
 * Synapse leads with understanding in conversation, but you should always be able
 * to SEE your data. This is a proper dashboard: headline KPIs, a featured trend,
 * every tracked metric charted with its baseline, and — the part no spreadsheet
 * gives you — the connections Synapse found between them. Charts support the plain
 * reading; they never replace it.
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, Sun, MessageCircle, Flame, CalendarCheck, Gauge, ClipboardList, Link2 } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { Card, CardBody, Button, Skeleton, ConfidenceChip } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { METRIC_META } from "@/lib/metrics";
import { computeTrend } from "@/lib/stats";
import { computeStreak } from "@/lib/intelligence";
import { computeAssociations } from "@/lib/correlations";
import { goalMetricsForPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

export default function StatsPage() {
  const { hydrated, hasData, series, recentChanges, weeksTracked, weeklyScore, consistency, checkIns, profile } = useHealth();

  const cards = useMemo(() => series.filter((s) => s.points.length >= 1).map((s) => {
    const meta = METRIC_META[s.metric];
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

  const connections = useMemo(
    () => (hasData ? computeAssociations(series, goalMetricsForPath(profile.path), 4) : []),
    [hasData, series, profile.path],
  );

  const streak = useMemo(() => computeStreak(checkIns), [checkIns]);

  if (!hydrated) return <div className="space-y-4"><Skeleton className="h-9 w-48" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-48 w-full rounded-2xl" /></div>;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <SynapseOrb size={72} className="mx-auto" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Your numbers live here</h1>
        <p className="mt-2 leading-relaxed text-muted">Once you&apos;ve done a check-in or two, I&apos;ll chart everything you&apos;re tracking and show you the connections between them.</p>
        <Link href="/daily" className="mt-6 inline-block"><Button>Start today&apos;s check-in <Sun className="h-4 w-4" /></Button></Link>
      </div>
    );
  }

  const daysActive = Math.round(consistency * 7);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <SynapseOrb size={46} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your numbers</h1>
          <p className="text-sm text-muted">A live read of everything I&apos;m tracking</p>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={Gauge} label="Weekly score" value={`${weeklyScore}`} suffix="/100" tone="orange" />
        <Kpi icon={CalendarCheck} label="Active this week" value={`${daysActive}`} suffix="/7 days" tone="navy" />
        <Kpi icon={Flame} label="Current streak" value={`${streak.currentStreak}`} suffix={streak.currentStreak === 1 ? "day" : "days"} tone="orange" />
        <Kpi icon={ClipboardList} label="Check-ins" value={`${checkIns.length}`} suffix="logged" tone="navy" />
      </div>

      {/* Featured trend */}
      {featured && (
        <Card className="overflow-hidden">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Most movement lately</p>
                <h2 className="mt-0.5 text-lg font-semibold text-ink">{featured.meta.label}</h2>
              </div>
              <TrendPill improving={featured.improving} flat={featured.flat} delta={featured.delta} />
            </div>
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

      {/* All metrics */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Everything I&apos;m tracking</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Card key={c.key} className="sa-card-hover">
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.meta.label}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">{c.meta.description}</p>
                  </div>
                  <TrendPill improving={c.improving} flat={c.flat} delta={c.delta} />
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-ink">{c.latest}</span>
                  <span className="text-sm text-muted">/100</span>
                </div>
                <div className="mt-1 text-navy-500">
                  <TrendChart values={c.values} baseline={c.baseline} positive={c.improving} height={96} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* The connections — what a spreadsheet can't show you */}
      {connections.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-orange-500" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Connections I&apos;ve found in your data</p>
            </div>
            <ul className="mt-3 space-y-3">
              {connections.map((a, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className="text-sm leading-relaxed text-ink">{a.plain}</p>
                  <div className="shrink-0"><ConfidenceChip level={a.confidence} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">These are patterns across your own check-ins — the non-obvious stuff you can&apos;t eyeball from a single chart.</p>
          </CardBody>
        </Card>
      )}

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

function Kpi({ icon: Icon, label, value, suffix, tone }: { icon: typeof Gauge; label: string; value: string; suffix?: string; tone: "orange" | "navy" }) {
  return (
    <Card>
      <CardBody className="p-4">
        <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", tone === "orange" ? "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" : "bg-navy-100 text-navy-600 dark:bg-navy-500/15 dark:text-navy-300")}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="mt-2.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{value}<span className="ml-1 text-xs font-normal text-muted">{suffix}</span></p>
        <p className="text-[12px] text-muted">{label}</p>
      </CardBody>
    </Card>
  );
}

function TrendPill({ improving, flat, delta }: { improving: boolean; flat: boolean; delta: number }) {
  const Arrow = flat ? Minus : improving ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn(
      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
      flat ? "bg-surface-2 text-muted" : improving ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    )}>
      <Arrow className="h-3.5 w-3.5" />{flat ? "steady" : Math.abs(delta)}
    </span>
  );
}
