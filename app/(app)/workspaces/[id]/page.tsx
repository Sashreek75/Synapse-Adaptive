"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { WorkspaceView } from "@/components/workspaces/workspace-view";
import { getWorkspace, deleteWorkspace, type Workspace } from "@/lib/workspaces";

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as { id?: string })?.id || "");
  const [ws, setWs] = useState<Workspace | null | undefined>(undefined);

  useEffect(() => { setWs(getWorkspace(id)); }, [id]);

  if (ws === undefined) return <div className="py-12 text-center text-sm text-muted">Opening your space…</div>;
  if (!ws) return (
    <div className="mx-auto max-w-md py-12 text-center">
      <SynapseOrb size={56} className="mx-auto" />
      <h1 className="mt-4 text-xl font-semibold text-ink">I couldn&apos;t find that space</h1>
      <p className="mt-2 text-sm text-muted">It may have been removed. You can always ask me to build a new one.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="outline" onClick={() => router.push("/workspaces")}>All spaces</Button>
        <Button onClick={() => router.push("/dashboard")}>Talk to Synapse</Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <button onClick={() => router.push("/workspaces")} className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Spaces</button>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{ws.title}</h1>
          {ws.purpose && <p className="mt-0.5 text-sm text-muted">{ws.purpose}</p>}
        </div>
        <button onClick={() => { deleteWorkspace(ws.id); router.push("/workspaces"); }} aria-label="Delete space"
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Trash2 className="h-4 w-4" /></button>
      </div>
      <WorkspaceView ws={ws} />
    </div>
  );
}
