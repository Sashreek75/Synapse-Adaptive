"use client";

import { useState } from "react";
import { Sparkles, Stethoscope, X, ChevronDown } from "lucide-react";
import { ConfidenceChip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { ProactiveNotice } from "@/types";

/**
 * The signature "Synapse noticed" card. This is the moment the product earns
 * trust: the AI surfaces a meaningful pattern BEFORE the user asks, calmly.
 */
export function ProactiveNoticeCard({ notice }: { notice: ProactiveNotice }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-surface shadow-soft dark:border-orange-500/20 dark:from-orange-500/5 dark:to-surface">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
            <Sparkles className="h-3.5 w-3.5" />
            Synapse noticed
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-lg leading-relaxed text-ink">{notice.observation}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ConfidenceChip level={notice.confidence} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-600"
            aria-expanded={open}
          >
            {open ? "Hide details" : "Tell me more"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {open && (
          <div className="animate-fade-in mt-4 space-y-4 border-t border-orange-200/60 pt-4 dark:border-orange-500/15">
            <p className="text-muted">{notice.reasoning}</p>

            {notice.evidenceRefs.length > 0 && (
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">The evidence I used: </span>
                {notice.evidenceRefs.join(" · ")}
              </p>
            )}

            {notice.suggestedFocus.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">A gentle focus this week</p>
                <ul className="space-y-1.5">
                  {notice.suggestedFocus.map((f) => (
                    <li key={f} className="flex gap-2 text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notice.questionsForProvider.length > 0 && (
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Stethoscope className="h-4 w-4 text-navy-500" />
                  If it continues, you might ask your provider
                </p>
                <ul className="space-y-1.5">
                  {notice.questionsForProvider.map((q) => (
                    <li key={q} className="text-muted">“{q}”</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-muted">
              <span className="font-medium text-ink">On my confidence: </span>
              {notice.confidenceRationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
