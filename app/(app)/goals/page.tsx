"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Target, Flag } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { activeGoals, addGoal, seedGoalFromTrajectory, MOMENTUM_LABEL, type Goal } from "@/lib/goals";

const MOMENTUM_TINT: Record<string, string> = {
  building: "text-emerald-600 dark:text-emerald-400",
  steady: "text-navy-500",
  slipping: "text-orange-600 dark:text-orange-400",
  stalled: "text-rose-600 dark:text-rose-400",
  new: "text-muted",
};

export default function GoalsPage() {
  const router = useRouter();
  const { mind } = useHealth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    seedGoalFromTrajectory(mind?.trajectory?.statement);
    const sync = () => setGoals(activeGoals());
    sync();
    window.addEventListener("synapse:goals", sync);
    return () => window.removeEventListener("synapse:goals", sync);
  }, [mind]);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const g = addGoal({ title: t });
    setTitle("");
    router.push(`/goals/${g.id}`);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={40} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your goals</h1>
          <p className="text-sm text-muted">The things that matter most — everything I do is in service of these.</p>
        </div>
      </header>

      <div className="rounded-2xl border bg-surface p-4 shadow-soft">
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Name a goal — get into college, run a 10k, ship the startup..."
            className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <Button onClick={add} disabled={!title.trim()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface/50 p-8 text-center text-sm text-muted">
          <Target className="mx-auto mb-2 h-5 w-5" /> No goals yet. Name the first thing that matters — I&apos;ll help you actually get there.
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <button key={g.id} onClick={() => router.push(`/goals/${g.id}`)}
              className="group flex w-full items-start justify-between gap-3 rounded-2xl border bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-navy-100 dark:text-navy-900">{g.priority}</span>
                  <h3 className="font-semibold text-ink">{g.title}</h3>
                </div>
                {g.why && <p className="mt-1 text-sm text-muted">{g.why}</p>}
                <p className="mt-2 flex items-center gap-2 text-xs">
                  <span className={MOMENTUM_TINT[g.momentum] || "text-muted"}>Momentum: {MOMENTUM_LABEL[g.momentum]}</span>
                  {g.timeline && <span className="text-muted">· by {g.timeline}</span>}
                  {g.obstacles.length > 0 && <span className="text-muted">· {g.obstacles.length} obstacle{g.obstacles.length === 1 ? "" : "s"}</span>}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </button>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted"><Flag className="h-3.5 w-3.5 text-orange-500" /> Tell me in chat what you&apos;re working on and I&apos;ll keep these alive — noticing drift, protecting momentum, adapting the plan.</p>
    </div>
  );
}
