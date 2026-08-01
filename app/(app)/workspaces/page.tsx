"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Sparkles, Archive, ArchiveRestore, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { loadWorkspaces, activeWorkspaces, archiveWorkspace, deleteWorkspace, createWorkspaceFromRequest, type Workspace } from "@/lib/workspaces";
import { getGoal } from "@/lib/goals";

const EXAMPLES = ["An SAT mistake tracker", "A mock interview", "A weekly planning board", "A space to analyze my writing"];

export default function WorkspacesPage() {
  const router = useRouter();
  const { profile, mind } = useHealth();
  const [all, setAll] = useState<Workspace[]>([]);
  const [req, setReq] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const sync = () => setAll(loadWorkspaces());
    sync();
    window.addEventListener("synapse:workspaces", sync);
    return () => window.removeEventListener("synapse:workspaces", sync);
  }, []);

  const build = async (request: string) => {
    const r = request.trim();
    if (!r || busy) return;
    setBusy(true);
    try {
      const ws = await createWorkspaceFromRequest(r, { goal: mind?.trajectory?.statement, goals: profile.goals });
      router.push(`/workspaces/${ws.id}`);
    } finally { setBusy(false); }
  };

  const list = showArchived ? all.filter((w) => w.archived) : all.filter((w) => !w.archived);
  const archivedCount = all.filter((w) => w.archived).length;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={40} state={busy ? "thinking" : "idle"} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your spaces</h1>
          <p className="text-sm text-muted">Tools I build when they help — reopenable, attachable to a goal, archivable like documents.</p>
        </div>
      </header>

      <div className="rounded-2xl border bg-surface p-4 shadow-soft">
        <div className="flex gap-2">
          <input value={req} onChange={(e) => setReq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && build(req)}
            placeholder="Describe a space you want..." className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <Button onClick={() => build(req)} disabled={busy || !req.trim()}>{busy ? "Building..." : "Build it"} <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => build(e)} disabled={busy}
              className="rounded-full border border-dashed bg-surface px-3 py-1 text-xs text-muted transition hover:border-solid hover:text-ink disabled:opacity-50">
              <Sparkles className="mr-1 inline h-3 w-3 text-orange-500" />{e}
            </button>
          ))}
        </div>
      </div>

      {archivedCount > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setShowArchived((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <Archive className="h-3.5 w-3.5" /> {showArchived ? `Show active` : `Archived (${archivedCount})`}
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface/50 p-8 text-center text-sm text-muted">
          <LayoutGrid className="mx-auto mb-2 h-5 w-5" /> {showArchived ? "Nothing archived." : "No spaces yet. Ask me for one above — or just say “build me a…” anywhere."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((w) => {
            const goal = w.goalId ? getGoal(w.goalId) : null;
            return (
              <div key={w.id} className="group rounded-2xl border bg-surface p-5 shadow-soft transition hover:shadow-lift">
                <button onClick={() => router.push(`/workspaces/${w.id}`)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-ink">{w.title}</h3>
                    <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                  {w.purpose && <p className="mt-1 text-sm text-muted">{w.purpose}</p>}
                </button>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    {goal && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5"><Target className="h-3 w-3 text-orange-500" />{goal.title}</span>}
                    <span>{new Date(w.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => archiveWorkspace(w.id, !w.archived)} title={w.archived ? "Restore" : "Archive"} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                      {w.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => deleteWorkspace(w.id)} title="Delete" className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
