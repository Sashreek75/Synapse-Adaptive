"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Target, Compass } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { activeGoals, addGoal, daysSinceProgress, type Goal } from "@/lib/goals";

/**
 * THIS WEEK'S NEEDLE — the 1–3 goals that actually deserve the user's energy this week, chosen by
 * Synapse (the model) from the goals + what the user told it, with a short reasoned note in its own
 * voice. It is compression, not an echo: it only appears when there are 2+ goals to prioritise, and
 * it's computed once per week (cached) so it's stable and instant. No new fields, scores, or ranking
 * controls for the user to manage — Synapse owns the judgment.
 */
type Focus = { ids: string[]; note: string };

const PRI: Record<string, number> = { primary: 3, high: 2, medium: 1, someday: 0 };
const MOM: Record<string, number> = { building: 2, steady: 1.5, new: 1, slipping: 0.5, stalled: 0 };
function score(g: Goal): number {
  const d = daysSinceProgress(g);
  const recency = d == null ? 0.5 : d <= 2 ? 1 : d <= 7 ? 0.3 : -0.5;
  return (PRI[g.priority] ?? 0) * 10 + (MOM[g.momentum] ?? 0) * 2 + recency;
}
/** Quiet fallback when the model can't be reached: pick the top 1–2, and say nothing we can't back up. */
function deterministicFocus(goals: Goal[]): Focus {
  const ranked = [...goals].sort((a, b) => score(b) - score(a));
  return { ids: ranked.slice(0, goals.length >= 4 ? 2 : 1).map((g) => g.id), note: "" };
}
function weekKey(): string {
  const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d.toISOString().slice(0, 10);
}
function truncate(s: string, n = 44): string { return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

export default function GoalsPage() {
  const router = useRouter();
  const { mind, profile } = useHealth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);
  const lastSig = useRef<string>("");

  useEffect(() => {
    const sync = () => setGoals(activeGoals());
    sync();
    window.addEventListener("synapse:goals", sync);
    return () => window.removeEventListener("synapse:goals", sync);
  }, []);

  const northStar = mind?.trajectory?.statement?.trim() || "";

  const personCtx = useMemo(() => {
    const traj = mind?.trajectory?.statement || profile?.definitionOfBetter;
    const parts: string[] = [];
    if (traj) parts.push(`Working toward: ${traj}.`);
    if (profile?.primaryChallenge && profile.primaryChallenge !== traj) parts.push(`Hardest right now: ${profile.primaryChallenge}.`);
    if (profile?.aiSummary) parts.push(String(profile.aiSummary));
    return parts.join(" ").slice(0, 600);
  }, [mind, profile]);

  // Compute the week's needle once per week (or when the goals materially change), then cache it.
  useEffect(() => {
    if (goals.length < 2) { setFocus(null); return; }
    const sig = `${weekKey()}::${goals.map((g) => `${g.id}:${g.momentum}`).sort().join(",")}`;
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    try {
      const c = JSON.parse(localStorage.getItem("synapse.goals.focus.v1") || "null");
      if (c && c.sig === sig && c.focus) { setFocus(c.focus as Focus); return; }
    } catch {}
    let cancelled = false;
    setFocusLoading(true);
    (async () => {
      let val: Focus | null = null;
      try {
        const res = await fetch("/api/goal-focus", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            goals: goals.map((g) => ({ id: g.id, title: g.title, priority: g.priority, momentum: g.momentum, daysSince: daysSinceProgress(g) })),
            context: personCtx,
          }),
        });
        const d = await res.json();
        if (d && Array.isArray(d.focus) && d.focus.length) val = { ids: d.focus as string[], note: typeof d.note === "string" ? d.note : "" };
      } catch {}
      if (cancelled) return;
      const resolved = val ?? deterministicFocus(goals);
      setFocus(resolved);
      try { localStorage.setItem("synapse.goals.focus.v1", JSON.stringify({ sig, focus: resolved })); } catch {}
    })().finally(() => { if (!cancelled) setFocusLoading(false); });
    return () => { cancelled = true; };
  }, [goals, personCtx]);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    addGoal({ title: t, why: why.trim() || undefined });
    setTitle(""); setWhy("");
  };

  const focusGoals = focus ? focus.ids.map((id) => goals.find((g) => g.id === id)).filter(Boolean) as Goal[] : [];
  const showNeedle = goals.length >= 2 && (focusGoals.length > 0 || focusLoading);
  const parked = goals.length - focusGoals.length;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={40} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your goals</h1>
          <p className="text-sm text-muted">Jot down what you want to achieve. I&apos;ll figure out how — and what to do first.</p>
        </div>
      </header>

      {/* The long-term aspiration is the OVERHEAD — who you're becoming — not a goal to check off.
          It frames the concrete short-term goals below, which are how you actually develop it. */}
      {northStar && (
        <div className="rounded-xl border border-dashed bg-surface/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Who you&apos;re becoming</p>
          <p className="mt-0.5 text-sm leading-snug text-ink">{northStar}</p>
          <p className="mt-1 text-xs text-muted">This is the long game — you develop it through the goals below, not by checking it off.</p>
        </div>
      )}

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

      {/* THIS WEEK'S NEEDLE — Synapse's judgment about where the week's energy should go. */}
      {showNeedle && (
        <div className="rounded-2xl border border-orange-200/50 bg-gradient-to-br from-orange-50 to-surface p-4 shadow-soft dark:border-orange-500/20 dark:from-orange-500/5 dark:to-surface">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            <Compass className="h-3.5 w-3.5" /> This week&apos;s needle
          </p>
          {focusGoals.length > 0 ? (
            <>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {focusGoals.map((g) => (
                  <button key={g.id} onClick={() => router.push(`/goals/${g.id}`)}
                    className="rounded-full border border-orange-300/60 bg-orange-500/10 px-3 py-1 text-sm font-medium text-ink transition hover:bg-orange-500/15">
                    {truncate(g.title)}
                  </button>
                ))}
              </div>
              {focus?.note
                ? <p className="mt-2.5 text-sm leading-relaxed text-muted">{focus.note}</p>
                : <p className="mt-2.5 text-sm leading-relaxed text-muted">Where I&apos;d put your energy this week — open one and let&apos;s make the next move.</p>}
              {parked > 0 && <p className="mt-1 text-xs text-muted">The other {parked === 1 ? "goal" : `${parked} goals`} can wait — that&apos;s deliberate, not neglect.</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Thinking about where your week should go…</p>
          )}
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
