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
import { selfReviewLine, openRecommendations, reviewRecommendation, type Recommendation, type RecStatus } from "@/lib/decisions";

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
  const [selfReview, setSelfReview] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    const sync = () => { setGoals(activeGoals()); setSpaces([]); }; // Spaces removed — focus is decisions.
    sync();
    const oc = openCommitment();
    setOpenC(oc ? oc.text : null); setWins(winsLine()); setDrift(driftLine());
    const syncD = () => { setSelfReview(selfReviewLine()); setRecs(openRecommendations(40)); };
    syncD();
    window.addEventListener("synapse:goals", sync);
    window.addEventListener("synapse:decisions", syncD);
    return () => { window.removeEventListener("synapse:goals", sync); window.removeEventListener("synapse:decisions", syncD); };
  }, []);

  const judge = (id: string, status: RecStatus) => { reviewRecommendation(id, status); setRecs(openRecommendations(40)); setSelfReview(selfReviewLine()); };

  if (goals.length === 0 && spaces.length === 0 && !openC && !wins && !drift && !selfReview && recs.length === 0) return null;

  return (
    <Card className="sa-rise-2 overflow-hidden">
      <CardBody className="space-y-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-orange-500" />
          <h2 className="text-lg font-semibold text-ink">Your missions this week</h2>
        </div>

        {selfReview && (
          <div className="rounded-xl border border-navy-200/50 bg-surface-2 p-3 dark:border-navy-700/50">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">How I coached you</p>
            <p className="text-sm leading-relaxed text-ink">{selfReview}</p>
          </div>
        )}

        {recs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Did these actually help?</h3>
            <div className="space-y-2">
              {recs.map((r) => (
                <div key={r.id} className="rounded-xl border bg-surface p-3">
                  <p className="text-sm text-ink">{r.text}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => judge(r.id, "worked")} className="rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300">It helped</button>
                    <button onClick={() => judge(r.id, "partial")} className="rounded-full border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink">Sort of</button>
                    <button onClick={() => judge(r.id, "failed")} className="rounded-full border border-rose-300/60 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-500/15 dark:text-rose-300">It didn&apos;t</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">I use this to stop repeating what doesn&apos;t work for you — and lean on what does.</p>
          </div>
        )}

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
              const d = daysSinceProgress(g);
              const drifting = (g.priority === "primary" || g.priority === "high") && (d ?? 0) >= 8;
              return (
                <Link key={g.id} href={`/goals/${g.id}`} className="block rounded-xl border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                  <p className="min-w-0 truncate font-medium text-ink">{g.title}</p>
                  {g.nextMove?.title && <p className="mt-1.5 text-sm text-muted"><span className="font-medium text-ink">Next:</span> {g.nextMove.title}</p>}
                  {drifting && <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">Hasn&apos;t moved in over a week — let&apos;s not let this slip.</p>}
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
