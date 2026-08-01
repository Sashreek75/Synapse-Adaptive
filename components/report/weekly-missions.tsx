"use client";

/**
 * WEEKLY MISSIONS — the part of the review that's actually about the outcomes.
 *
 * On the first open each week it quietly runs an EVOLVE pass over every active space (refresh the
 * summary, and let Synapse propose one earned improvement per space — gated by the user's approval
 * inside the space). Then it puts missions, commitments, and each living space front-and-centre, so
 * the weekly review is about goals and follow-through, not just metrics.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Zap, AlertTriangle, Wrench, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/primitives";
import { activeGoals, progressPct, currentFront, daysSinceProgress, MOMENTUM_LABEL, type Goal } from "@/lib/goals";
import { activeWorkspaces, evolveWorkspace, type Workspace } from "@/lib/workspaces";
import { openCommitment, winsLine, driftLine } from "@/lib/commitments";

/** Sunday-ending week key, matching the report's cadence. */
function weekKey(): string {
  const s = new Date(); s.setDate(s.getDate() + ((7 - s.getDay()) % 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

export function WeeklyMissions() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [evolving, setEvolving] = useState(false);
  const [openC, setOpenC] = useState<string | null>(null);
  const [wins, setWins] = useState<string | null>(null);
  const [drift, setDrift] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => { setGoals(activeGoals()); setSpaces(activeWorkspaces()); };
    sync();
    const oc = openCommitment();
    setOpenC(oc ? oc.text : null); setWins(winsLine()); setDrift(driftLine());
    window.addEventListener("synapse:workspaces", sync);
    window.addEventListener("synapse:goals", sync);

    // Once-per-week evolve pass: mature each space, still gated by approval inside it.
    void (async () => {
      const key = `synapse.wsEvolve.${weekKey()}`;
      let done = false; try { done = localStorage.getItem(key) === "1"; } catch {}
      const list = activeWorkspaces();
      if (done || list.length === 0) return;
      setEvolving(true);
      try {
        for (const w of list) { try { await evolveWorkspace(w.id); } catch {} }
        try { localStorage.setItem(key, "1"); } catch {}
        setSpaces(activeWorkspaces());
      } finally { setEvolving(false); }
    })();

    return () => { window.removeEventListener("synapse:workspaces", sync); window.removeEventListener("synapse:goals", sync); };
  }, []);

  if (goals.length === 0 && spaces.length === 0 && !openC && !wins && !drift) return null;

  return (
    <Card className="sa-rise-2 overflow-hidden">
      <CardBody className="space-y-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-orange-500" />
          <h2 className="text-lg font-semibold text-ink">Your missions this week</h2>
        </div>

        {(openC || wins || drift) && (
          <div className="space-y-1.5 text-sm">
            {wins && <p className="flex items-start gap-2 text-ink"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {wins}</p>}
            {openC && <p className="flex items-start gap-2 text-ink"><Zap className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /> Open promise: <span className="font-medium">{openC}</span></p>}
            {drift && <p className="flex items-start gap-2 text-orange-600 dark:text-orange-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {drift}</p>}
          </div>
        )}

        {goals.length > 0 && (
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = progressPct(g); const front = currentFront(g); const d = daysSinceProgress(g);
              const drifting = (g.priority === "primary" || g.priority === "high") && (d ?? 0) >= 8;
              return (
                <Link key={g.id} href={`/goals/${g.id}`} className="block rounded-xl border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-ink">{g.mission || g.title}</p>
                    <span className="shrink-0 text-xs text-muted">{MOMENTUM_LABEL[g.momentum]}</span>
                  </div>
                  {g.fronts.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
                      <span className="text-[11px] text-muted">{pct}%</span>
                    </div>
                  )}
                  {g.nextMove ? (
                    <p className="mt-1.5 text-sm text-muted"><span className="font-medium text-ink">Next:</span> {g.nextMove.title}{front ? ` · ${front.title}` : ""}</p>
                  ) : g.bottleneck ? (
                    <p className="mt-1.5 text-sm text-muted">Bottleneck: {g.bottleneck}</p>
                  ) : null}
                  {drifting && <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">Hasn&apos;t moved in over a week — worth a decision.</p>}
                </Link>
              );
            })}
          </div>
        )}

        {spaces.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted" />
              <h3 className="text-sm font-semibold text-ink">Your spaces</h3>
              {evolving && <span className="text-[11px] text-muted">· catching up…</span>}
            </div>
            <div className="space-y-2">
              {spaces.map((w) => {
                const pending = (w.suggestions ?? []).length;
                return (
                  <Link key={w.id} href={`/workspaces/${w.id}`} className="block rounded-xl border bg-surface p-3.5 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-ink">{w.title}</p>
                      {pending > 0
                        ? <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">{pending} to review</span>
                        : <ArrowRight className="h-4 w-4 shrink-0 text-muted" />}
                    </div>
                    {w.summary && <p className="mt-1 text-sm text-muted">{w.summary}</p>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
