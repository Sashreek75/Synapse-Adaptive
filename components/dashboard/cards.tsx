import { ArrowUpRight, ArrowDownRight, Clock, Sparkles } from "lucide-react";
import { Card, CardBody, SectionLabel, ConfidenceChip, Chip } from "@/components/ui/primitives";
import { Sparkline } from "@/components/ui/sparkline";
import { METRIC_META } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type {
  Confidence,
  MetricSeries,
  RecentChange,
  HealthReport,
  UpcomingAssessment,
} from "@/types";

export function WeeklySummaryCard({
  summary,
  confidence,
}: {
  summary: string;
  confidence: Confidence;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="mesh">
        <CardBody>
          <div className="flex items-center justify-between">
            <SectionLabel className="mb-0">Your health, right now</SectionLabel>
            <ConfidenceChip level={confidence} />
          </div>
          <p className="mt-3 text-xl leading-relaxed text-ink">{summary}</p>
        </CardBody>
      </div>
    </Card>
  );
}

export function RecentChangesCard({
  changes,
  series,
}: {
  changes: RecentChange[];
  series: MetricSeries[];
}) {
  return (
    <Card>
      <CardBody>
        <SectionLabel>Recent changes</SectionLabel>
        <ul className="divide-y">
          {changes.map((c) => {
            const s = series.find((x) => x.metric === c.metric);
            const vals = s?.points.map((p) => p.valueNorm) ?? [];
            return (
              <li key={c.metric} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{c.label}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium",
                        c.improving ? "text-emerald-600" : "text-orange-600",
                      )}
                    >
                      {c.improving ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {Math.abs(c.deltaNorm)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{c.framing}</p>
                </div>
                <Sparkline values={vals} positive={c.improving} />
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

export function FocusAreasCard({ areas }: { areas: string[] }) {
  return (
    <Card>
      <CardBody>
        <SectionLabel>Suggested focus this week</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <span
              key={a}
              className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
            >
              {a}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Behavioral suggestions only — never medical guidance.</p>
      </CardBody>
    </Card>
  );
}

export function UpcomingAssessmentCard({ upcoming }: { upcoming: UpcomingAssessment }) {
  const mins = Math.round(upcoming.totalEstSeconds / 60);
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <SectionLabel className="mb-0">Your next check-in</SectionLabel>
          <Chip><Clock className="mr-1 h-3 w-3" /> ~{mins} min</Chip>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Sparkles className="h-4 w-4 text-orange-500" />
          Chosen for you based on your goals and what we&apos;re watching.
        </p>
        <ul className="mt-4 space-y-3">
          {upcoming.battery.map((b) => (
            <li key={b.key} className="rounded-xl bg-surface-2 p-3">
              <p className="font-medium text-ink">{b.label}</p>
              <p className="mt-0.5 text-sm text-muted">{b.rationale}</p>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function ReportInsightsHeader({ report }: { report: HealthReport }) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="text-lg font-semibold text-ink">This week&apos;s insights</h2>
      <span className="text-sm text-muted">{report.cycleLabel}</span>
    </div>
  );
}

export { METRIC_META };
