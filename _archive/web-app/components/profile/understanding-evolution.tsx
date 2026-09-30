"use client";

/**
 * THE EVOLVING PROFILE
 * --------------------
 * The Health Profile should GROW, not just update. On each visit Synapse records
 * a dated snapshot of how it understands the user; over time this renders as a
 * narrative of how that understanding has shifted, plus a timeline. Deterministic
 * and offline-safe — the profile literally deepens with the relationship.
 */

import { useEffect, useRef } from "react";
import { Brain, ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { currentUnderstanding, profileEvolution } from "@/lib/intelligence";

export function UnderstandingEvolution() {
  const { series, profile, recentChanges, understandingLog, recordUnderstanding, hasData } = useHealth();
  const recorded = useRef(false);

  // Capture today's understanding once per mount (throttled inside the store).
  useEffect(() => {
    if (!hasData || recorded.current) return;
    recorded.current = true;
    const u = currentUnderstanding(series, profile.path, recentChanges);
    recordUnderstanding({ focus: u.focus, leadMetric: u.leadMetric, read: u.read });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);

  if (!hasData) return null;

  const current = currentUnderstanding(series, profile.path, recentChanges);
  const evolution = profileEvolution(understandingLog);
  const timeline = [...understandingLog].reverse();

  return (
    <Card className="sa-rise-2 overflow-hidden">
      <CardBody>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-orange-500"><Brain className="h-4 w-4" /></span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">How my understanding of you is evolving</h2>
        </div>

        {evolution ? (
          <>
            <p className="text-ink">{evolution.headline}</p>
            <ul className="mt-3 space-y-2">
              {evolution.shifts.map((sft, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /> {sft}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div>
            <p className="text-ink">{current.read}</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
              <Sparkles className="h-4 w-4 shrink-0 text-orange-500" />
              This section grows as we go — I&apos;ll show how my understanding of you shifts over the weeks.
            </div>
          </div>
        )}

        {timeline.length > 1 && (
          <div className="mt-5 border-t pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted/70">The story so far</p>
            <ol className="relative space-y-4 pl-5">
              <span className="absolute left-[3px] top-1 bottom-1 w-px bg-line" />
              {timeline.map((snap, i) => (
                <li key={snap.id} className="relative">
                  <span className={`absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface ${i === 0 ? "bg-orange-500" : "bg-navy-300 dark:bg-navy-600"}`} />
                  <p className="text-xs text-muted">{new Date(snap.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{i === 0 ? " · now" : ""}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {snap.focus.length ? snap.focus.map((f) => (
                      <span key={f} className="rounded-full border bg-surface-2 px-2.5 py-0.5 text-xs text-ink">{f}</span>
                    )) : <span className="text-xs text-muted">Broad watch</span>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
