"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { loadWorkspaces, createWorkspaceFromRequest, type Workspace } from "@/lib/workspaces";

const EXAMPLES = ["An SAT mistake tracker", "A mock interview", "A weekly planning board", "A space to analyze my writing"];

export default function WorkspacesPage() {
  const router = useRouter();
  const { profile, mind } = useHealth();
  const [list, setList] = useState<Workspace[]>([]);
  const [req, setReq] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setList(loadWorkspaces());
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

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={40} state={busy ? "thinking" : "idle"} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your spaces</h1>
          <p className="text-sm text-muted">Tell me what you need and I&apos;ll build it — a tracker, a board, a place to practice.</p>
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

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface/50 p-8 text-center text-sm text-muted">
          <LayoutGrid className="mx-auto mb-2 h-5 w-5" /> No spaces yet. Ask me for one above — or just say &ldquo;build me a…&rdquo; anywhere.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((w) => (
            <button key={w.id} onClick={() => router.push(`/workspaces/${w.id}`)}
              className="group rounded-2xl border bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">{w.title}</h3>
                <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
              {w.purpose && <p className="mt-1 text-sm text-muted">{w.purpose}</p>}
              <p className="mt-3 text-[11px] text-muted">{w.blocks.length} block{w.blocks.length === 1 ? "" : "s"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
