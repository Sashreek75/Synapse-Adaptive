"use client";

/**
 * THE COMPANION — Synapse, present in every room.
 *
 * Synapse is not a tab inside the app; it IS the app. This is the one persistent orb that
 * travels with the user across every page (the app shell keeps it mounted while the room
 * beneath it changes). It is a real second conversation: tap it anywhere and TALK — ask what
 * a check-in question means, what your numbers say, what the weekly report is telling you —
 * and it answers right there, knowing everything it knows about you. It only walks you to
 * another room when you clearly ask to GO somewhere (and never somewhere you already are).
 *
 * When a focus session is running, the Focus Companion owns the orb, so this one steps
 * aside. Reuses /api/chat, the activity/momentum/conviction context, and navigate-by-intent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowRight, Home, Wrench, X } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { loadSession, newSession, saveSession, DURATION_PRESETS } from "@/lib/focus-session";
import { loadCommitments } from "@/lib/commitments";
import { loadHistory } from "@/lib/focus-session";
import { readMomentum } from "@/lib/momentum";
import { convictionContextLines } from "@/lib/convictions";
import { activityContextBlock, witness } from "@/lib/activity";
import { detectNavIntent } from "@/lib/nav-intent";
import { detectBuildIntent, extractBuildOffer } from "@/lib/build-intent";
import { createWorkspaceFromRequest, workspaceContextBlock } from "@/lib/workspaces";
import { goalsContextBlock, findOrCreateGoal, decomposeGoal } from "@/lib/goals";
import { detectGoalIntent } from "@/lib/goal-intent";
import { detectFocusIntent, type FocusIntent } from "@/lib/focus-intent";
import { recordNavUse } from "@/lib/nav-hint";
import { cn } from "@/lib/utils";

interface Msg { id: string; from: "you" | "synapse"; text: string }
const NL = String.fromCharCode(10);

// So Synapse can answer "what does this mean?" about whatever the user is looking at.
const PAGE_DESC: Record<string, string> = {
  "/dashboard": "the home conversation",
  "/daily": "today's check-in / daily snapshot",
  "/stats": "their numbers and trends",
  "/report": "their weekly report",
  "/playbook": "the page showing what Synapse understands about them",
  "/focus": "a focus session",
};
function describePage(p: string): string {
  if (!p || p === "/") return "the home conversation";
  const hit = Object.keys(PAGE_DESC).find((k) => p === k || p.startsWith(k + "/"));
  return hit ? PAGE_DESC[hit] : "another part of the app";
}

export function CompanionPresence() {
  const router = useRouter();
  const pathname = usePathname();
  const { mind } = useHealth();
  const { plan: tier } = useSubscription();
  const [focusActive, setFocusActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<FocusIntent | null>(null);
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

  // Synapse offered to build a tool — create it and open the space.
  const buildFromOffer = useCallback((description: string) => {
    createWorkspaceFromRequest(description).then((ws) => { setOpen(false); try { router.push("/workspaces/" + ws.id); } catch {} }).catch(() => {});
  }, [router]);

  // Start a real focus session straight from the orb — the Focus Companion takes over the corner.
  const startOrbFocus = useCallback((goal: string | undefined, minutes: number) => {
    saveSession(newSession(goal ?? null, minutes, "focus"));
    try { witness("focus_start", goal ?? undefined); } catch {}
    try { window.dispatchEvent(new CustomEvent("synapse:focus-start")); } catch {}
    setPendingFocus(null); setOpen(false);
  }, []);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m.filter((x) => x.id !== "intro"), { id: `u_${Date.now()}`, from: "you", text: q }]);
    setInput(""); setPendingFocus(null); scroll();

    if (preGate(q).triggered) { setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: CRISIS_RESPONSE }]); return; }

    // Reshape the product: build them a space and take them into it — never "I can't".
    if (detectBuildIntent(q)) {
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: "On it — building you a space for that." }]);
      scroll();
      createWorkspaceFromRequest(q, { goal: mind?.trajectory?.statement }).then((ws) => { setOpen(false); try { router.push("/workspaces/" + ws.id); } catch {} }).catch(() => {});
      return;
    }

    // A declared ambition becomes a campaign: create + decompose quietly; the reply still talks it through.
    try { const gi = detectGoalIntent(q); if (gi) { const { goal, created } = findOrCreateGoal(gi.goal); if (created) decomposeGoal(goal.id).catch(() => {}); } } catch {}

    // Locking in? Offer to keep time right here — the timer starts the moment they pick a length.
    const fIntent = detectFocusIntent(q);
    if (fIntent.focus && !loadSession()) {
      setPendingFocus(fIntent);
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: fIntent.goal ? "On it — " + fIntent.goal + ". How long shall I keep time?" : "On it. How long shall I keep time?" }]);
      scroll();
      return;
    }

    // Only leave the room when they CLEARLY want to go somewhere else — and never somewhere
    // they already are. Everything else (questions, "what does this mean?") is answered in place.
    const here = pathname || "/";
    const nav = detectNavIntent(q);
    const alreadyHere = !!nav && (here === nav.to || here.startsWith(nav.to + "/"));
    if (nav && !alreadyHere) {
      recordNavUse();
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
      const recent = msgs.filter((m) => m.id !== "intro").slice(-6).map((m) => (m.from === "you" ? "User: " : "You: ") + m.text).join(NL);
      const ctx = [
        "Right now it is " + now + ".",
        "You are Synapse, riding along in a small companion window the user opened over whatever page they're on — one continuous conversation that travels with them everywhere. Answer right here in 1-3 short sentences: warm, specific, and immediately useful. Lead with the single most valuable thing and stop; never write a long paragraph or a wall of text — if it is getting long, cut it. Never mention pages, routes, or navigation — you are simply with them.",
        "The user is currently looking at " + describePage(here) + ". If they ask what something here means — a check-in question, one of their numbers, what the weekly report is saying — answer it directly and specifically, using what you know about them. They are already on this page, so never offer to take them where they already are.",
        goal ? "They are working to become: " + goal + "." : "",
        goalsContextBlock(),
        workspaceContextBlock(),
        activityContextBlock(),
        ...convictionContextLines(),
        mom.observation ? "Momentum: " + mom.observation : "",
        recent ? "RECENT CONVERSATION (continue it naturally, don't repeat yourself):" + NL + recent : "",
      ].filter(Boolean).join(NL);
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier, context: ctx }) });
      const data = await res.json();
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: (data && data.content) || "I'm here — say a little more?" }]);
    } catch { setMsgs((m) => [...m, { id: `a_${Date.now()}`, from: "synapse", text: "I couldn't reach my reasoning just now — give it a second." }]); }
    finally { setBusy(false); scroll(); }
  }, [busy, mind, tier, router, pathname, msgs]);

  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ id: "intro", from: "synapse", text: "I'm right here, on this page with you. Ask me anything — including whatever you're looking at." }]);
  }, [open, msgs.length]);

  if (focusActive) return null; // the Focus Companion is the orb right now

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] print:hidden">
      {open && (
        <div role="dialog" aria-label="Talk to Synapse" className="flex w-[min(20rem,88vw)] flex-col overflow-hidden rounded-3xl border bg-surface/95 shadow-lift backdrop-blur animate-fade-up">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <button onClick={() => { setOpen(false); try { router.push("/dashboard"); } catch {} }} title="Back to home" aria-label="Back to home"
              className="flex items-center gap-2 rounded-full py-0.5 pr-2 text-left transition-opacity hover:opacity-70">
              <SynapseOrb size={24} state={busy ? "thinking" : "idle"} />
              <span className="text-sm font-semibold text-ink">Synapse</span>
              <Home className="h-3.5 w-3.5 text-muted" />
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
            {msgs.map((m) => {
              const off = m.from === "synapse" ? extractBuildOffer(m.text) : { description: null as string | null, cleaned: m.text };
              const desc = off.description;
              return (
                <div key={m.id} className={cn("flex flex-col gap-1", m.from === "you" ? "items-end" : "items-start")}>
                  <p className={cn("max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-relaxed", m.from === "you" ? "bg-navy-900 text-white" : "bg-surface-2 text-ink")}>{off.cleaned}</p>
                  {desc && (
                    <button onClick={() => buildFromOffer(desc)}
                      className="inline-flex items-center gap-1.5 self-start rounded-full border border-orange-300/60 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-orange-500/15">
                      <Wrench className="h-3.5 w-3.5 text-orange-500" /> Build it
                    </button>
                  )}
                </div>
              );
            })}
            {busy && <p className="text-sm text-muted">Thinking…</p>}
            <div ref={endRef} />
          </div>
          {pendingFocus && (
            <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2.5">
              {(pendingFocus.minutes && !(DURATION_PRESETS as readonly number[]).includes(pendingFocus.minutes) ? [pendingFocus.minutes, ...DURATION_PRESETS] : DURATION_PRESETS).map((m) => (
                <button key={m} onClick={() => startOrbFocus(pendingFocus.goal, m)} className="rounded-full border bg-surface px-3 py-1 text-xs font-medium text-ink transition hover:bg-surface-2">{m} min</button>
              ))}
              <button onClick={() => setPendingFocus(null)} className="rounded-full px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink">Not now</button>
            </div>
          )}
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(input); }}
              placeholder="Ask Synapse anything…"
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
