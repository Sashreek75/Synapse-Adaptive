"use client";

/**
 * MOBILE HOME — orb-first, deliberately empty until you speak.
 *
 * On a phone, Synapse IS the screen: a calm orb, a line of greeting, and a text box that grows as you
 * type. Send something and it opens a spacious answer — room to breathe, easy to read — instead of the
 * dense card stack the desktop home shows. The goal/commitment cards still exist, one tap away under
 * "Today", so the default view stays quiet. Same brain as the desktop console (identical context +
 * reply parsing, so it reasons the same and still learns), just a layout built for one thumb.
 *
 * Rendered only below the `sm` breakpoint (the desktop dashboard renders separately). Uses a fixed
 * bottom composer; because its ancestor is `sm:hidden`, the fixed bar disappears on desktop too.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Plus, Sun, ChevronDown } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { RichText } from "@/components/agent/rich-text";
import { GoalsStrip } from "@/components/goals/goals-strip";
import { CommitmentPrompt } from "@/components/dashboard/commitment-prompt";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { sessionOpener } from "@/lib/intelligence";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { goalsContextBlock } from "@/lib/goals";
import { allocationContextBlock, calibrationContextBlock } from "@/lib/allocations";
import { extractRecTag, recordRecommendation, decisionsContextBlock } from "@/lib/decisions";
import { extractPrincipleTag, extractMindShiftTag, addPrinciple, addMindShift, principlesContextBlock } from "@/lib/principles";
import { extractObserveTags } from "@/lib/observations";
import { challengeContextBlock } from "@/lib/coaching";
import { evidenceContextBlock } from "@/lib/evidence";
import { pftContextBlock } from "@/lib/pft";
import { activityContextBlock } from "@/lib/activity";
import { readMomentum } from "@/lib/momentum";
import { loadCommitments, commitmentAwaitingReport, openCommitment } from "@/lib/commitments";

type Msg = { id: string; role: "user" | "synapse"; text: string };

export function MobileHome() {
  const { profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked, mind, addObservation } = useHealth();
  const { plan: tier } = useSubscription();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showToday, setShowToday] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const opener = useMemo(
    () => sessionOpener(profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked),
    [profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked],
  );
  const name = profile.displayName || "there";
  const insight = opener.highlights.find((h) => h.tone !== "neutral") ?? opener.highlights[0];

  // Same intelligence the desktop console uses (trimmed of desktop-only tooling), so replies reason
  // identically. A phone-specific instruction keeps them short and skimmable.
  const context = useMemo(() => [
    `Name: ${profile.displayName || "User"}`,
    goalsContextBlock(),
    allocationContextBlock(),
    calibrationContextBlock(),
    challengeContextBlock(),
    decisionsContextBlock(),
    principlesContextBlock(),
    evidenceContextBlock(checkIns),
    pftContextBlock(),
    (mind.trajectory?.statement || profile.definitionOfBetter) && `Working to become: ${mind.trajectory?.statement || profile.definitionOfBetter} (the objective — weigh advice against whether it moves them toward this).`,
    profile.aiSummary && `Profile: ${profile.aiSummary}`,
    profile.primaryChallenge && `Hardest right now: ${profile.primaryChallenge}`,
    (() => { const m = readMomentum(loadCommitments(), []); return m.observation ? `Relationship trend: ${m.observation}` : ""; })(),
    activityContextBlock(),
    (() => {
      const aw = commitmentAwaitingReport();
      if (aw) return `An open promise they made to themselves last time: "${aw.text}". Gently ask whether it happened before moving on.`;
      const oc = openCommitment();
      return oc ? `Today's promise to themselves: "${oc.text}".` : "";
    })(),
    "You are on their PHONE. Keep replies especially tight and skimmable: lead with the answer, short paragraphs, no walls of text, no headers.",
  ].filter(Boolean).join("\n"), [profile, mind, checkIns]);

  // Grow the composer with the text, up to a cap, then it scrolls.
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(150, el.scrollHeight)}px`; }, [input]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, sending]);

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setInput("");
    setMsgs((m) => [...m, { id: `u_${Date.now()}`, role: "user", text: q }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier, context }) });
      const data = await res.json();
      const rec = extractRecTag(String(data?.content ?? ""));
      if (rec.text) { try { recordRecommendation(rec.text, rec.goalId); } catch {} }
      const pr = extractPrincipleTag(rec.cleaned);
      if (pr.text) { try { addPrinciple(pr.text); } catch {} }
      const ms = extractMindShiftTag(pr.cleaned);
      if (ms.to) { try { addMindShift({ from: ms.from ?? "", to: ms.to }); } catch {} }
      const obs = extractObserveTags(ms.cleaned);
      for (const o of obs.observations) { try { addObservation(o.patternKey, o.note); } catch {} }
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, role: "synapse", text: obs.cleaned || "I'm here — tell me a little more." }]);
    } catch {
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, role: "synapse", text: "I couldn't reach my thoughts just then — give me another try in a moment." }]);
    } finally {
      setSending(false);
    }
  }

  const talking = msgs.length > 0;

  return (
    <div className="pb-32">
      {/* Header appears only once you're in conversation, so the idle screen stays pure. */}
      {talking && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SynapseOrb size={26} state={sending ? "thinking" : "idle"} />
            <span className="text-sm font-semibold text-ink">Synapse</span>
          </div>
          <button onClick={() => setMsgs([])} className="inline-flex items-center gap-1 rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      )}

      {!talking ? (
        /* IDLE — the orb, a greeting, and an invitation. Nothing else competes. */
        <div className="flex min-h-[calc(100dvh-15rem)] flex-col items-center justify-center gap-5 text-center">
          <SynapseOrb size={104} />
          <div>
            <p className="text-sm text-muted">{copy.greeting(name)}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-ink">{opener.lead}</h1>
            {insight && <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{insight.text}</p>}
          </div>
          <p className="text-sm text-muted">Ask me anything, or tell me what you&apos;re working on.</p>
        </div>
      ) : (
        /* ANSWER SCREEN — user turns are small; Synapse's replies get room to breathe. */
        <div className="space-y-6">
          {msgs.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy-900 px-3.5 py-2 text-sm leading-relaxed text-white">{m.text}</p>
              </div>
            ) : (
              <div key={m.id}><RichText text={m.text} className="text-[15px] leading-relaxed" /></div>
            ),
          )}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="sa-typing"><span /><span /><span /></span> thinking…
            </div>
          )}
        </div>
      )}

      {/* TODAY — the cards, one tap away, so they never clutter the default screen. */}
      <div className={cn("mt-8", talking && "mt-10")}>
        <button onClick={() => setShowToday((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border bg-surface/60 px-4 py-3 text-sm text-muted transition hover:bg-surface-2">
          <span className="inline-flex items-center gap-2"><Sun className="h-4 w-4 text-orange-500" /> Today — your goal &amp; next step</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showToday && "rotate-180")} />
        </button>
        {showToday && (
          <div className="mt-3 space-y-3">
            <GoalsStrip />
            <CommitmentPrompt />
            {!dailyDoneToday && (
              <Link href="/daily" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-surface/60 px-4 py-3 text-sm text-muted transition hover:bg-surface-2">
                <span className="inline-flex items-center gap-2"><Sun className="h-4 w-4 text-orange-500" /> A minute on today&apos;s snapshot</span>
                <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-muted" />
              </Link>
            )}
          </div>
        )}
      </div>

      <div ref={endRef} />

      {/* COMPOSER — pinned to the bottom, grows as you type. Hidden on desktop via the sm:hidden ancestor. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t glass px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1}
            placeholder="Talk to Synapse…"
            className="max-h-[150px] min-h-[2.75rem] flex-1 resize-none rounded-2xl border bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500 text-white transition disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
