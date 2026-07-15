"use client";

import { useState } from "react";
import { ChevronDown, Stethoscope, Target, ThumbsDown, ThumbsUp, BookOpen, Eye } from "lucide-react";
import { Card, CardBody, ConfidenceChip, Chip } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { cn } from "@/lib/utils";
import type { Insight, InsightCategory } from "@/types";

const categoryMeta: Record<InsightCategory, { label: string; icon: typeof Eye }> = {
  observation: { label: "Observation", icon: Eye },
  education: { label: "Good to know", icon: BookOpen },
  behavioral_focus: { label: "Focus area", icon: Target },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const { addContextNote } = useHealth();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const meta = categoryMeta[insight.category];
  const Icon = meta.icon;

  // Corrections are learning signals: persist them so Synapse weighs this
  // kind of read differently next time (they flow into its chat context too).
  function giveFeedback(kind: "up" | "down") {
    if (feedback === kind) return;
    setFeedback(kind);
    addContextNote(
      `Your reaction to my insight: "${insight.observation.slice(0, 90)}${insight.observation.length > 90 ? "…" : ""}"`,
      kind === "up" ? "This made sense to me." : "This didn't feel right to me.",
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-navy-500">
              <Icon className="h-4 w-4" />
            </span>
            <Chip>{meta.label}</Chip>
          </div>
          <ConfidenceChip level={insight.confidence} />
        </div>

        <p className="mt-4 text-lg leading-relaxed text-ink">{insight.observation}</p>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-600"
          aria-expanded={open}
        >
          {open ? "Hide reasoning" : "Why did Synapse say this?"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="animate-fade-in mt-4 space-y-4 border-t pt-4">
            <Detail label="Why I think this">
              <p className="text-muted">{insight.reasoning}</p>
            </Detail>

            {insight.evidenceRefs.length > 0 && (
              <Detail label="The evidence I used">
                <p className="text-sm text-muted">{insight.evidenceRefs.join(" · ")}</p>
              </Detail>
            )}

            {insight.alternativeExplanation && (
              <Detail label="Other explanations I'm considering">
                <p className="text-sm text-muted">{insight.alternativeExplanation}</p>
              </Detail>
            )}

            {insight.wouldChange && (
              <Detail label="What would change my mind">
                <p className="text-sm text-muted">{insight.wouldChange}</p>
              </Detail>
            )}

            {insight.suggestedFocus.length > 0 && (
              <Detail label="A gentle focus" icon={Target}>
                <ul className="space-y-1.5">
                  {insight.suggestedFocus.map((f) => (
                    <li key={f} className="flex gap-2 text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Detail>
            )}

            {insight.questionsForProvider.length > 0 && (
              <Detail label="Worth asking your provider" icon={Stethoscope}>
                <ul className="space-y-1.5">
                  {insight.questionsForProvider.map((q) => (
                    <li key={q} className="text-muted">“{q}”</li>
                  ))}
                </ul>
              </Detail>
            )}

            <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
              <span className="font-medium text-ink">On my confidence: </span>
              {insight.confidenceRationale}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t pt-3 text-muted">
          <span className="text-xs">Did this make sense?</span>
          <button
            onClick={() => giveFeedback("up")}
            aria-label="Helpful"
            className={cn("rounded-full p-1.5 hover:bg-surface-2", feedback === "up" && "text-emerald-600")}
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => giveFeedback("down")}
            aria-label="Not helpful"
            className={cn("rounded-full p-1.5 hover:bg-surface-2", feedback === "down" && "text-orange-600")}
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
          {feedback && <span className="text-xs">Thanks — this helps me get better for you.</span>}
        </div>
      </CardBody>
    </Card>
  );
}

function Detail({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Target;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        {Icon && <Icon className="h-4 w-4 text-navy-500" />}
        {label}
      </div>
      {children}
    </div>
  );
}
