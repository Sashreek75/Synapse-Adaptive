"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Target, Compass } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { activeGoals, addGoal, seedGoalFromTrajectory, daysSinceProgress, type Goal } from "@/lib/goals";

/**
 * Synapse's own judgment about what to protect this week — computed from the goal signals it
 * already tracks (priority, momentum, recency), never a priority system the user maintains. It
 * makes the call internally and states it with honest confidence; the fuller reasoning lives one
 * tap away in the goal's coach conversation. No new fields, scores, or ranking controls are shown.
 */
const PRIORITY_SCORE: Record<string, number> = { primary: 3, high: 2, medium: 1, someday: 0 };
const MOMENTUM_SCORE: Record<string, number> = { building: 2, steady: 1.5, new: 1, slipping: 0.5, stalled: 0 };

function scoreGoal(g: Goal): number {
  const pri = PRIORITY_SCORE[g.priority] ?? 0;
  const mom = MOMENTUM_SCORE[g.momentum] ?? 0;
  const d = daysSinceProgress(g);
  const recency = d == null ? 0.5 : d <= 2 ? 1 : d <= 7 ? 0.3 : -0.5; // recent movement = traction; long-stale = losing
  return pri * 10 + mom * 2 + recency;
}

function momentumClause(g: Goal): string {
  return (g.momentum === "building" || g.momentum === "steady") ? "you've got real traction on it — let's protect that"
    : (g.momentum === "slipping" || g.momentum === "stalled") ? "it's started to slip, which is exactly why it needs protecting now"
    : "now's the moment to make the first move real";
}

function pickFocus(goals: Goal[]): { g: Goal; single: boolean; confident: boolean; reason: string } | null {
  if (goals.length === 0) return null;
  // ONE goal: no artificial competition — just demonstrate judgment from what they told us.
  if (goals.length === 1) {
    const g = goals[0];
    const why = g.why ? `You told me this matters because ${g.why.replace(/\.$/, "")}, so ` : "";
    return { g, single: true, confident: true, reason: `${why}${momentumClause(g)}.` };
  }
  const ranked = [...goals].sort((a, b) => scoreGoal(b) - scoreGoal(a));
  const top = ranked[0];
  const margin = scoreGoal(top) - scoreGoal(ranked[1]);
  const confident = margin >= 8; // ≈ a full priority tier of separation — a genuinely clear winner
  const pri = top.priority === "primary" ? "It's your top priority"
    : top.priority === "high" ? "It's one of your highest priorities"
    : "It's the one most worth your attention right now";
  const mom = (top.momentum === "building" || top.momentum === "steady") ? "and your recent effort is actually landing there"
    : (top.momentum === "slipping" || top.momentum === "stalled") ? "and it's starting to slip — which is exactly why it's worth protecting now"
    : "and now's the moment to build real momentum on it";
  return { g: top, single: false, confident, reason: `${pri}, ${mom}.` };
}

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

  const lead = useMemo(() => pickFocus(goals), [goals]);

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

      {/* Synapse's judgment — the clarity you'd otherwise only get by starting a conversation. */}
      {lead && (
        <div className="rounded-2xl border border-orange-200/50 bg-gradient-to-br from-orange-50 to-surface p-4 shadow-soft dark:border-orange-500/20 dark:from-orange-500/5 dark:to-surface">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            <Compass className="h-3.5 w-3.5" /> What I&apos;d protect this week
          </p>
          <p className="mt-1.5 text-[15px] leading-snug text-ink">
            {lead.single
              ? <>This is the one I&apos;d protect right now:{" "}
                  <button onClick={() => router.push(`/goals/${lead.g.id}`)} className="font-semibold underline decoration-orange-300 underline-offset-2 hover:text-orange-600 dark:hover:text-orange-400">{lead.g.title}</button>.</>
              : lead.confident
                ? <>If I were protecting one thing this week, I&apos;d protect{" "}
                    <button onClick={() => router.push(`/goals/${lead.g.id}`)} className="font-semibold underline decoration-orange-300 underline-offset-2 hover:text-orange-600 dark:hover:text-orange-400">{lead.g.title}</button>.</>
                : <>I think{" "}
                    <button onClick={() => router.push(`/goals/${lead.g.id}`)} className="font-semibold underline decoration-orange-300 underline-offset-2 hover:text-orange-600 dark:hover:text-orange-400">{lead.g.title}</button>{" "}
                    deserves the most attention right now — though I&apos;m not fully certain yet.</>}
          </p>
          <p className="mt-1 text-sm text-muted">{lead.reason} <button onClick={() => router.push(`/goals/${lead.g.id}`)} className="font-medium text-navy-500 hover:text-ink">Talk it through →</button></p>
        </div>
      )}

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
