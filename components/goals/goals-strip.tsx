"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, ArrowRight, Zap } from "lucide-react";
import { activeGoals, type Goal } from "@/lib/goals";

/** The current focus — one goal, one next action. No progress bars, no jargon. Quiet when empty. */
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
        <span className="flex items-center gap-2 text-muted"><Target className="h-4 w-4 text-orange-500" /> Name a goal — I&apos;ll tell you exactly what to do first.</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    );
  }

  const lead = goals[0];
  const rest = goals.slice(1, 3);
  return (
    <Link href={`/goals/${lead.id}`} className="block rounded-2xl border bg-surface px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"><Target className="h-3.5 w-3.5 text-orange-500" /> Working toward</span>
      <p className="mt-1 text-base font-semibold text-ink">{lead.title}</p>
      {lead.nextMove?.title ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" /><span><span className="font-medium">Next:</span> {lead.nextMove.title}</span></p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Open it and I&apos;ll tell you what to do first →</p>
      )}
      {rest.length > 0 && <p className="mt-2 text-[11px] text-muted">Also: {rest.map((g) => g.title).join(" · ")}</p>}
    </Link>
  );
}
