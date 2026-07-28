"use client";

/**
 * THE COMPANION — Synapse, present in every room.
 *
 * Synapse is not a tab inside the app; it IS the app. This is the one persistent orb that
 * travels with the user across every page (the app shell keeps it mounted while the room
 * beneath it changes). Tap it anywhere to keep the same continuous conversation, and if
 * you ask to go somewhere it quietly walks you there — the orb stays beside you.
 *
 * When a focus session is running, the Focus Companion owns the orb, so this one steps
 * aside. Reuses /api/chat, the activity/momentum/conviction context, and navigate-by-intent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { loadSession } from "@/lib/focus-session";
import { loadCommitments } from "@/lib/commitments";
import { loadHistory } from "@/lib/focus-session";
import { readMomentum } from "@/lib/momentum";
import { convictionContextLines } from "@/lib/convictions";
import { activityContextBlock } from "@/lib/activity";
import { detectNavIntent } from "@/lib/nav-intent";
import { cn } from "@/lib/utils";

interface Msg { id: string; from: "you" | "synapse"; text: string }
const NL = String.fromCharCode(10);

export function CompanionPresence() {
  const router = useRouter();
  const { mind } = useHealth();
  const { plan: tier } = useSubscription();
  const [focusActive, setFocusActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Step aside whenever the Focus Companion owns the orb.
  useEffect(() => {
    const sync = () => setFocusActive(!!loadSession());
    sync();
    const h = () => sync();
    window.addEventListener("synapse:focus-start", h);
    window.addEventListener("synapse:focus-end", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("synapse:focus-start", h); window.removeEventListener("synapse:focus-end", h); window.removeEventListener("storage", h); };
  }, []);

  const scroll = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m.filter((x) => x.id !== "intro"), { id: `u_${Date.now()}`, from: "you", text: q }]);
    setInput(""); scroll();

    if (preGate(q).triggered) { setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: CRISIS_RESPONSE }]); return; }

    // If they asked to go somewhere, walk them there — quietly, no routes shown.
    const nav = detectNavIntent(q);
    if (nav) {
      if (nav.talk) { try { sessionStorage.setItem("synapse.snapshot.mode", "talk"); sessionStorage.setItem("synapse.snapshot.seed", q); } catch {} }
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: nav.talk ? "Let's talk it through — come with me." : "Taking you to " + nav.label + " — I'm right here with you." }]);
      scroll();
      setTimeout(() => { setOpen(false); try { router.push(nav.to); } catch {} }, 700);
      return;
    }

    setBusy(true);
    try {
      const now = new Date().toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      const goal = mind?.trajectory?.statement;
      const mom = readMomentum(loadCommitments(), loadHistory());
      const ctx = [
        "Right now it is " + now + ".",
        "The user tapped your orb to talk from wherever they are in the app — you travel with them across every page, one continuous conversation. Be brief, warm, and genuinely useful; this is a quick word, not a full session. Never mention pages, routes, or navigation; if they want to go somewhere it just happens.",
        goal ? "They are working to become: " + goal + "." : "",
        activityContextBlock(),
        ...convictionContextLines(),
        mom.observation ? "Momentum: " + mom.observation : "",
      ].filter(Boolean).join(NL);
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier, context: ctx }) });
      const data = await res.json();
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: (data && data.content) || "I'm here — say a little more?" }]);
    } catch { setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: "I couldn't reach my reasoning just now — give it a second." }]); }
    finally { setBusy(false); scroll(); }
  }, [busy, mind, tier, router]);

  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ id: "intro", from: "synapse", text: "I'm here. What's on your mind?" }]);
  }, [open, msgs.length]);

  if (focusActive) return null; // the Focus Companion is the orb right now

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] print:hidden">
      {open && (
        <div role="dialog" aria-label="Talk to Synapse" className="flex w-[min(20rem,88vw)] flex-col overflow-hidden rounded-3xl border bg-surface/95 shadow-lift backdrop-blur animate-fade-up">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <SynapseOrb size={24} state={busy ? "thinking" : "idle"} />
              <p className="text-sm font-semibold text-ink">Synapse</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
            {msgs.map((m) => (
              <div key={m.id} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
                <p className={cn("max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-relaxed", m.from === "you" ? "bg-navy-900 text-white" : "bg-surface-2 text-ink")}>{m.text}</p>
              </div>
            ))}
            {busy && <p className="text-sm text-muted">Thinking…</p>}
            <div ref={endRef} />
          </div>
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(input); }}
              placeholder="Talk to Synapse…"
              className="min-w-0 flex-1 rounded-full border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none" />
            <button onClick={() => void send(input)} disabled={busy || !input.trim()} aria-label="Send" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-50"><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((v) => !v)} aria-label={open ? "Close Synapse" : "Talk to Synapse"}
        className="grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-[1.04] active:scale-95">
        <SynapseOrb size={44} state={busy ? "thinking" : "idle"} />
      </button>
    </div>
  );
}
