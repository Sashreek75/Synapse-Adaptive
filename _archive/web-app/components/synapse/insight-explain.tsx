"use client";

import { useState } from "react";
import { ChevronDown, Activity, BarChart3, Gauge, AlertCircle, GitBranch, RefreshCw } from "lucide-react";
import { ConfidenceChip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Insight } from "@/types";

/**
 * "Explain why" for model-authored insights — same trust primitive as
 * <ExplainWhy>, but driven by the Insight shape (reasoning, evidenceRefs,
 * confidence + rationale, alternatives, what-would-change-it, uncertainty
 * flags). Every insight Synapse surfaces should let the user see the thinking.
 */
export function InsightExplain({ insight, className }: { insight: Insight; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 transition-colors hover:text-navy-600"
      >
        {open ? "Hide Synapse's reasoning" : "Explain why"}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="animate-fade-in mt-3 space-y-3 rounded-2xl border bg-surface-2 p-4">
          <Row icon={Activity} label="Why I think this" text={insight.reasoning} />
          {insight.evidenceRefs.length > 0 && (
            <Row icon={BarChart3} label="The evidence I used" text={insight.evidenceRefs.join(" · ")} />
          )}
          {insight.alternativeExplanation && (
            <Row icon={GitBranch} label="Other explanations I'm considering" text={insight.alternativeExplanation} />
          )}
          {insight.wouldChange && (
            <Row icon={RefreshCw} label="What would change my mind" text={insight.wouldChange} />
          )}
          {insight.uncertaintyFlags.length > 0 && (
            <Row icon={AlertCircle} label="What could make me wrong" text={insight.uncertaintyFlags.join(" · ")} />
          )}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Gauge className="h-3.5 w-3.5 text-orange-500" /> How confident I am
            </span>
            <ConfidenceChip level={insight.confidence} />
          </div>
          <p className="text-sm leading-relaxed text-muted">{insight.confidenceRationale}</p>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, text }: { icon: typeof Activity; label: string; text: string }) {
  return (
    <div>
      <div className="mb-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500">
        <Icon className="h-3.5 w-3.5 text-orange-500" /> {label}
      </div>
      <p className="text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}
