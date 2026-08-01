"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, ArrowRight, Zap } from "lucide-react";
import { activeGoals, MOMENTUM_LABEL, type Goal } from "@/lib/goals";

const TINT: Record<string, string> = {
  building: "text-emerald-600 dark:text-emerald-400",
  steady: "text-navy-500",
  slipping: "text-orange-600 dark:text-orange-400",
  stalled: "text-rose-600 dark:text-rose-400",
  new: "text-muted",
};

/** Puts the current campaign — and its next critical move — at the top of home. Quiet when empty. */
export function GoalsStrip() {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    const sync = () => setGoals(activeGoals());
    sync();
    window.addEventListener("synapse:goals", sync);
    return () => window.removeEventListener("synapse:goals", sync);
  }, []);

  if (goals.length === 0) {
    return (
      <Link href="/goals" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-surface/60 px-4 py-3 text-sm transition hover:bg-surface-2">
        <span className="flex items-center gap-2 text-muted"><Target className="h-4 w-4 text-orange-500" /> Name a goal that matters — I&apos;ll help you actually reach it.</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    );
  }

  const lead = goals[0];
  const rest = goals.slice(1, 3);
  return (
    <Link href={`/goals/${lead.id}`} className="block rounded-2xl border bg-surface px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"><Target className="h-3.5 w-3.5 text-orange-500" /> Current campaign</span>
        <span className={`text-xs ${TINT[lead.momentum] || "text-muted"}`}>{MOMENTUM_LABEL[lead.momentum]}</span>
      </div>
      <p className="mt-1 text-base font-semibold text-ink">{lead.title}</p>
      {lead.nextMove ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
          <span><span className="font-medium">Next:</span> {lead.nextMove.title}{lead.nextMove.minutes ? ` · ${lead.nextMove.minutes} min` : ""}{lead.nextMove.when ? ` · ${lead.nextMove.when}` : ""}</span>
        </p>
      ) : lead.bottleneck ? (
        <p className="mt-1.5 text-sm text-muted">Bottleneck: {lead.bottleneck}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Open it to map the campaign →</p>
      )}
      {rest.length > 0 && <p className="mt-2 text-[11px] text-muted">Also active: {rest.map((g) => g.title).join(" · ")}</p>}
    </Link>
  );
}
