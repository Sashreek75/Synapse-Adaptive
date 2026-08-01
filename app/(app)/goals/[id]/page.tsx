"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Zap, CheckCircle2, Plus, Wrench, Flag } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import {
  getGoal, updateGoal, deleteGoal, decomposeGoal, addFront, updateFront, removeFront, logProgress,
  PRIORITIES, MOMENTA, STATUSES, type Goal, type Front, type FrontStatus,
} from "@/lib/goals";
import { createWorkspaceFromRequest } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none";
const NEXT_STATUS: Record<FrontStatus, FrontStatus> = { open: "active", active: "won", won: "paused", paused: "open" };
const STATUS_DOT: Record<FrontStatus, string> = { open: "bg-line", active: "bg-orange-500", won: "bg-emerald-500", paused: "bg-navy-300" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>{children}</div>;
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as { id?: string })?.id || "");
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [obstacles, setObstacles] = useState("");
  const [works, setWorks] = useState("");
  const [hasnt, setHasnt] = useState("");
  const [newFront, setNewFront] = useState("");
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    const g = getGoal(id);
    setGoal(g);
    if (g) { setObstacles(g.obstacles.join("\n")); setWorks(g.whatWorks.join("\n")); setHasnt(g.whatHasnt.join("\n")); }
  }, [id]);

  const refresh = () => setGoal(getGoal(id));
  const set = (patch: Partial<Goal>) => { const g = updateGoal(id, patch); if (g) setGoal(g); };
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const breakIntoPlan = async () => { setPlanning(true); try { const g = await decomposeGoal(id); if (g) setGoal(g); } finally { setPlanning(false); } };
  const buildSpace = async (f: Front) => {
    const bn = f.bottleneck || (goal && goal.bottleneck);
    const req = `Help me make progress on "${f.title}"${goal ? ` for my goal "${goal.title}"` : ""}${bn ? `. The bottleneck is ${bn}.` : "."}`;
    const ws = await createWorkspaceFromRequest(req, { goal: goal?.title });
    router.push(`/workspaces/${ws.id}`);
  };

  if (goal === undefined) return <div className="py-12 text-center text-sm text-muted">Opening…</div>;
  if (!goal) return (
    <div className="mx-auto max-w-md py-12 text-center">
      <SynapseOrb size={56} className="mx-auto" />
      <h1 className="mt-4 text-xl font-semibold text-ink">I couldn&apos;t find that goal</h1>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="outline" onClick={() => router.push("/goals")}>All goals</Button>
        <Button onClick={() => router.push("/dashboard")}>Talk to Synapse</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => router.push("/goals")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Goals</button>
        <button onClick={() => { deleteGoal(goal.id); router.push("/goals"); }} aria-label="Delete goal" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Trash2 className="h-4 w-4" /></button>
      </div>

      <input value={goal.title} onChange={(e) => set({ title: e.target.value })} className="w-full bg-transparent text-2xl font-semibold tracking-tight text-ink focus:outline-none" />

      {/* NEXT CRITICAL MOVE — the campaign feels alive */}
      {goal.nextMove && (
        <div className="rounded-2xl border border-orange-300/50 bg-orange-500/5 p-4">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400"><Zap className="h-3.5 w-3.5" /> Next critical move</p>
          <p className="mt-1 text-lg font-semibold text-ink">{goal.nextMove.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {[goal.nextMove.when, goal.nextMove.minutes ? `${goal.nextMove.minutes} min` : ""].filter(Boolean).join(" · ")}
          </p>
          {goal.nextMove.why && <p className="mt-2 text-sm text-muted"><span className="font-medium text-ink">Why: </span>{goal.nextMove.why}</p>}
          <Button size="sm" className="mt-3" onClick={() => { logProgress(goal.id); refresh(); }}>I did this <CheckCircle2 className="h-4 w-4" /></Button>
        </div>
      )}

      {/* THE CAMPAIGN */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">The campaign</h2>
          {goal.fronts.length === 0 && <Button size="sm" variant="outline" onClick={breakIntoPlan} disabled={planning}>{planning ? "Mapping…" : "Break into a plan"}</Button>}
        </div>

        <div className="mt-2">
          <Field label="Current bottleneck (the real reason it isn't moving)">
            <input value={goal.bottleneck ?? ""} onChange={(e) => set({ bottleneck: e.target.value })} placeholder="e.g. math timing, not effort" className={inputCls} />
          </Field>
        </div>

        {goal.fronts.length > 0 && (
          <div className="mt-3 space-y-2">
            {goal.fronts.map((f) => (
              <div key={f.id} className="rounded-xl border bg-surface p-3">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => { updateFront(goal.id, f.id, { status: NEXT_STATUS[f.status] }); refresh(); }} title={f.status}
                    className={cn("h-3 w-3 shrink-0 rounded-full", STATUS_DOT[f.status])} aria-label={`status: ${f.status}`} />
                  <input value={f.title} onChange={(e) => { updateFront(goal.id, f.id, { title: e.target.value }); }} onBlur={refresh}
                    className={cn("min-w-0 flex-1 bg-transparent text-sm font-medium text-ink focus:outline-none", f.status === "won" && "text-muted line-through")} />
                  <button onClick={() => buildSpace(f)} title="Build a space for this" className="shrink-0 text-muted hover:text-orange-500"><Wrench className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { removeFront(goal.id, f.id); refresh(); }} aria-label="Remove front" className="shrink-0 text-muted hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {(f.target || f.current) && (
                  <p className="mt-1 pl-[22px] text-xs text-muted">{f.current ? `now ${f.current}` : ""}{f.current && f.target ? " → " : ""}{f.target ? `target ${f.target}` : ""}</p>
                )}
                {f.bottleneck && <p className="mt-1 pl-[22px] text-xs text-muted">bottleneck: {f.bottleneck}</p>}
                {f.nextMove && <p className="mt-0.5 pl-[22px] text-xs text-muted">next: {f.nextMove}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <input value={newFront} onChange={(e) => setNewFront(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newFront.trim()) { addFront(goal.id, newFront); setNewFront(""); refresh(); } }}
            placeholder="Add a front to win…" className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <Button size="sm" variant="outline" onClick={() => { if (newFront.trim()) { addFront(goal.id, newFront); setNewFront(""); refresh(); } }}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* THE LIVING GOAL */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Priority"><select value={goal.priority} onChange={(e) => set({ priority: e.target.value as Goal["priority"] })} className={inputCls}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label="Momentum"><select value={goal.momentum} onChange={(e) => set({ momentum: e.target.value as Goal["momentum"] })} className={inputCls}>{MOMENTA.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
        <Field label="Status"><select value={goal.status} onChange={(e) => set({ status: e.target.value as Goal["status"] })} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Why it matters"><textarea value={goal.why ?? ""} onChange={(e) => set({ why: e.target.value })} rows={2} placeholder="The real reason this matters to you…" className={inputCls} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timeline"><input value={goal.timeline ?? ""} onChange={(e) => set({ timeline: e.target.value })} placeholder="By when?" className={inputCls} /></Field>
        <Field label="Current strategy"><input value={goal.strategy ?? ""} onChange={(e) => set({ strategy: e.target.value })} placeholder="The approach right now…" className={inputCls} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Obstacles"><textarea value={obstacles} onChange={(e) => setObstacles(e.target.value)} onBlur={() => set({ obstacles: lines(obstacles) })} rows={3} className={inputCls} /></Field>
        <Field label="What's worked"><textarea value={works} onChange={(e) => setWorks(e.target.value)} onBlur={() => set({ whatWorks: lines(works) })} rows={3} className={inputCls} /></Field>
        <Field label="What hasn't"><textarea value={hasnt} onChange={(e) => setHasnt(e.target.value)} onBlur={() => set({ whatHasnt: lines(hasnt) })} rows={3} className={inputCls} /></Field>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted"><Flag className="h-3.5 w-3.5 text-orange-500" /> This is a live campaign — I update it as we talk, attack the bottleneck, and bring it up when it needs you.</p>
    </div>
  );
}
