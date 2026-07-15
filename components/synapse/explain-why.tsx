"use client";

import { useState } from "react";
import { ChevronDown, Activity, Eye, BarChart3, Gauge, Heart, GitBranch, RefreshCw } from "lucide-react";
import { ConfidenceChip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { ExplainWhy } from "@/lib/intelligence";

/**
 * "Explain why" — the trust primitive. Every Synapse recommendation can reveal
 * its full reasoning: what changed, why it noticed, the evidence it used, how
 * confident it is, why it matters, the alternative explanations it's holding,
 * and what would change its mind. Users should always be able to see the
 * thinking, never asked to take Synapse on faith.
 */
export function ExplainWhy({ why, className }: { why: ExplainWhy; className?: string }) {
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
          <Row icon={Eye} label="What changed" text={why.whatChanged} />
          <Row icon={Activity} label="Why I noticed" text={why.whyNoticed} />
          <Row icon={BarChart3} label="The evidence" text={why.evidence} />
          <div className="flex items-center gap-2 border-t pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Gauge className="h-3.5 w-3.5 text-orange-500" /> How confident I am
            </span>
            <ConfidenceChip level={why.confidence} />
          </div>
          <Row icon={Heart} label="Why it matters" text={why.whyMatters} />
          <Row icon={GitBranch} label="Other explanations I'm considering" text={why.alternatives} />
          <Row icon={RefreshCw} label="What would change my mind" text={why.wouldChange} />
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, text }: { icon: typeof Eye; label: string; text: string }) {
  return (
    <div>
      <div className="mb-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500">
        <Icon className="h-3.5 w-3.5 text-orange-500" /> {label}
      </div>
      <p className="text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}
