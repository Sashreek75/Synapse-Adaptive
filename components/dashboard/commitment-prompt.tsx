"use client";

/**
 * THE COMMITMENT PROMPT — the "memory with expectations" moment on Home.
 *
 * When you made a promise on a prior session and it is still open, Synapse leads with
 * it BEFORE anything else: "Yesterday you committed to X. Did it happen?" Every answer
 * is honoured explicitly — done, partly (carry the rest), or not yet (still on it /
 * make it smaller / let it go with a reason). Nothing silently disappears. When there
 * is no open promise, it reflects a real win, or — if momentum is slipping — leans in.
 *
 * Behavioral layer only; the intelligence engine is untouched.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Sparkles, Flag, Scissors, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { loadHistory } from "@/lib/focus-session";
import {
  commitmentAwaitingReport, resolveCommitment, recommitToday, replaceCommitment,
  winsLine, driftLine, loadCommitments, type Commitment,
} from "@/lib/commitments";
import { readMomentum, type MomentumRead } from "@/lib/momentum";

type Phase = "ask" | "partly" | "notyet";

export function CommitmentPrompt() {
  const { mind } = useHealth();
  const [c, setC] = useState<Commitment | null>(null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [note, setNote] = useState("");
  const [smaller, setSmaller] = useState("");
  const [smallerOpen, setSmallerOpen] = useState(false);
  const [ack, setAck] = useState<string | null>(null);
  const [wins, setWins] = useState<string | null>(null);
  const [drift, setDrift] = useState<string | null>(null);
  const [mom, setMom] = useState<MomentumRead | null>(null);

  const refresh = useCallback(() => {
    const list = loadCommitments();
    setC(commitmentAwaitingReport(list));
    setWins(winsLine(list, loadHistory()));
    setDrift(driftLine(list));
    setMom(readMomentum(list, loadHistory()));
  }, []);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("synapse:commitments", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("synapse:commitments", h); window.removeEventListener("storage", h); };
  }, [refresh]);

  const towards = mind?.trajectory?.statement;

  // Acknowledgement after a resolution (persists even as the pending prompt clears).
  if (ack) {
    return (
      <div className="sa-rise flex items-start gap-3 rounded-3xl border bg-surface/80 p-4 shadow-soft">
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm leading-relaxed text-ink">{ack}</p>
      </div>
    );
  }

  if (!c) {
    if (mom && mom.observation) {
      const lean = mom.kind === "stuck" || mom.kind === "fracturing" || mom.kind === "shrinking";
      return lean ? (
        <Link href="/dashboard#conversation" className="sa-rise flex items-start gap-3 rounded-3xl border border-amber-300/50 bg-amber-50 p-4 shadow-soft transition hover:shadow-lift dark:border-amber-500/25 dark:bg-amber-500/10">
          <SynapseOrb size={22} className="mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed text-ink">{mom.observation}</p>
          <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted" />
        </Link>
      ) : (
        <div className="sa-rise flex items-start gap-3 rounded-3xl border bg-surface/80 p-4 shadow-soft">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-sm leading-relaxed text-ink">{mom.observation}</p>
        </div>
      );
    }
    if (wins) {
      return (
        <div className="sa-rise flex items-start gap-3 rounded-3xl border bg-surface/80 p-4 shadow-soft">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p className="text-sm leading-relaxed text-ink">{wins}</p>
        </div>
      );
    }
    if (drift) {
      return (
        <Link href="/dashboard#conversation" className="sa-rise flex items-start gap-3 rounded-3xl border border-amber-300/50 bg-amber-50 p-4 shadow-soft transition hover:shadow-lift dark:border-amber-500/25 dark:bg-amber-500/10">
          <SynapseOrb size={22} className="mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed text-ink">{drift}</p>
          <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted" />
        </Link>
      );
    }
    return null;
  }

  const daysAgo = Math.max(1, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 864e5));
  const whenWord = daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;

  function finish(text: string) { setAck(text); }

  return (
    <div className="sa-rise overflow-hidden rounded-3xl border bg-surface shadow-soft">
      <div className="mesh p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <SynapseOrb size={34} className="shrink-0" />
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            <Flag className="h-3.5 w-3.5" /> A promise you made
          </p>
        </div>

        <p className="mt-3 text-ink">{whenWord} you committed to: <span className="font-semibold">{c.text}</span></p>

        {phase === "ask" && (
          <>
            <p className="mt-1 text-sm text-muted">Did it happen?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { resolveCommitment(c.id, "done"); finish("Love that — you did the thing you said mattered. That is exactly how it compounds."); }}>
                <Check className="h-4 w-4" /> Yes
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPhase("partly"); setNote(""); }}>Partly</Button>
              <Button size="sm" variant="outline" onClick={() => { setPhase("notyet"); setNote(""); }}>Not yet</Button>
            </div>
          </>
        )}

        {phase === "partly" && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">Good — progress counts. Anything left on it?</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's left? (optional)"
              className="w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { recommitToday(c.id, note.trim() ? `partly done — ${note.trim()}` : "partly done, carrying the rest"); finish("Carried over — let's finish what's left today. Progress is progress."); }}>
                <Repeat2 className="h-4 w-4" /> Carry the rest into today
              </Button>
              <Button size="sm" variant="outline" onClick={() => { resolveCommitment(c.id, "done", { note: note.trim() || undefined }); finish("Good enough — that counts. Onward."); }}>Call it done</Button>
            </div>
          </div>
        )}

        {phase === "notyet" && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">No judgment — this is how it goes. What got in the way?</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What got in the way? (optional)"
              className="w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
            {smallerOpen ? (
              <div className="flex items-center gap-2">
                <input value={smaller} autoFocus onChange={(e) => setSmaller(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && smaller.trim()) { replaceCommitment(c.id, smaller.trim(), note.trim() ? `made smaller — ${note.trim()}` : "made smaller to protect momentum", towards); finish("Smaller, and doable. That's how momentum starts — I'll hold you to this one."); } }}
                  placeholder="The smaller version you'll actually do…"
                  className="min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
                <Button size="sm" disabled={!smaller.trim()} onClick={() => { replaceCommitment(c.id, smaller.trim(), note.trim() ? `made smaller — ${note.trim()}` : "made smaller to protect momentum", towards); finish("Smaller, and doable. That's how momentum starts — I'll hold you to this one."); }}>Set</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { recommitToday(c.id, note.trim() || undefined); finish("Still ours to finish — it's today's again. I've got it on the list with you."); }}>
                  <Repeat2 className="h-4 w-4" /> Still on it today
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSmallerOpen(true)}><Scissors className="h-4 w-4" /> Make it smaller</Button>
                <Button size="sm" variant="ghost" onClick={() => { resolveCommitment(c.id, "dropped", { reason: note.trim() || "let go on purpose" }); finish("Okay — let go, on purpose. That's a decision, not a failure. We'll aim somewhere better."); }}>Let it go</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
