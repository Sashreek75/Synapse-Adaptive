"use client";

/**
 * THE GENERATED DASHBOARD — decided, not designed.
 *
 * Founding doc: "The dashboard is generated. The AI decides what appears. If
 * sleep matters, show sleep. If it doesn't, hide it." So there is no fixed grid
 * of twelve widgets. This surfaces ONLY the signals that currently carry meaning
 * — and when nothing has moved enough to matter, it renders nothing at all.
 * Intelligence is choosing what NOT to show.
 */

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { signalMeta } from "@/lib/signals";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

export function GeneratedDashboard() {
  const { hasData, series, recentChanges } = useHealth();

  // What deserves to appear: the movements large enough to be worth noticing.
  const watching = useMemo(() => {
    return [...recentChanges]
      .sort((a, b) => Math.abs(b.deltaNorm) - Math.abs(a.deltaNorm))
      .slice(0, 3)
      .map((c) => {
        const s = series.find((x) => x.metric === c.metric);
        const values = (s?.points ?? []).slice(-8).map((p) => p.valueNorm);
        return { ...c, values };
      })
      .filter((c) => c.values.length >= 2);
  }, [recentChanges, series]);

  // The whole point: if nothing has moved, show nothing.
  if (!hasData || watching.length === 0) return null;

  return (
    <section className="rounded-3xl border bg-surface/60 p-5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">What I&apos;m watching right now</p>
      <div className="mt-3 divide-y divide-line">
        {watching.map((c) => {
          const meta = signalMeta(c.metric);
          const Arrow = c.improving ? TrendingUp : TrendingDown;
          return (
            <div key={c.metric} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Arrow className={cn("h-4 w-4 shrink-0", c.improving ? "text-emerald-500" : "text-orange-500")} />
                  <span className="text-sm font-medium text-ink">{meta.label}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{c.framing}</p>
              </div>
              <div className="shrink-0 opacity-90">
                <Sparkline values={c.values} positive={c.improving} width={104} height={32} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        I only show what&apos;s moved enough to matter. Everything else is holding steady — ask me if you want the full picture.
      </p>
    </section>
  );
}
