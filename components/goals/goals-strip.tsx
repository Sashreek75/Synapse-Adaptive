"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, ArrowRight, Zap, AlertTriangle } from "lucide-react";
import { activeGoals, progressPct, currentFront, MOMENTUM_LABEL, type Goal } from "@/lib/goals";

const TINT: Record<string, string> = {
  building: "text-emerald-600 dark:text-emerald-400",
  steady: "text-navy-500",
  slipping: "text-orange-600 dark:text-orange-400",
  stalled: "text-rose-600 dark:text-rose-400",
  new: "text-muted",
};

/** The current mission — progress, the front being fought, and the next critical move. */
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
        <span className="flex items-center gap-2 text-muted"><Target className="h-4 w-4 text-orange-500" /> Name a mission that matters — I&apos;ll help you actually win it.</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    );
  }

  const lead = goals[0];
  const pct = progressPct(lead);
  const front = currentFront(lead);
  const rest = goals.slice(1, 3);
  return (
    <Link href={`/goals/${lead.id}`} className="block rounded-2xl border bg-surface px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"><Target className="h-3.5 w-3.5 text-orange-500" /> Current mission</span>
        <span className={`text-xs ${TINT[lead.momentum] || "text-muted"}`}>{MOMENTUM_LABEL[lead.momentum]}</span>
      </div>
      <p className="mt-1 text-base font-semibold text-ink">{lead.mission || lead.title}</p>
      {lead.fronts.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
          <span className="text-[11px] text-muted">{pct}%</span>
        </div>
      )}
      {lead.nextMove ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
          <span><span className="font-medium">Next:</span> {lead.nextMove.title}{lead.nextMove.minutes ? ` · ${lead.nextMove.minutes} min` : ""}{front ? ` · ${front.title}` : ""}</span>
        </p>
      ) : lead.greatestRisk ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-orange-600 dark:text-orange-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Risk: {lead.greatestRisk}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Open it to map the campaign →</p>
      )}
      {rest.length > 0 && <p className="mt-2 text-[11px] text-muted">Also running: {rest.map((g) => g.title).join(" · ")}</p>}
    </Link>
  );
}
