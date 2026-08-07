"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { activeGoals, addGoal, seedGoalFromTrajectory, type Goal } from "@/lib/goals";

export default function GoalsPage() {
  const router = useRouter();
  const { mind } = useHealth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");

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
    addGoal({ title: t, why: why.trim() || undefined });
    setTitle(""); setWhy("");
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={40} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your goals</h1>
          <p className="text-sm text-muted">Jot down what you want to achieve. I&apos;ll figure out how — and what to do first.</p>
        </div>
      </header>

      <div className="rounded-2xl border bg-surface p-4 shadow-soft">
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What do you want to achieve?"
            className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <Button onClick={add} disabled={!title.trim()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {title.trim() && (
          <input value={why} onChange={(e) => setWhy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Why does this matter to you? (optional)"
            className="mt-2 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
        )}
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface/50 p-8 text-center text-sm text-muted">
          <Target className="mx-auto mb-2 h-5 w-5" /> Name the first thing you want to achieve — big or small. I&apos;ll take it from there.
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((g) => (
            <button key={g.id} onClick={() => router.push(`/goals/${g.id}`)}
              className="group flex w-full items-center justify-between gap-3 rounded-2xl border bg-surface p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{g.title}</p>
                {g.why && <p className="truncate text-sm text-muted">{g.why}</p>}
                {g.nextMove?.title && <p className="mt-1 truncate text-xs text-orange-600 dark:text-orange-400">Next: {g.nextMove.title}</p>}
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </button>
          ))}
        </div>
      )}

      {/* Never a dead-end: a clear way forward into Synapse. */}
      <div className="flex flex-col items-stretch gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{goals.length ? "That's enough to start — you can add more anytime." : "You can always add goals later."}</p>
        <Button onClick={() => router.push("/dashboard")} className="shrink-0">Continue to Synapse <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
