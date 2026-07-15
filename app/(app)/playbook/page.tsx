"use client";

/**
 * THE PERSONAL PLAYBOOK — Synapse's learned model of HOW THIS PERSON WORKS.
 * Not a health profile (what's true now) — a playbook (what reliably works for
 * you), built over months from experiments, assessments, and conversations. This
 * is the durable differentiator: a data store can log your sleep, but it can't
 * learn that you perform better after 7.5-8 hours.
 */

import { useMemo } from "react";
import Link from "next/link";
import { BookOpen, Moon, Brain, Activity, Battery, Smile, HeartPulse, Sparkles, GitBranch, Trophy, HelpCircle, Check } from "lucide-react";
import { Card, CardBody, Button, SectionLabel } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import type { PlaybookEntry } from "@/types";

const CATEGORY: Record<PlaybookEntry["category"], { label: string; icon: typeof Moon }> = {
  sleep: { label: "Sleep", icon: Moon },
  focus: { label: "Focus & attention", icon: Brain },
  stress: { label: "Stress", icon: Activity },
  energy: { label: "Energy", icon: Battery },
  mood: { label: "Mood", icon: Smile },
  recovery: { label: "Recovery", icon: HeartPulse },
  cognition: { label: "Cognition", icon: Brain },
  pattern: { label: "Patterns", icon: GitBranch },
  track_record: { label: "Your track record", icon: Trophy },
};
const ORDER: PlaybookEntry["category"][] = ["pattern", "sleep", "focus", "cognition", "energy", "stress", "mood", "recovery", "track_record"];

export default function PlaybookPage() {
  const { hydrated, mind, beliefs } = usePlaybookData();

  const grouped = useMemo(() => {
    const g = new Map<PlaybookEntry["category"], PlaybookEntry[]>();
    for (const e of mind.playbook) {
      if (!g.has(e.category)) g.set(e.category, []);
      g.get(e.category)!.push(e);
    }
    return g;
  }, [mind.playbook]);

  if (!hydrated) return null;

  const hasEntries = mind.playbook.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink"><BookOpen className="h-6 w-6 text-orange-500" /> Your Playbook</h1>
          <p className="text-sm text-muted">What I&apos;ve learned about how you work — earned from your experiments and check-ins, not guessed.</p>
        </div>
      </header>

      {beliefs.length > 0 && (
        <Card className="overflow-hidden"><div className="mesh"><CardBody className="sm:p-6">
          <SectionLabel className="mb-2">What I currently believe about you</SectionLabel>
          <ul className="space-y-2">
            {beliefs.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-ink">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${b.strength === "strong" ? "bg-emerald-500" : b.strength === "moderate" ? "bg-orange-400" : "bg-navy-300"}`} />
                <span>{b.statement} <span className="text-xs text-muted">· {b.strength} conviction</span></span>
              </li>
            ))}
          </ul>
        </CardBody></div></Card>
      )}

      {/* OPEN QUESTIONS — what Synapse is still trying to figure out about you.
          It works on these through conversation, observation, and experiments. */}
      {(mind.openQuestions.filter((q) => q.status === "open").length > 0 || mind.openQuestions.filter((q) => q.status === "answered").length > 0) && (
        <Card><CardBody className="sm:p-6">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5 text-orange-500" /> Questions I&apos;m still working on</SectionLabel>
          {mind.openQuestions.filter((q) => q.status === "open").length ? (
            <ul className="space-y-2.5">
              {mind.openQuestions.filter((q) => q.status === "open").map((q) => (
                <li key={q.id} className="flex items-start gap-2.5 text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                  <span>{q.question}{q.whyItMatters && <span className="block text-sm text-muted">{q.whyItMatters}</span>}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nothing open right now — I&apos;ll add questions as your patterns raise them.</p>}
          {mind.openQuestions.filter((q) => q.status === "answered").length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Answered</p>
              <ul className="space-y-2">
                {mind.openQuestions.filter((q) => q.status === "answered").slice(-4).map((q) => (
                  <li key={q.id} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-sm"><span className="text-muted">{q.question}</span>{q.answer && <span className="block text-ink">{q.answer}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody></Card>
      )}

      {!hasEntries ? (
        <Card><CardBody className="py-10 text-center">
          <p className="mx-auto max-w-md text-muted">Your Playbook is still being written. As we run experiments and I watch your patterns, I&apos;ll record durable things like <em>&ldquo;you perform better after 7.5-8 hours of sleep&rdquo;</em> or <em>&ldquo;stress spikes tend to precede attention dips.&rdquo;</em> Each experiment we finish adds to it.</p>
          <Link href="/dashboard" className="mt-5 inline-block"><Button>Start this week&apos;s experiment <Sparkles className="h-4 w-4" /></Button></Link>
        </CardBody></Card>
      ) : (
        <div className="space-y-5">
          {ORDER.filter((c) => grouped.has(c)).map((c) => {
            const meta = CATEGORY[c]; const Icon = meta.icon;
            return (
              <section key={c}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Icon className="h-3.5 w-3.5 text-orange-500" /> {meta.label}</p>
                <div className="space-y-2">
                  {grouped.get(c)!.map((e) => (
                    <Card key={e.id}><CardBody className="p-4">
                      <p className="text-ink">{e.statement}</p>
                      {e.evidence && <p className="mt-1 text-xs text-muted">{e.evidence}</p>}
                    </CardBody></Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-xs text-muted">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
        This is yours and it compounds — the longer we work together, the sharper it gets. It syncs to your account, so it follows you.
      </p>
    </div>
  );
}

function usePlaybookData() {
  const { hydrated, mind } = useHealth();
  return { hydrated, mind, beliefs: mind.beliefs };
}
