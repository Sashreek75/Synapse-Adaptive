"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Eye, BookOpen, Stethoscope, Sparkles, Target, CalendarCheck, Activity } from "lucide-react";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { useHealth } from "@/components/providers/health-store";
import { METRIC_META } from "@/lib/metrics";
import { computeTrend } from "@/lib/stats";
import { getPath, goalMetricsForPath } from "@/lib/paths";
import { computeStreak, focusAreas } from "@/lib/intelligence";
import { computeAssociations } from "@/lib/correlations";
import { reviewExperiment } from "@/lib/focus";
import { useSubscription } from "@/components/providers/subscription-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { WaitlistDialog } from "@/components/billing/waitlist-dialog";
import { SynapseOrb } from "@/components/synapse/orb";
import { cn } from "@/lib/utils";
import { env, flags } from "@/env";
import type { ChatMessage } from "@/types";

/** Stripe wired = real checkout; otherwise upgrades open the waitlist. */
const billingLive = flags.billingLive || !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const sectionMeta = {
  observation: { label: "What I see", icon: Eye, tint: "text-navy-500", bar: "bg-navy-500" },
  education: { label: "Good to know", icon: BookOpen, tint: "text-orange-600", bar: "bg-orange-500" },
  ask_provider: { label: "Worth asking your provider", icon: Stethoscope, tint: "text-emerald-600", bar: "bg-emerald-500" },
} as const;

export function AgentConsole({ embedded = false, immersive = false }: { embedded?: boolean; immersive?: boolean } = {}) {
  const { profile, series, hasData, weeksTracked, consistency, weeklyScore, recentChanges, providerQuestions, checkIns, contextNotes, recommendationLog, mind, experiments, chat, setChat } = useHealth();
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
  const endRef = useRef<HTMLDivElement>(null);

  const focus = getPath(profile.path).focusNoun;

  const context = useMemo(() => {
    const who = [
      `Name: ${profile.displayName || "User"}`,
      profile.aiSummary && `Profile: ${profile.aiSummary}`,
      `What they care about most: ${focus}`,
      profile.goals.length && `Goals: ${profile.goals.join(", ")}`,
      profile.primaryChallenge && `Hardest right now: ${profile.primaryChallenge}`,
      `Check-ins recorded: ${weeksTracked}`,
    ].filter(Boolean).join("\n");
    if (!hasData) return who;
    const lines = series.map((s) => {
      const t = computeTrend(s); const m = METRIC_META[s.metric];
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
      `Weekly score: ${weeklyScore}/100 (consistency + trend direction; not medical).`,
      `Recent changes: ${changes}.`,
      `Currently watching most closely: ${watching}.`,
      `Consistency: ${streak.totalDays} total check-in days, current streak ${streak.currentStreak} days.`,
      notes ? `Things they told me recently:\n${notes}` : "",
      openQ.length ? `Open questions they saved for their provider: ${openQ.join(" | ")}.` : "",
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
    const currentFocus = wk && mind.weekly[wk]
      ? `This week's focus (the ONE priority — connect advice back to it): "${mind.weekly[wk].title}" — ${mind.weekly[wk].action}\nCurrent experiment: ${mind.weekly[wk].experiment.hypothesis} Expected: ${mind.weekly[wk].experiment.expectedOutcome}`
      : "";
    const playbook = mind.playbook.length
      ? `Your Playbook — durable things I've learned about how you work:\n${mind.playbook.slice(-8).map((p) => `- ${p.statement}`).join("\n")}`
      : "";
    const expHistory = experiments.length
      ? `Experiments we've run together (reference these naturally):\n${experiments.slice(-5).map((e) => { const r = reviewExperiment(e, series); return `- "${e.title}" — tried ${e.behavior} → ${r.outcome}`; }).join("\n")}`
      : "";
    return `${who}\n\nMetric trends (0-100):\n${lines.join("\n")}\n\n${activity}${currentFocus ? `\n\n${currentFocus}` : ""}${connections ? `\n\n${connections}` : ""}${beliefs ? `\n\n${beliefs}` : ""}${conclusions ? `\n\n${conclusions}` : ""}${openQuestionsCtx ? `\n\n${openQuestionsCtx}` : ""}${playbook ? `\n\n${playbook}` : ""}${expHistory ? `\n\n${expHistory}` : ""}`;
  }, [hasData, profile, series, weeksTracked, focus, consistency, weeklyScore, recentChanges, providerQuestions, checkIns, contextNotes, recommendationLog, mind, experiments]);

  // Data-aware conversation starters — Synapse suggests what IT would ask about.
  const up = recentChanges.find((c) => c.improving);
  const down = recentChanges.find((c) => !c.improving);
  const suggestions = hasData
    ? [
        down ? `Why is my ${down.label.toLowerCase()} slipping?` : "What changed recently?",
        up ? `What's helping my ${up.label.toLowerCase()}?` : "What should I focus on?",
        "What patterns have you noticed?",
        "What should I ask my provider?",
      ]
    : ["What can you do?", "How does this work?", "Why do daily check-ins help?"];

  // A contextual opening — Synapse arrives already knowing where things stand.
  const introContent = useMemo(() => {
    const hi = `Hi${profile.displayName ? ` ${profile.displayName}` : ""}`;
    if (!hasData) return `${hi} — I'm Synapse, your health intelligence companion. Complete a check-in and I'll reason over your real data. Ask me anything in the meantime.`;
    const bits: string[] = [];
    if (up) bits.push(`your ${up.label.toLowerCase()} has been trending the right way`);
    if (down) bits.push(`I'm keeping a gentle eye on your ${down.label.toLowerCase()}`);
    const state = bits.length ? ` Since we last talked, ${bits.join(", and ")}.` : " Things have been holding steady.";
    return `${hi} — I've been reading your check-ins.${state} What would you like to unpack?`;
  }, [hasData, profile.displayName, up, down]);

  const messages: ChatMessage[] = chat.length ? chat : [{ id: "intro", role: "assistant", content: introContent }];

  function scrollDown() { requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" })); }

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
    try {
      const transcript = next.slice(-7, -1).map((m) => `${m.role === "user" ? "User" : "Synapse"}: ${m.content || (m.sections?.map((s) => s.text).join(" ") ?? "")}`).join("\n");
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, tier: plan, context: transcript ? `${context}\n\nRecent conversation:\n${transcript}` : context }) });
      const data = await res.json();
      setChat([...next, { id: `a_${Date.now()}`, role: "assistant", content: data.content ?? "", sections: data.sections, evidenceUsed: data.evidenceUsed }]);
    } catch {
      setChat([...next, { id: `a_${Date.now()}`, role: "assistant", content: "I couldn't reach my reasoning engine just now — give it a moment and try again." }]);
    } finally { setBusy(false); scrollDown(); }
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
                <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-navy-900 px-4 py-2.5 text-white shadow-soft">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <SynapseOrb size={30} state={busy ? "thinking" : "idle"} className="mt-1 shrink-0" />
                <div className="max-w-[85%] space-y-2.5">
                  {m.content && <div className="text-[15px] leading-relaxed text-ink">{m.content}</div>}
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
        <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-surface-2 via-surface-2 to-transparent px-5 pb-4 pt-6">
          {free && usedToday >= FREE_CAP - 2 && (
            <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
              <span>Free plan · {Math.max(0, FREE_CAP - usedToday)} messages left today</span>
              <button type="button" onClick={() => (billingLive ? void startUpgrade("pro", email ?? undefined) : setWaitlistOpen(true))} className="font-semibold underline">Upgrade</button>
            </div>
          )}
          <WaitlistDialog plan="pro" open={waitlistOpen} onClose={() => setWaitlistOpen(false)} defaultEmail={email} />
          {chat.length === 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy}
                  className="rounded-full border bg-surface px-3 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:text-ink hover:shadow-soft disabled:opacity-50">{s}</button>
              ))}
            </div>
          )}
          <div className="flex gap-2 rounded-2xl border bg-surface p-2 shadow-lift">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Tell Synapse what's on your mind…"
              className="flex-1 bg-transparent px-3 py-2 text-ink placeholder:text-muted focus:outline-none" />
            <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send"
              className="sa-shine grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-50">
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 px-1 text-center text-[11px] text-muted">Synapse offers general wellness insights — not diagnosis or medical advice.</p>
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
              <p className="truncate text-sm text-muted">Your health intelligence companion · focused on your {focus}</p>
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
                {m.content && <div className="rounded-2xl rounded-tl-md border bg-surface-2 px-4 py-3 leading-relaxed text-ink">{m.content}</div>}
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
        <div className="mb-2.5 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}
              className="rounded-full border bg-surface px-3 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:text-ink hover:shadow-soft disabled:opacity-50">{s}</button>
          ))}
        </div>
        <div className="flex gap-2 rounded-2xl border bg-surface p-2 shadow-soft">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask Synapse about your health…"
            className="flex-1 bg-transparent px-3 py-2 text-ink placeholder:text-muted focus:outline-none" />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send"
            className="sa-shine grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-50">
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted">Synapse offers general wellness insights — not diagnosis or medical advice.</p>
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
