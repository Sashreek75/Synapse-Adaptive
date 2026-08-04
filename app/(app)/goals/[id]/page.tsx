"use client";

/**
 * A goal, experienced as a conversation with a coach — NOT a dashboard. The user sees one thing:
 * the single highest-leverage action right now. All the machinery (campaign, fronts, bottleneck,
 * momentum, outcomes) runs invisibly in lib/goals; it surfaces only if the user asks "why this?"
 * or takes it into chat. The user follows through; Synapse manages the system.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Check, RefreshCw, MessageCircle, HelpCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { cn } from "@/lib/utils";
import { getGoal, updateGoal, deleteGoal, decomposeGoal, logOutcome, currentFront, type Goal } from "@/lib/goals";

function nextAction(g: Goal): string | null {
  if (g.nextMove?.title) return g.nextMove.title;
  const f = currentFront(g);
  if (f) return `Make a real start on ${f.title.toLowerCase()}`;
  return null;
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as { id?: string })?.id || "");
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [thinking, setThinking] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    const g = getGoal(id);
    setGoal(g);
    // No next action yet? Work it out quietly, behind the scenes.
    if (g && !g.nextMove && g.fronts.length === 0) {
      setThinking(true);
      decomposeGoal(id).then((u) => { if (u) setGoal(u); }).finally(() => setThinking(false));
    }
  }, [id]);

  const talk = (seed: string) => {
    try { sessionStorage.setItem("synapse.pendingAsk", seed); } catch {}
    router.push("/dashboard#conversation");
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent("synapse:ask")); } catch {} }, 80);
  };
  const rethink = async () => { setThinking(true); try { const u = await decomposeGoal(id); if (u) setGoal(u); } finally { setThinking(false); } };
  const didIt = async () => {
    if (!goal) return;
    logOutcome(id, { move: nextAction(goal) || "that", result: "Done", worked: "yes" });
    setWhyOpen(false);
    await rethink();
  };

  if (goal === undefined) return <div className="py-12 text-center text-sm text-muted">Opening…</div>;
  if (!goal) return (
    <div className="mx-auto max-w-md py-12 text-center">
      <SynapseOrb size={56} className="mx-auto" />
      <h1 className="mt-4 text-xl font-semibold text-ink">I couldn&apos;t find that goal</h1>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="outline" onClick={() => router.push("/goals")}>Your goals</Button>
        <Button onClick={() => router.push("/dashboard")}>Talk to Synapse</Button>
      </div>
    </div>
  );

  const action = nextAction(goal);
  const why = goal.nextMove?.why || (goal.bottleneck ? `The thing most in your way right now is ${goal.bottleneck}. This is the smallest move that loosens it.` : "It's the smallest step that keeps this moving — ask me anything about it in chat.");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => router.push("/goals")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Goals</button>
        <button onClick={() => { deleteGoal(goal.id); router.push("/goals"); }} aria-label="Delete goal" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-3">
        <SynapseOrb size={40} state={thinking ? "thinking" : "idle"} className="shrink-0" />
        <div className="min-w-0">
          <input value={goal.title} onChange={(e) => { const u = updateGoal(id, { title: e.target.value }); if (u) setGoal(u); }}
            className="w-full bg-transparent text-2xl font-semibold tracking-tight text-ink focus:outline-none" />
          {goal.why && <p className="truncate text-sm text-muted">{goal.why}</p>}
        </div>
      </div>

      {/* THE ONE THING */}
      <div className="rounded-2xl border bg-surface p-5 shadow-soft">
        {!action ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{thinking ? "Thinking about what matters most here…" : "Let me work out the best first move for this."}</p>
            {!thinking && <Button size="sm" onClick={rethink}>Figure it out</Button>}
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">What matters most right now</p>
            <p className="mt-1.5 text-lg font-medium leading-snug text-ink">{action}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={didIt} disabled={thinking}><Check className="h-4 w-4" /> I did this</Button>
              <Button size="sm" variant="outline" onClick={rethink} disabled={thinking}><RefreshCw className={cn("h-4 w-4", thinking && "animate-spin")} /> Suggest something else</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              <button onClick={() => setWhyOpen((v) => !v)} className="inline-flex items-center gap-1 text-muted hover:text-ink"><HelpCircle className="h-3.5 w-3.5" /> Why this?</button>
              <button onClick={() => talk(`Let's work on my goal "${goal.title}".${action ? ` You suggested: ${action}.` : ""} Help me actually do it.`)} className="inline-flex items-center gap-1 text-muted hover:text-ink"><MessageCircle className="h-3.5 w-3.5" /> Talk it through</button>
            </div>
            {whyOpen && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{why}</p>}
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <button onClick={() => talk(`What's really holding me back on "${goal.title}"?`)} className="text-xs text-muted hover:text-ink">Ask what&apos;s holding me back</button>
        <button onClick={() => { updateGoal(id, { status: "achieved" }); router.push("/goals"); }} className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-emerald-600 dark:hover:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> I&apos;ve achieved this</button>
      </div>
    </div>
  );
}
