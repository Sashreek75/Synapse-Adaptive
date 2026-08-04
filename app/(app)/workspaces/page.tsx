"use client";

/**
 * SPACES — an implementation detail that occasionally becomes visible.
 *
 * The user doesn't browse a library of tools or operate a builder here. They work
 * with Synapse in conversation; when a space would genuinely help, Synapse offers
 * one, and it shows up here so it can be reopened. If someone never visits this
 * page, that's perfectly fine. So this is just a quiet shelf of what Synapse has
 * made, with a soft pointer back to the conversation — no build box, no example
 * chips, nothing to manage.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Archive, ArchiveRestore, Trash2, Target, MessageCircle } from "lucide-react";
import Link from "next/link";
import { SynapseOrb } from "@/components/synapse/orb";
import { loadWorkspaces, archiveWorkspace, deleteWorkspace, type Workspace } from "@/lib/workspaces";
import { getGoal } from "@/lib/goals";

export default function WorkspacesPage() {
  const router = useRouter();
  const [all, setAll] = useState<Workspace[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const sync = () => setAll(loadWorkspaces());
    sync();
    window.addEventListener("synapse:workspaces", sync);
    return () => window.removeEventListener("synapse:workspaces", sync);
  }, []);

  const list = showArchived ? all.filter((w) => w.archived) : all.filter((w) => !w.archived);
  const archivedCount = all.filter((w) => w.archived).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={40} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your spaces</h1>
          <p className="text-sm text-muted">Places I build when they&apos;ll help. You don&apos;t manage these — just ask me for one in the conversation and it&apos;ll appear here.</p>
        </div>
      </header>

      {archivedCount > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setShowArchived((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <Archive className="h-3.5 w-3.5" /> {showArchived ? "Show active" : `Archived (${archivedCount})`}
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface/50 p-8 text-center text-sm text-muted">
          <LayoutGrid className="mx-auto mb-2 h-5 w-5" />
          {showArchived ? "Nothing archived." : "No spaces yet — and that's fine. When something would help you follow through, I'll make it."}
          {!showArchived && (
            <Link href="/dashboard#conversation" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-500 dark:text-orange-400">
              <MessageCircle className="h-3.5 w-3.5" /> Ask me for one
            </Link>
          )}
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
