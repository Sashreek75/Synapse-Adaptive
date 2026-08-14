"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectFocusIntent, extractFocusOffer, type FocusIntent } from "@/lib/focus-intent";
import { detectBuildIntent, extractBuildOffer } from "@/lib/build-intent";
import { createWorkspaceFromRequest } from "@/lib/workspaces";
import { goalsContextBlock, findOrCreateGoal, decomposeGoal } from "@/lib/goals";
import { challengeContextBlock } from "@/lib/coaching";
import { extractRecTag, recordRecommendation, decisionsContextBlock } from "@/lib/decisions";
import { allocationContextBlock, calibrationContextBlock } from "@/lib/allocations";
import { extractPrincipleTag, extractMindShiftTag, addPrinciple, addMindShift, principlesContextBlock } from "@/lib/principles";
import { extractObserveTags } from "@/lib/observations";
import { workspaceContextBlock } from "@/lib/workspaces";
import { evidenceContextBlock } from "@/lib/evidence";
import { pftContextBlock } from "@/lib/pft";
import { detectGoalIntent } from "@/lib/goal-intent";
import { useRouter } from "next/navigation";
import { detectNavIntent } from "@/lib/nav-intent";
import { NAV_HINT_EXAMPLES, shouldShowNavHints, recordNavUse } from "@/lib/nav-hint";
import { newSession, saveSession, loadSession, DURATION_PRESETS } from "@/lib/focus-session";
import { openCommitment, commitmentAwaitingReport, loadCommitments } from "@/lib/commitments";
import { readMomentum } from "@/lib/momentum";
import { convictionContextLines } from "@/lib/convictions";
import { witness, activityContextBlock } from "@/lib/activity";
import { Send, Eye, BookOpen, Compass, Sparkles, Target, CalendarCheck, Activity, Eraser, Timer, Wrench } from "lucide-react";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { useHealth } from "@/components/providers/health-store";
import { signalMeta } from "@/lib/signals";
import { computeTrend } from "@/lib/stats";
import { getPath, goalMetricsForPath } from "@/lib/paths";
import { computeStreak, focusAreas, sessionOpener } from "@/lib/intelligence";
import { computeAssociations } from "@/lib/correlations";
import { reviewExperiment, currentWeekKey } from "@/lib/focus";
import { useSubscription } from "@/components/providers/subscription-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { WaitlistDialog } from "@/components/billing/waitlist-dialog";
import { SynapseOrb } from "@/components/synapse/orb";
import { RichText } from "@/components/agent/rich-text";
import { cn } from "@/lib/utils";
import { env, flags } from "@/env";
import type { ChatMessage } from "@/types";

/** Stripe wired = real checkout; otherwise upgrades open the waitlist. */
const billingLive = flags.billingLive || !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** Small text helpers for the proactive opener. */
function lowerFirst(s: string): string { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function rankStrength(s: string): number { return s === "strong" ? 2 : s === "moderate" ? 1 : 0; }

const sectionMeta = {
  observation: { label: "What I see", icon: Eye, tint: "text-navy-500", bar: "bg-navy-500" },
  education: { label: "Good to know", icon: BookOpen, tint: "text-orange-600", bar: "bg-orange-500" },
  ask_provider: { label: "Worth a closer look", icon: Compass, tint: "text-emerald-600", bar: "bg-emerald-500" },
} as const;

export function AgentConsole({ embedded = false, immersive = false }: { embedded?: boolean; immersive?: boolean } = {}) {
  const { profile, series, hasData, weeksTracked, consistency, weeklyScore, recentChanges, providerQuestions, checkIns, contextNotes, recommendationLog, mind, experiments, chat, setChat, dailyDoneToday, addObservation } = useHealth();
  const { plan, startUpgrade } = useSubscription();
  const { email } = useAuth();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const free = plan === "free";
  const FREE_CAP = 5;
  const usageKey = `synapse.agent.usage.${new Date().toISOString().slice(0, 10)}`;
  const [usedToday, setUsedToday] = useState(0);
  useEffect(() => { try { setUsedToday(Number(localStorage.getItem(usageKey) || 0)); } catch {} }, [usageKey]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const [pendingFocus, setPendingFocus] = useState<FocusIntent | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const sync = () => setFocusActive(!!loadSession());
    sync();
    window.addEventListener("synapse:focus-start", sync);
    window.addEventListener("synapse:focus-end", sync);
    return () => { window.removeEventListener("synapse:focus-start", sync); window.removeEventListener("synapse:focus-end", sync); };
  }, []);

  // Teach-once cue: show "try saying…" until they've driven themselves around a few times.
  const [showHints, setShowHints] = useState(false);
  useEffect(() => {
    const sync = () => setShowHints(shouldShowNavHints());
    sync();
    window.addEventListener("synapse:navhint", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("synapse:navhint", sync); window.removeEventListener("storage", sync); };
  }, []);

  // Entering focus mode from natural language: begin a real companion session on the
  // spot (roles are entered, not clicked), then MINIMIZE into the floating orb — no extra
  // screens, no dashboard. The user is back to work within seconds.
  function startFocus(goal: string | undefined, minutes: number) {
    const s = newSession(goal ?? null, minutes, "focus");
    saveSession(s);
    setFocusActive(true); setCustomOpen(false); setCustomMin(""); setPendingFocus(null);
    try { witness("focus_start", goal ?? undefined); } catch {}
    try { recordNavUse(); } catch {}
    try { window.dispatchEvent(new CustomEvent("synapse:focus-start")); } catch {}
    const line = `Sounds good${goal ? ` \u2014 ${goal} it is` : ""}. I'll be right here if you need me: keeping time, quiet while you're in flow, and I'll only look in if it seems like you've drifted.`;
    setChat([...chat.filter((m) => m.id !== "intro"), { id: `a_${Date.now()}`, role: "assistant" as const, content: line }]);
  }
  const startCustom = () => { const m = Math.min(180, Math.max(5, parseInt(customMin, 10) || 25)); startFocus(pendingFocus?.goal, m); };

  const focus = getPath(profile.path).focusNoun;

  const context = useMemo(() => {
    const who = [
      `Name: ${profile.displayName || "User"}`,
      goalsContextBlock(),
      allocationContextBlock(),
      calibrationContextBlock(),
      challengeContextBlock(),
      decisionsContextBlock(),
      principlesContextBlock(),
      workspaceContextBlock(),
      evidenceContextBlock(checkIns),
      pftContextBlock(),
      (mind.trajectory?.statement || profile.definitionOfBetter) && `Working to become: ${mind.trajectory?.statement || profile.definitionOfBetter} (the objective — weigh advice against whether it moves them toward this)`,
      profile.aiSummary && `Profile: ${profile.aiSummary}`,
      `What they care about most: ${focus}`,
      profile.goals.length && `Goals: ${profile.goals.join(", ")}`,
      profile.primaryChallenge && `Hardest right now: ${profile.primaryChallenge}`,
      `Check-ins recorded: ${weeksTracked}`,
      (() => {
        const m = readMomentum(loadCommitments(), []);
        return m.observation ? `Where the relationship is trending right now (a judgment about the arc of your work together — voice it only if it genuinely fits, in your own words, and rarely): ${m.observation}` : (m.state !== "early" ? `Relationship momentum: ${m.state}.` : "");
      })(),
      activityContextBlock(),
      ...convictionContextLines(),
      (() => {
        const aw = commitmentAwaitingReport();
        if (aw) return `A PROMISE THEY MADE TO THEMSELVES (still open, from a previous session): "${aw.text}". This is the single most important thread right now. OPEN the conversation by gently asking whether it happened — do not wait for them to raise it. If they did it, name it as who they are becoming. If they did not, do not glide past it: ask what got in the way, then help them restart it, make it smaller, or consciously swap it for something higher-leverage. It never just disappears.`;
        const oc = openCommitment();
        return oc ? `The commitment they set today (a promise to themselves): "${oc.text}". Hold them to it warmly and weave it in when relevant.` : "";
      })(),
      "App capability: their numbers exist behind the scenes, but lead with what they MEAN and where they're headed, not charts. If they want to SEE their numbers, the app takes them there when they ask, then summarize the key movements in plain words.",
      "If they want to check in, reflect, see their numbers, or open their weekly review, the app takes them there automatically the moment they ask, so NEVER hand out links or file paths (never write things like slash-daily). Refer to places by name: today's snapshot, your numbers, your weekly review, the You page.",
      "A focus timer is a tool you OFFER when it would genuinely help them BEGIN deep work — offer it and append the tag [[focus: what they're working on | minutes]] (minutes optional); it becomes a \"Start a focus session\" button. Decide from context, never keywords: only when they're actually starting work, never when they're reflecting on a past session, venting, or need care. If they explicitly ask (\"time me for 25\"), a chooser appears automatically.",
      "Short cognitive 'sharpness' tasks exist if they want them; if you suggest one, just say so in plain words, no links or paths.",
    ].filter(Boolean).join("\n");
    if (!hasData) return who;
    const lines = series.map((s) => {
      const t = computeTrend(s); const m = signalMeta(s.metric);
      return `${m.label}: latest ${Math.round(t.latest)}, baseline ${Math.round(t.baseline)}, change ${Math.round(t.delta)} (${m.direction}).`;
    });
    const dailyN = checkIns.filter((c) => c.kind === "daily").length;
    const weeklyN = checkIns.filter((c) => c.kind !== "daily").length;
    const last = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
    const changes = recentChanges.map((c) => `${c.label} ${c.improving ? "improving" : "to watch"} (${c.deltaNorm > 0 ? "+" : ""}${c.deltaNorm})`).join("; ") || "none notable yet";
    const openQ = providerQuestions.filter((q) => q.status === "open").map((q) => q.text);
    const streak = computeStreak(checkIns);
    const watching = focusAreas(series, profile.path).join(", ");
    const notes = contextNotes.slice(-4).map((n) => `- "${n.answer}" (re: ${n.prompt})`).join("\n");
    const daysSinceLast = last ? Math.round((Date.now() - new Date(last.date).getTime()) / 864e5) : null;
    const associations = computeAssociations(series, goalMetricsForPath(profile.path), 4);
    const connections = associations.length
      ? `Connections I've found in your data (pre-computed, cannot be seen on the dashboard; respect the confidence):\n${associations.map((a) => `- [${a.kind}, ${a.confidence}] ${a.plain}`).join("\n")}`
      : "";
    const activity = [
      `Activity: ${weeklyN} weekly + ${dailyN} daily check-ins; ${Math.round(consistency * 7)}/7 days active this week.`,
      last ? `Most recent check-in: ${new Date(last.date).toLocaleDateString()}${daysSinceLast != null ? ` (${daysSinceLast === 0 ? "today" : `${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago`})` : ""}.` : "",
      `Weekly score: ${weeklyScore}/100 (consistency + trend direction).`,
      `Recent changes: ${changes}.`,
      `Currently watching most closely: ${watching}.`,
      `Consistency: ${streak.totalDays} total check-in days, current streak ${streak.currentStreak} days.`,
      notes ? `Things they told me recently:\n${notes}` : "",
      openQ.length ? `Open questions they still want answered: ${openQ.join(" | ")}.` : "",
      recommendationLog.length
        ? `Suggestions I made previously (most recent last): ${recommendationLog.slice(-3).map((r) => `"${r.title}" (${new Date(r.date).toLocaleDateString()})`).join("; ")}. Follow up on these naturally when relevant.`
        : "",
    ].filter(Boolean).join("\n");
    const beliefs = mind.beliefs.length
      ? `What I currently believe about you (my evolving read; update if the evidence shifts):\n${mind.beliefs.map((b) => `- [${b.strength}] ${b.statement}`).join("\n")}`
      : "";
    const conclusions = mind.conclusions.length
      ? `Things I've concluded about you before:\n${mind.conclusions.slice(-8).map((c) => `- ${c}`).join("\n")}`
      : "";
    const openQuestionsCtx = mind.openQuestions.filter((q) => q.status === "open").length
      ? `Questions I'm still trying to answer about you (steer conversation toward these when natural):\n${mind.openQuestions.filter((q) => q.status === "open").slice(0, 5).map((q) => `- ${q.question}${q.whyItMatters ? ` (${q.whyItMatters})` : ""}`).join("\n")}`
      : "";
    const wk = Object.keys(mind.weekly).sort().pop();
    const wr = wk ? mind.weekly[wk] : undefined;
    const currentFocus = wr
      ? `This week's focus (the ONE priority — connect advice back to it): "${wr.title}" — ${wr.action}${wr.experiment ? `\nCurrent experiment: ${wr.experiment.hypothesis} Expected: ${wr.experiment.expectedOutcome}` : ""}`
      : "";
    const playbook = mind.playbook.length
      ? `Your Playbook — durable things I've learned about how you work:\n${mind.playbook.slice(-8).map((p) => `- ${p.statement}`).join("\n")}`
      : "";
    const theories = mind.hypotheses.length
      ? `What I'm learning about you — my working theories (status + confidence in brackets). Reference and REVISE these; prefer surfacing a non-obvious one over restating a metric, and turn one into something to test when it fits:\n${mind.hypotheses.slice(0, 6).map((h) => `- [${h.status}, ${h.confidence}] ${h.statement}${h.suggestedExperiment ? ` — to test: ${h.suggestedExperiment}` : ""}`).join("\n")}`
      : "";
    const habitsCtx = mind.habits.filter((h) => h.status !== "lapsed").length
      ? `Habits they've built (reinforce these; don't re-test what's already settled):\n${mind.habits.filter((h) => h.status !== "lapsed").slice(-5).map((h) => `- [${h.status}] ${h.statement}`).join("\n")}`
      : "";
    const expHistory = experiments.length
      ? `Experiments we've run together (reference these naturally):\n${experiments.slice(-5).map((e) => { const r = reviewExperiment(e, series); return `- "${e.title}" — tried ${e.behavior} → ${r.outcome}`; }).join("\n")}`
      : "";
    return `${who}\n\nMetric trends (0-100):\n${lines.join("\n")}\n\n${activity}${currentFocus ? `\n\n${currentFocus}` : ""}${connections ? `\n\n${connections}` : ""}${beliefs ? `\n\n${beliefs}` : ""}${conclusions ? `\n\n${conclusions}` : ""}${openQuestionsCtx ? `\n\n${openQuestionsCtx}` : ""}${theories ? `\n\n${theories}` : ""}${habitsCtx ? `\n\n${habitsCtx}` : ""}${playbook ? `\n\n${playbook}` : ""}${expHistory ? `\n\n${expHistory}` : ""}`;
  }, [hasData, profile, series, weeksTracked, focus, consistency, weeklyScore, recentChanges, providerQuestions, checkIns, contextNotes, recommendationLog, mind, experiments]);

  // The old suggestion bubbles were removed — the companion orb and the teach-once
  // "try saying…" cue cover discovery now. up/down still feed the proactive opener.
  const up = recentChanges.find((c) => c.improving);
  const down = recentChanges.find((c) => !c.improving);

  // THE PROACTIVE OPENER — Synapse initiates. It doesn't wait to be asked; it
  // arrives having already looked, and leads with the single most alive thing it
  // can honestly say (a changed mind, a strengthening belief, a real movement, a
  // memory, a lingering question), then offers a next step. Deterministic, so it's
  // always grounded and never invents.
  const introContent = useMemo(() => {
    const name = profile.displayName ? ` ${profile.displayName}` : "";
    if (!hasData) {
      return `Hi${name} — I'm **Synapse**, your adaptive AI partner. 👋\n\nI get more useful the more I learn about how you work. Tell me what you're working on, or do a quick check-in, and I'll start finding your patterns.`;
    }

    const op = sessionOpener(profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked);
    const weekly = mind.weekly[currentWeekKey()];
    const belief = [...mind.beliefs].sort((a, b) => rankStrength(b.strength) - rankStrength(a.strength))[0];
    const openQ = mind.openQuestions.find((q) => q.status === "open");
    const learning = mind.playbook[mind.playbook.length - 1];

    const parts: string[] = [`Hi${name} — I've been looking over your check-ins. 👋`];

    // Lead with the most "alive" thing I can honestly say right now.
    if (weekly?.mindShift) parts.push(`🔄 **I've changed my mind about something.** ${weekly.mindShift}`);
    else if (belief && belief.strength !== "weak") parts.push(`💡 I'm becoming more confident that ${lowerFirst(belief.statement)}`);
    else if (up || down) {
      const bits: string[] = [];
      if (up) bits.push(`your ${up.label.toLowerCase()} is trending the right way ✅`);
      if (down) bits.push(`I'm keeping a gentle eye on your ${down.label.toLowerCase()} 👀`);
      parts.push(`Since we last talked, ${bits.join(", and ")}.`);
    }
    else if (learning) parts.push(`📔 Something I've picked up about you: ${lowerFirst(learning.statement)}`);
    else parts.push(`Things are holding steady — which is its own kind of good news. 🙂`);

    // A memory, so it's clear I actually remember.
    if (op.memory) parts.push(`💭 ${op.memory}`);

    // Every so often, share a question I'm genuinely still working on (curiosity).
    if (openQ && checkIns.length % 3 === 0) parts.push(`I'm still trying to understand ${lowerFirst(openQ.question)} — something we could dig into together.`);

    // A soft, optional next step so there's always somewhere to go.
    if (op.recommendation?.title) parts.push(`**Next step:** ${op.recommendation.title.replace(/\.$/, "")} — want me to explain why it fits you right now?`);
    else parts.push(`What do you want to make progress on today?`);

    return parts.join("\n\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked, mind, up, down]);

  const messages: ChatMessage[] = chat.length ? chat : [{ id: "intro", role: "assistant", content: introContent }];

  function scrollDown() { requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" })); }

  // Synapse offered to build a tool — turn that into a real workspace and open it.
  async function buildFromOffer(description: string) {
    try { const ws = await createWorkspaceFromRequest(description, { goals: profile.goals }); router.push(`/workspaces/${ws.id}`); } catch {}
  }
  function OfferButton({ desc }: { desc: string }) {
    return (
      <button onClick={() => void buildFromOffer(desc)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-orange-300/60 bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:bg-orange-500/15">
        <Wrench className="h-4 w-4 text-orange-500" /> Build it: {desc}
      </button>
    );
  }
  function startFocusFromOffer(goal?: string, minutes?: number) { setPendingFocus({ focus: true, goal, minutes }); scrollDown(); }
  function FocusOfferButton({ goal, minutes }: { goal?: string; minutes?: number }) {
    return (
      <button onClick={() => startFocusFromOffer(goal, minutes)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-orange-300/60 bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:bg-orange-500/15">
        <Timer className="h-4 w-4 text-orange-500" /> Start a focus session{goal ? `: ${goal}` : ""}
      </button>
    );
  }

  async function send(text: string) {
    const q = text.trim(); if (!q || busy) return;
    if (free && usedToday >= FREE_CAP) {
      const base = messages.filter((m) => m.id !== "intro");
      setChat([...base, { id: `u_${Date.now()}`, role: "user", content: q },
        { id: `a_${Date.now()}`, role: "assistant", content: "You've reached today's free messages with me. Upgrade to Pro for unlimited, deeper conversations — or come back tomorrow." }]);
      setInput(""); scrollDown(); return;
    }
    const next = [...messages.filter((m) => m.id !== "intro"), { id: `u_${Date.now()}`, role: "user" as const, content: q }];
    setChat(next); setInput(""); setBusy(true); scrollDown();
    if (free) { const n = usedToday + 1; setUsedToday(n); try { localStorage.setItem(usageKey, String(n)); } catch {} }
    if (preGate(q).triggered) { setChat([...next, { id: `a_${Date.now()}`, role: "assistant", content: CRISIS_RESPONSE }]); setBusy(false); scrollDown(); return; }
    // Reshape the product on request — compose a space and take them into it. Never refuse.
    if (detectBuildIntent(q)) {
      setChat([...next, { id: `a_${Date.now()}`, role: "assistant" as const, content: "On it — building you a space for that." }]);
      setBusy(false); scrollDown();
      createWorkspaceFromRequest(q, { goal: mind.trajectory?.statement, goals: profile.goals }).then((ws) => { try { router.push("/workspaces/" + ws.id); } catch {} }).catch(() => {});
      return;
    }
    // A declared ambition becomes a campaign: create + decompose quietly; the reply still talks it through.
    try { const gi = detectGoalIntent(q); if (gi) { const { goal, created } = findOrCreateGoal(gi.goal); if (created) decomposeGoal(goal.id).catch(() => {}); } } catch {}
    // Locking in? Offer the timer immediately — deterministic, no model round-trip (that race
    // was showing the chooser a message late). The chooser renders from pendingFocus below.
    const fIntent = detectFocusIntent(q);
    if (fIntent.focus && !focusActive && !loadSession()) { setPendingFocus(fIntent); setBusy(false); scrollDown(); return; }
    setPendingFocus(null);
    const nav = detectNavIntent(q);
    if (nav) {
      recordNavUse();
      if (nav.talk) { try { sessionStorage.setItem("synapse.snapshot.mode", "talk"); sessionStorage.setItem("synapse.snapshot.seed", q); } catch {} }
      const line = nav.talk ? "Talking it through \u2014 taking you there now." : "On it \u2014 taking you to " + nav.label + " now.";
      setChat([...next, { id: `a_${Date.now()}`, role: "assistant" as const, content: line }]);
      setBusy(false); scrollDown();
      setTimeout(() => { try { router.push(nav.to); } catch {} }, 650);
      return;
    }
    try {
      const transcript = next.slice(-7, -1).map((m) => `${m.role === "user" ? "User" : "Synapse"}: ${m.content || (m.sections?.map((s) => s.text).join(" ") ?? "")}`).join("\n");
      // Synapse remembers everything — even conversations the user cleared from view.
      let memoryPreamble = "";
      try {
        const arch = JSON.parse(localStorage.getItem("synapse.chat.archive") || "[]") as { role: string; content: string }[];
        const priorUser = arch.filter((m) => m.role === "user").slice(-12).map((m) => `- "${m.content}"`).join("\n");
        if (priorUser) memoryPreamble = `Things the user has discussed with you in the past (they cleared the visible chat for a fresh start, but you DO remember everything — act like it, reference it naturally when relevant):\n${priorUser}\n\n`;
      } catch {}
      const nowLine = `Right now it is ${new Date().toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} — the user is messaging you at this exact moment. Anchor every time word to this: "today" is this date, "tonight" is this evening, "tomorrow" is the day after. If a commitment or plan is set for a future day, it is NOT happening yet — never tell them to start it now.`;
      const fullContext = `${nowLine}\n\n${memoryPreamble}${context}${transcript ? `\n\nRecent conversation:\n${transcript}` : ""}`;
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier: plan, context: fullContext }) });
      const data = await res.json();
      const rec = extractRecTag(String(data.content ?? ""));
      if (rec.text) { try { recordRecommendation(rec.text, rec.goalId); } catch {} }
      const pr = extractPrincipleTag(rec.cleaned);
      if (pr.text) { try { addPrinciple(pr.text); } catch {} }
      const ms = extractMindShiftTag(pr.cleaned);
      if (ms.to) { try { addMindShift({ from: ms.from ?? "", to: ms.to }); } catch {} }
      // Stage 2: capture any conversational behavioral observations (silent — never changes the reply text).
      const obs = extractObserveTags(ms.cleaned);
      for (const o of obs.observations) { try { addObservation(o.patternKey, o.note); } catch {} }
      setChat([...next, { id: `a_${Date.now()}`, role: "assistant", content: obs.cleaned, sections: data.sections, evidenceUsed: data.evidenceUsed }]);
    } catch {
      setChat([...next, { id: `a_${Date.now()}`, role: "assistant", content: "I couldn't reach my reasoning engine just now — give it a moment and try again." }]);
    } finally { setBusy(false); scrollDown(); }
  }

  // Keep a live handle to send so the drawer's "ask Synapse" items work even
  // when the console is already mounted.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const handle = () => {
      let p: string | null = null;
      try { p = sessionStorage.getItem("synapse.pendingAsk"); } catch {}
      if (p) { try { sessionStorage.removeItem("synapse.pendingAsk"); } catch {} sendRef.current(p); }
    };
    handle(); // catches the case where we just navigated here with a pending ask
    window.addEventListener("synapse:ask", handle); // catches the already-mounted case
    return () => window.removeEventListener("synapse:ask", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "New conversation" — clear the VISIBLE transcript for a fresh start, but keep
  // everything: durable memory (playbook, beliefs, notes, trends) is untouched,
  // and the cleared messages are archived so Synapse can still recall them.
  function clearChat() {
    try {
      const prior = chat
        .filter((m) => m.id !== "intro")
        .map((m) => ({ role: m.role, content: m.content || (m.sections?.map((s) => s.text).join(" ") ?? "") }))
        .filter((m) => m.content);
      if (prior.length) {
        const arch = JSON.parse(localStorage.getItem("synapse.chat.archive") || "[]");
        localStorage.setItem("synapse.chat.archive", JSON.stringify([...arch, ...prior].slice(-80)));
      }
    } catch {}
    setChat([]);
    setInput("");
  }

  // IMMERSIVE MODE — the conversation is the interface. No box, no chrome:
  // messages breathe on the page and the composer stays within reach at the
  // bottom. This is the homepage's whole body.
  if (immersive) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 space-y-5 pb-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[88%] rounded-3xl rounded-br-lg bg-navy-900 px-4 py-2.5 text-white shadow-soft sm:max-w-[85%]">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5 sm:gap-3">
                <SynapseOrb size={28} state={busy ? "thinking" : "idle"} className="mt-1 shrink-0 sm:hidden" />
                <SynapseOrb size={30} state={busy ? "thinking" : "idle"} className="mt-1 hidden shrink-0 sm:block" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  {m.content && (() => { const bo = extractBuildOffer(m.content); const fo = extractFocusOffer(bo.cleaned); const desc = bo.description; return (<>{fo.cleaned && <RichText text={fo.cleaned} />}{desc && <OfferButton desc={desc} />}{fo.offered && <FocusOfferButton goal={fo.goal} minutes={fo.minutes} />}</>); })()}
                  {m.sections?.map((s, i) => {
                    const meta = sectionMeta[s.kind]; const Icon = meta.icon;
                    return (
                      <div key={i} className="relative overflow-hidden rounded-2xl border bg-surface/70 px-4 py-3 pl-5">
                        <span className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-full", meta.bar)} />
                        <div className={cn("mb-1 flex items-center gap-1.5 text-xs font-semibold", meta.tint)}><Icon className="h-3.5 w-3.5" /> {meta.label}</div>
                        <p className="leading-relaxed text-ink">{s.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex gap-3">
              <SynapseOrb size={30} state="thinking" className="mt-1 shrink-0" />
              <div className="pt-2"><span className="sa-typing"><span /><span /><span /></span></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer — pinned within reach, messages scroll beneath it */}
        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-surface-2 via-surface-2 to-transparent px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-5 sm:-mx-5 sm:px-5 sm:pb-4 sm:pt-6">
          {free && usedToday >= FREE_CAP - 2 && (
            <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
              <span>Free plan · {Math.max(0, FREE_CAP - usedToday)} messages left today</span>
              <button type="button" onClick={() => (billingLive ? void startUpgrade("pro", email ?? undefined) : setWaitlistOpen(true))} className="font-semibold underline">Upgrade</button>
            </div>
          )}
          <WaitlistDialog plan="pro" open={waitlistOpen} onClose={() => setWaitlistOpen(false)} defaultEmail={email} />
          {pendingFocus && !focusActive && (
            <div className="mb-2.5 rounded-xl border border-orange-300/60 bg-orange-500/10 px-3 py-2.5 text-sm text-ink">
              <p className="flex items-center gap-2"><Timer className="h-4 w-4 shrink-0 text-orange-500" /> Sounds good{pendingFocus.goal ? ` — ${pendingFocus.goal}` : ""}. About how long would you like to focus?</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(pendingFocus.minutes && !(DURATION_PRESETS as readonly number[]).includes(pendingFocus.minutes) ? [pendingFocus.minutes, ...DURATION_PRESETS] : DURATION_PRESETS).map((m) => (
                  <button key={m} onClick={() => startFocus(pendingFocus.goal, m)} className="rounded-full border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-2">{m} min</button>
                ))}
                {!customOpen ? (
                  <button onClick={() => setCustomOpen(true)} className="rounded-full border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink">Custom</button>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <input type="number" min={5} max={180} value={customMin} autoFocus onChange={(e) => setCustomMin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startCustom()}
                      placeholder="min" className="w-16 rounded-full border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none" />
                    <button onClick={startCustom} className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600">Start</button>
                  </span>
                )}
                <button onClick={() => setPendingFocus(null)} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink">Not now</button>
              </div>
            </div>
          )}
          {showHints && (
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Try saying:</span>
              {NAV_HINT_EXAMPLES.map((h) => (
                <button key={h} onClick={() => send(h)} disabled={busy}
                  className="rounded-full border border-dashed bg-surface px-3.5 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:border-solid hover:text-ink hover:shadow-soft disabled:opacity-50">{h}</button>
              ))}
            </div>
          )}
          {chat.length > 0 && (
            <div className="mb-2.5 flex items-center justify-end">
              <button onClick={clearChat} title="Clear this space for a fresh start — Synapse still remembers everything"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:-translate-y-0.5 hover:text-ink hover:shadow-soft">
                <Eraser className="h-3.5 w-3.5" /> Clear chat
              </button>
            </div>
          )}
          <div className="flex gap-2 rounded-2xl border bg-surface p-2 shadow-lift">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="What do you want to make progress on?"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none" />
            <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send"
              className="sa-shine grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-50">
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 px-1 text-center text-[11px] text-muted">Synapse reflects your own patterns and can be wrong — you make the call.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", embedded ? "h-[540px]" : "h-[calc(100vh-9rem)]")}>
      {/* Header — omitted when embedded in the homepage conversation */}
      {!embedded && (
      <div className="sa-rise mb-4 overflow-hidden rounded-2xl border bg-surface shadow-soft">
        <div className="mesh">
          <div className="flex flex-wrap items-center gap-4 p-5">
            <span className="relative grid shrink-0 place-items-center">
              <SynapseOrb size={48} state={busy ? "thinking" : "idle"} />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-emerald-500" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink">Synapse</h1>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{busy ? "thinking…" : "ready"}</span>
              </div>
              <p className="truncate text-sm text-muted">Learning how you work · through your {focus}</p>
            </div>
          </div>
          {/* What Synapse knows about you */}
          <div className="flex flex-wrap gap-2 border-t bg-surface/40 px-5 py-3 text-xs">
            <Chip icon={Target}>{profile.goals[0] ?? "Getting to know you"}</Chip>
            <Chip icon={Activity}>{weeksTracked} check-in{weeksTracked === 1 ? "" : "s"}</Chip>
            <Chip icon={CalendarCheck}>{Math.round(consistency * 7)}/7 days active</Chip>
          </div>
        </div>
      </div>
      )}

      {/* Conversation */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border bg-surface p-5 shadow-soft">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[82%] rounded-2xl rounded-br-md bg-navy-900 px-4 py-2.5 text-white shadow-soft">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-navy-700 text-white"><Sparkles className="h-4 w-4" /></span>
              <div className="max-w-[82%] space-y-2.5">
                {m.content && (() => { const bo = extractBuildOffer(m.content); const fo = extractFocusOffer(bo.cleaned); const desc = bo.description; return (<>{fo.cleaned && <div className="rounded-2xl rounded-tl-md border bg-surface-2 px-4 py-3 leading-relaxed text-ink">{fo.cleaned}</div>}{desc && <OfferButton desc={desc} />}{fo.offered && <FocusOfferButton goal={fo.goal} minutes={fo.minutes} />}</>); })()}
                {m.sections?.map((s, i) => {
                  const meta = sectionMeta[s.kind]; const Icon = meta.icon;
                  return (
                    <div key={i} className="relative overflow-hidden rounded-2xl border bg-surface-2 px-4 py-3 pl-5">
                      <span className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-full", meta.bar)} />
                      <div className={cn("mb-1 flex items-center gap-1.5 text-xs font-semibold", meta.tint)}><Icon className="h-3.5 w-3.5" /> {meta.label}</div>
                      <p className="leading-relaxed text-ink">{s.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-navy-700 text-white"><Sparkles className="h-4 w-4" /></span>
            <div className="rounded-2xl rounded-tl-md border bg-surface-2 px-4 py-3"><span className="sa-typing"><span /><span /><span /></span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="mt-4">
        {free && (
          <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
            <span>Free plan · lighter answers · {Math.max(0, FREE_CAP - usedToday)} messages left today</span>
            <button
              type="button"
              onClick={() => (billingLive ? void startUpgrade("pro", email ?? undefined) : setWaitlistOpen(true))}
              className="font-semibold underline"
            >
              Upgrade
            </button>
          </div>
        )}
        <WaitlistDialog plan="pro" open={waitlistOpen} onClose={() => setWaitlistOpen(false)} defaultEmail={email} />
        {showHints && (
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Try saying:</span>
            {NAV_HINT_EXAMPLES.map((h) => (
              <button key={h} onClick={() => send(h)} disabled={busy}
                className="rounded-full border border-dashed bg-surface px-3.5 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:border-solid hover:text-ink hover:shadow-soft disabled:opacity-50">{h}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2 rounded-2xl border bg-surface p-2 shadow-soft">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="What are you working on? Talk to me."
            className="flex-1 bg-transparent px-3 py-2 text-ink placeholder:text-muted focus:outline-none" />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send"
            className="sa-shine grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-50">
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted">Synapse reflects your own patterns and can be wrong — you make the call.</p>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 font-medium text-muted">
      <Icon className="h-3.5 w-3.5 text-navy-500" /> {children}
    </span>
  );
}
