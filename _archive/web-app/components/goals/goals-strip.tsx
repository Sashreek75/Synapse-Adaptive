"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, ArrowRight, Zap } from "lucide-react";
import { activeGoals, type Goal } from "@/lib/goals";

/**
 * THE CURRENT FOCUS on Home — now the SAME allocation the Goals page decided, not a separate call.
 * It reads the recorded needle (the "protect" set + Synapse's note) from the cache the Goals page
 * writes, so Home and Goals can never contradict each other. When no needle has been computed yet it
 * falls back to the top goal. Allocation is not elimination: non-protected goals are shown as
 * "keeping alive", never dropped. Quiet when empty.
 */
type Needle = { ids: string[]; note: string; maintain: string[] };

export function GoalsStrip() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [needle, setNeedle] = useState<Needle | null>(null);

  useEffect(() => {
    const sync = () => {
      setGoals(activeGoals());
      try {
        const c = JSON.parse(localStorage.getItem("synapse.goals.focus.v1") || "null");
        const f = c?.focus;
        if (f && Array.isArray(f.ids) && f.ids.length) {
          setNeedle({ ids: f.ids, note: typeof f.note === "string" ? f.note : "", maintain: Array.isArray(f.allocation?.maintain) ? f.allocation.maintain : [] });
        } else setNeedle(null);
      } catch { setNeedle(null); }
    };
    sync();
    window.addEventListener("synapse:goals", sync);
    window.addEventListener("synapse:allocations", sync);
    return () => {
      window.removeEventListener("synapse:goals", sync);
      window.removeEventListener("synapse:allocations", sync);
    };
  }, []);

  if (goals.length === 0) {
    return (
      <Link href="/goals" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-surface/60 px-4 py-3 text-sm transition hover:bg-surface-2">
        <span className="flex items-center gap-2 text-muted"><Target className="h-4 w-4 text-orange-500" /> Name a goal — I&apos;ll tell you exactly what to do first.</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    );
  }

  const has = (id: string) => goals.some((g) => g.id === id);
  const title = (id: string) => goals.find((g) => g.id === id)?.title;
  // The needle's "protect" set (validated against live goals) leads; otherwise the top goal.
  const protectIds = (needle?.ids ?? []).filter(has);
  const usingNeedle = protectIds.length > 0;
  const lead = (usingNeedle ? goals.find((g) => g.id === protectIds[0]) : goals[0]) ?? goals[0];

  const alsoProtect = protectIds.slice(1).map(title).filter(Boolean) as string[];
  const keepAlive = usingNeedle
    ? ((needle?.maintain ?? []).filter(has).map(title).filter(Boolean) as string[])
    : goals.slice(1, 3).map((g) => g.title);

  return (
    <Link href={`/goals/${lead.id}`} className="block rounded-2xl border bg-surface px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <Target className="h-3.5 w-3.5 text-orange-500" /> {usingNeedle ? "This week — protect" : "Working toward"}
      </span>
      <p className="mt-1 text-base font-semibold text-ink">{lead.title}</p>
      {lead.nextMove?.title ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" /><span><span className="font-medium">Next:</span> {lead.nextMove.title}</span></p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Open it and I&apos;ll tell you what to do first →</p>
      )}
      {alsoProtect.length > 0 && <p className="mt-2 text-[11px] text-muted">Also protecting: {alsoProtect.join(" · ")}</p>}
      {keepAlive.length > 0 && (
        <p className="mt-1 text-[11px] text-muted">{usingNeedle ? "Keeping alive: " : "Also: "}{keepAlive.join(" · ")}</p>
      )}
    </Link>
  );
}
