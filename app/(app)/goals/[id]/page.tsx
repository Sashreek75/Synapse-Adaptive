"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Zap, CheckCircle2, Plus, Wrench, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import {
  getGoal, updateGoal, deleteGoal, decomposeGoal, addFront, updateFront, removeFront, logOutcome,
  progressPct, currentFront, PRIORITIES, MOMENTA, STATUSES,
  type Goal, type Front, type FrontStatus, type OutcomeVerdict,
} from "@/lib/goals";
import { createWorkspaceFromRequest, loadWorkspacesForGoal, type Workspace } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none";
const NEXT_STATUS: Record<FrontStatus, FrontStatus> = { open: "active", active: "won", won: "paused", paused: "open" };
const STATUS_DOT: Record<FrontStatus, string> = { open: "bg-line", active: "bg-orange-500", won: "bg-emerald-500", paused: "bg-navy-300" };
const VERDICTS: OutcomeVerdict[] = ["yes", "partly", "no"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>{children}</div>;
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as { id?: string })?.id || "");
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [tools, setTools] = useState<Workspace[]>([]);
  const [obstacles, setObstacles] = useState("");
  const [works, setWorks] = useState("");
  const [hasnt, setHasnt] = useState("");
  const [evidence, setEvidence] = useState("");
  const [newFront, setNewFront] = useState("");
  const [planning, setPlanning] = useState(false);
  const [buildingKit, setBuildingKit] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeText, setOutcomeText] = useState("");
  const [verdict, setVerdict] = useState<OutcomeVerdict | "">("");
  const [justLogged, setJustLogged] = useState(false);

  useEffect(() => {
    const g = getGoal(id);
    setGoal(g);
    if (g) {
      setObstacles(g.obstacles.join("\n")); setWorks(g.whatWorks.join("\n"));
      setHasnt(g.whatHasnt.join("\n")); setEvidence(g.evidence.join("\n"));
    }
    const syncTools = () => setTools(loadWorkspacesForGoal(id));
    syncTools();
    window.addEventListener("synapse:workspaces", syncTools);
    return () => window.removeEventListener("synapse:workspaces", syncTools);
  }, [id]);

  const refresh = () => setGoal(getGoal(id));
  const set = (patch: Partial<Goal>) => { const g = updateGoal(id, patch); if (g) setGoal(g); };
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const breakIntoPlan = async () => { setPlanning(true); try { const g = await decomposeGoal(id); if (g) setGoal(g); } finally { setPlanning(false); } };
  const buildSpace = async (f: Front) => {
    const bn = f.bottleneck || (goal && goal.bottleneck);
    const req = `Help me make progress on "${f.title}"${goal ? ` for my goal "${goal.title}"` : ""}${bn ? `. The bottleneck is ${bn}.` : "."}`;
    const ws = await createWorkspaceFromRequest(req, { goal: goal?.title, goalId: id });
    router.push(`/workspaces/${ws.id}`);
  };
  const buildToolkit = async () => {
    if (!goal) return;
    setBuildingKit(true);
    try {
      for (const f of goal.fronts.slice(0, 4)) {
        const bn = f.bottleneck || goal.bottleneck;
        const req = `A focused tool to help me make progress on "${f.title}" for my goal "${goal.title}"${bn ? `, where the bottleneck is ${bn}` : ""}.`;
        await createWorkspaceFromRequest(req, { goal: goal.title, goalId: id });
      }
      setTools(loadWorkspacesForGoal(id));
    } finally { setBuildingKit(false); }
  };
  const saveOutcome = () => {
    if (!goal || !goal.nextMove) return;
    logOutcome(id, { move: goal.nextMove.title, result: outcomeText.trim() || "(done)", worked: verdict || undefined });
    setOutcomeOpen(false); setOutcomeText(""); setVerdict(""); setJustLogged(true); refresh();
  };

  if (goal === undefined) return <div className="py-12 text-center text-sm text-muted">Opening…</div>;
  if (!goal) return (
    <div className="mx-auto max-w-md py-12 text-center">
      <SynapseOrb size={56} className="mx-auto" />
      <h1 className="mt-4 text-xl font-semibold text-ink">I couldn&apos;t find that mission</h1>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="outline" onClick={() => router.push("/goals")}>All goals</Button>
        <Button onClick={() => router.push("/dashboard")}>Talk to Synapse</Button>
      </div>
    </div>
  );

  const pct = progressPct(goal);
  const front = currentFront(goal);
  const recent = [...goal.outcomes].reverse().slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => router.push("/goals")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Goals</button>
        <button onClick={() => { deleteGoal(goal.id); router.push("/goals"); }} aria-label="Delete mission" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* MISSION CONTROL — the war room */}
      <div className="overflow-hidden rounded-2xl border bg-navy-900 text-white shadow-lift">
        <div className="mesh p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-300">Mission</p>
          <input value={goal.title} onChange={(e) => set({ title: e.target.value })}
            className="mt-0.5 w-full bg-transparent text-2xl font-semibold tracking-tight text-white focus:outline-none" />
          <input value={goal.mission ?? ""} onChange={(e) => set({ mission: e.target.value })} placeholder="Become someone who…"
            className="mt-1 w-full bg-transparent text-sm text-navy-100/80 placeholder:text-navy-100/40 focus:outline-none" />

          {goal.fronts.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-navy-100/70"><span>Overall progress</span><span>{pct}% · {goal.fronts.filter((f) => f.status === "won").length}/{goal.fronts.length} fronts won</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-[11px] uppercase tracking-wider text-navy-100/60">Current front</p><p className="mt-0.5 font-medium">{front ? front.title : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-navy-100/60">Momentum</p><p className="mt-0.5 font-medium capitalize">{goal.momentum}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-navy-100/60">Greatest risk</p><p className="mt-0.5 font-medium">{goal.greatestRisk || "—"}</p></div>
          </div>
        </div>

        {/* Next critical move + the outcome loop */}
        <div className="border-t border-white/10 p-5 sm:p-6">
          {goal.nextMove ? (
            <>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-300"><Zap className="h-3.5 w-3.5" /> Next critical move</p>
              <p className="mt-1 text-lg font-semibold">{goal.nextMove.title}</p>
              <p className="mt-0.5 text-xs text-navy-100/70">{[goal.nextMove.when, goal.nextMove.minutes ? `${goal.nextMove.minutes} min` : ""].filter(Boolean).join(" · ")}</p>
              {goal.nextMove.why && <p className="mt-2 text-sm text-navy-100/80"><span className="font-medium text-white">Why: </span>{goal.nextMove.why}</p>}
              {!outcomeOpen ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setOutcomeOpen(true)}>I did this <CheckCircle2 className="h-4 w-4" /></Button>
                  {(goal.outcomes.length > 0 || justLogged) && (
                    <Button size="sm" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={breakIntoPlan} disabled={planning}>
                      <RefreshCw className={cn("h-4 w-4", planning && "animate-spin")} /> {planning ? "Reassessing…" : "Reassess the campaign"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                  <p className="text-sm font-medium">How did it go? What changed?</p>
                  <textarea value={outcomeText} onChange={(e) => setOutcomeText(e.target.value)} rows={2} placeholder="e.g. Scored 1490 — math timing still the issue, essays felt worse…"
                    className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-navy-950/40 px-3 py-2 text-sm text-white placeholder:text-navy-100/40 focus:outline-none" />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-navy-100/70">Did it work?</span>
                    {VERDICTS.map((v) => (
                      <button key={v} onClick={() => setVerdict(v)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition", verdict === v ? "border-orange-400 bg-orange-500/20 text-white" : "border-white/15 text-navy-100/80 hover:text-white")}>{v}</button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={saveOutcome}>Log outcome</Button>
                    <Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setOutcomeOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-navy-100/80">No campaign yet — let me break this mission into the fronts to win.</p>
              <Button size="sm" onClick={breakIntoPlan} disabled={planning}>{planning ? "Mapping…" : "Break into a plan"}</Button>
            </div>
          )}
        </div>
      </div>

      {/* THE RELATIONSHIP — belief vs. evidence */}
      {(goal.belief || goal.counterBelief || goal.evidence.length > 0 || goal.recentWin || goal.openQuestion) && (
        <div className="rounded-2xl border bg-surface p-5 shadow-soft">
          <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-orange-500" /> The story so far</p>
          <div className="space-y-3 text-sm">
            {goal.belief != null && <div><p className="text-xs uppercase tracking-wider text-muted">What you believe</p><input value={goal.belief ?? ""} onChange={(e) => set({ belief: e.target.value })} className="mt-0.5 w-full bg-transparent text-ink focus:outline-none" /></div>}
            {goal.counterBelief != null && <div><p className="text-xs uppercase tracking-wider text-muted">What I believe</p><input value={goal.counterBelief ?? ""} onChange={(e) => set({ counterBelief: e.target.value })} className="mt-0.5 w-full bg-transparent font-medium text-ink focus:outline-none" /></div>}
            {(goal.evidence.length > 0) && <div><p className="text-xs uppercase tracking-wider text-muted">Evidence</p><textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} onBlur={() => set({ evidence: lines(evidence) })} rows={2} className="mt-0.5 w-full resize-y rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm text-ink focus:outline-none" /></div>}
            {goal.recentWin != null && <div><p className="text-xs uppercase tracking-wider text-muted">Greatest recent win</p><input value={goal.recentWin ?? ""} onChange={(e) => set({ recentWin: e.target.value })} className="mt-0.5 w-full bg-transparent text-emerald-600 focus:outline-none dark:text-emerald-400" /></div>}
            {goal.openQuestion != null && <div><p className="text-xs uppercase tracking-wider text-muted">Question I&apos;m still trying to answer</p><input value={goal.openQuestion ?? ""} onChange={(e) => set({ openQuestion: e.target.value })} className="mt-0.5 w-full bg-transparent italic text-ink focus:outline-none" /></div>}
          </div>
        </div>
      )}

      {/* THE CAMPAIGN */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">The campaign</h2>
          {goal.fronts.length > 0 && <button onClick={breakIntoPlan} disabled={planning} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><RefreshCw className={cn("h-3.5 w-3.5", planning && "animate-spin")} /> Reassess</button>}
        </div>
        <div className="mt-2"><Field label="Current bottleneck (the real reason it isn't moving)"><input value={goal.bottleneck ?? ""} onChange={(e) => set({ bottleneck: e.target.value })} placeholder="e.g. math timing, not effort" className={inputCls} /></Field></div>
        {goal.fronts.length > 0 && (
          <div className="mt-3 space-y-2">
            {goal.fronts.map((f) => (
              <div key={f.id} className="rounded-xl border bg-surface p-3">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => { updateFront(goal.id, f.id, { status: NEXT_STATUS[f.status] }); refresh(); }} title={f.status} className={cn("h-3 w-3 shrink-0 rounded-full", STATUS_DOT[f.status])} aria-label={`status: ${f.status}`} />
                  <input value={f.title} onChange={(e) => { updateFront(goal.id, f.id, { title: e.target.value }); }} onBlur={refresh} className={cn("min-w-0 flex-1 bg-transparent text-sm font-medium text-ink focus:outline-none", f.status === "won" && "text-muted line-through")} />
                  <button onClick={() => buildSpace(f)} title="Build a space for this" className="shrink-0 text-muted hover:text-orange-500"><Wrench className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { removeFront(goal.id, f.id); refresh(); }} aria-label="Remove front" className="shrink-0 text-muted hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {(f.target || f.current) && <p className="mt-1 pl-[22px] text-xs text-muted">{f.current ? `now ${f.current}` : ""}{f.current && f.target ? " → " : ""}{f.target ? `target ${f.target}` : ""}</p>}
                {f.bottleneck && <p className="mt-1 pl-[22px] text-xs text-muted">bottleneck: {f.bottleneck}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <input value={newFront} onChange={(e) => setNewFront(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newFront.trim()) { addFront(goal.id, newFront); setNewFront(""); refresh(); } }} placeholder="Add a front to win…" className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <Button size="sm" variant="outline" onClick={() => { if (newFront.trim()) { addFront(goal.id, newFront); setNewFront(""); refresh(); } }}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* TOOLKIT — spaces built for this mission */}
      {(goal.fronts.length > 0 || tools.length > 0) && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Toolkit</h2>
            {goal.fronts.length > 0 && (
              <Button size="sm" variant="outline" onClick={buildToolkit} disabled={buildingKit}>
                {buildingKit ? "Building…" : tools.length > 0 ? "Add more tools" : "Build the toolkit"}
              </Button>
            )}
          </div>
          {tools.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {tools.map((w) => (
                <button key={w.id} onClick={() => router.push(`/workspaces/${w.id}`)} className="flex items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 py-2.5 text-left text-sm shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="truncate font-medium text-ink">{w.title}</span>
                  <Wrench className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No tools yet — I can generate a space for each front (a simulator, a tracker, a planner…), or tap the wrench on any front.</p>
          )}
        </div>
      )}

      {/* RECENT OUTCOMES */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">Recent outcomes</h2>
          <div className="space-y-1.5">
            {recent.map((o) => (
              <div key={o.id} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", o.worked === "yes" ? "bg-emerald-500" : o.worked === "no" ? "bg-rose-500" : "bg-orange-400")} />
                <p className="text-muted"><span className="text-ink">{o.move}</span> — {o.result}{o.worked ? ` (${o.worked})` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THE LIVING GOAL */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Priority"><select value={goal.priority} onChange={(e) => set({ priority: e.target.value as Goal["priority"] })} className={inputCls}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label="Momentum"><select value={goal.momentum} onChange={(e) => set({ momentum: e.target.value as Goal["momentum"] })} className={inputCls}>{MOMENTA.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
        <Field label="Status"><select value={goal.status} onChange={(e) => set({ status: e.target.value as Goal["status"] })} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Why it matters"><textarea value={goal.why ?? ""} onChange={(e) => set({ why: e.target.value })} rows={2} placeholder="The real reason this matters to you…" className={inputCls} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Obstacles"><textarea value={obstacles} onChange={(e) => setObstacles(e.target.value)} onBlur={() => set({ obstacles: lines(obstacles) })} rows={3} className={inputCls} /></Field>
        <Field label="What's worked"><textarea value={works} onChange={(e) => setWorks(e.target.value)} onBlur={() => set({ whatWorks: lines(works) })} rows={3} className={inputCls} /></Field>
        <Field label="What hasn't"><textarea value={hasnt} onChange={(e) => setHasnt(e.target.value)} onBlur={() => set({ whatHasnt: lines(hasnt) })} rows={3} className={inputCls} /></Field>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted"><AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> This is a live mission — I reassess it from what actually happens, attack the bottleneck, and bring it up when it needs you.</p>
    </div>
  );
}
