"use client";

/**
 * TALK IT THROUGH — the conversational Daily Snapshot.
 *
 * Same outcome as the quick check-in (today's understanding, evidence, memory, and a
 * next step) — gathered in conversation instead of a form. It IS today's snapshot: on the
 * first real message it records the day (once) and feeds what's said into the same
 * context-note channel the quick path uses. If today's snapshot already exists, this
 * enriches it rather than creating a second one. Reuses /api/chat; engine untouched.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { loadCommitments } from "@/lib/commitments";
import { loadHistory } from "@/lib/focus-session";
import { readMomentum } from "@/lib/momentum";
import { convictionContextLines } from "@/lib/convictions";
import { witness, activityContextBlock } from "@/lib/activity";
import { CommitmentCapture } from "@/components/daily/daily-checkin";
import { cn } from "@/lib/utils";

interface Msg { id: string; from: "you" | "synapse"; text: string }
const NL2 = String.fromCharCode(10);

export function TalkSnapshot({ enrich = false }: { enrich?: boolean }) {
  const router = useRouter();
  const { addCheckIn, addContextNote, dailyDoneToday, mind } = useHealth();
  const { plan: tier } = useSubscription();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  const marked = useRef(false);
  const noted = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([{ id: "intro", from: "synapse", text: enrich
      ? "We've already captured today's snapshot — but I'm here. What's happened since? Start anywhere."
      : "Let's take today in. How did it actually go? Start anywhere — there's no wrong place to begin." }]);
  }, [enrich]);

  const scroll = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m.filter((x) => x.id !== "intro"), { id: `u_${Date.now()}`, from: "you", text: q }]);
    setInput(""); setBusy(true); scroll();

    if (preGate(q).triggered) {
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: CRISIS_RESPONSE }]);
      setBusy(false); scroll(); return;
    }
    // This IS today's snapshot — record it once (never a second one if today is already done).
    if (!marked.current) {
      marked.current = true;
      try { witness("snapshot", q); } catch {}
      if (!dailyDoneToday) { try { addCheckIn({ date: new Date().toISOString(), kind: "daily", metrics: {}, note: "Talked it through" }); } catch {} }
    }
    // Feed understanding + memory through the same channel the quick path uses (capped).
    if (noted.current < 6) { noted.current += 1; try { addContextNote(noted.current === 1 ? "Talked through today" : "More from today's reflection", q); } catch {} }

    try {
      const now = new Date().toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      const goal = mind?.trajectory?.statement;
      const mom = readMomentum(loadCommitments(), loadHistory());
      const transcript = msgs.filter((x) => x.id !== "intro").slice(-6).map((x) => (x.from === "you" ? "User: " : "Synapse: ") + x.text).join(NL2);
      const ctx = [
        "Right now it is " + now + ".",
        "This is the user's DAILY SNAPSHOT, done by talking instead of filling a form. Same outcome as the quick check-in — today's understanding — just gathered in conversation.",
        enrich ? "Today's snapshot was already captured earlier; you are enriching it with what has happened since. Do not restart it." : "",
        goal ? "They are working to become: " + goal + "." : "",
        "Help them think clearly about today: gently uncover what happened, why it mattered, what they are actually struggling with, what they are learning, what they want tomorrow to look like, and — only once you genuinely understand — one meaningful next step.",
        "Do NOT interrogate: at most one warm question at a time. Do NOT rush to advice; understand first, help them move second. Keep replies short and human.",
        activityContextBlock(),
        ...convictionContextLines(),
        mom.observation ? ("Where their momentum is trending: " + mom.observation) : "",
        transcript ? ("Recent exchange:" + NL2 + transcript) : "",
      ].filter(Boolean).join(NL2);
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier, context: ctx }) });
      const data = await res.json();
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: (data && data.content) || "I'm with you — say a bit more?" }]);
    } catch {
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: "I couldn't reach my reasoning just now — give it a second and try again." }]);
    } finally { setBusy(false); scroll(); }
  }

  const started = msgs.some((m) => m.from === "you");

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-md flex-col">
      <header className="sa-rise mb-3 flex items-center gap-3">
        <SynapseOrb size={40} state={busy ? "thinking" : "idle"} className="shrink-0" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Today&apos;s snapshot</h1>
          <p className="text-xs text-muted">Talking it through — take as long as you need.</p>
        </div>
      </header>

      <Card className="sa-rise-2 flex min-h-0 flex-1 flex-col"><CardBody className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {msgs.slice(-24).map((m) => (
            <div key={m.id} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
              <p className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed", m.from === "you" ? "bg-navy-900 text-white" : "bg-surface-2 text-ink")}>{m.text}</p>
            </div>
          ))}
          {busy && <p className="text-sm text-muted">Thinking…</p>}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(input); }}
            placeholder="Say what's on your mind…"
            className="min-w-0 flex-1 rounded-full border bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <button onClick={() => void send(input)} disabled={busy || !input.trim()} aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-50"><ArrowRight className="h-4 w-4" /></button>
        </div>
      </CardBody></Card>

      {started && !wrapped && (
        <button onClick={() => setWrapped(true)} className="mt-3 inline-flex items-center justify-center gap-1.5 self-center rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
          <Check className="h-3.5 w-3.5" /> Wrap up today
        </button>
      )}

      {wrapped && (
        <div className="mt-3 space-y-3">
          <CommitmentCapture suggestion="" towards={mind?.trajectory?.statement ?? undefined} />
          <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard")}>Done for today <Check className="h-4 w-4" /></Button>
        </div>
      )}

      {!started && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted"><MessageCircle className="h-3.5 w-3.5" /> Whatever you say here becomes part of today&apos;s snapshot.</p>
      )}
    </div>
  );
}
