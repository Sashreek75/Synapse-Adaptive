"use client";

/**
 * THE DAILY SNAPSHOT — one outcome, two ways in.
 *
 * "I need to do my check-in" becomes "I want to spend a few minutes with Synapse." The
 * person chooses how to take today in: a one-minute QUICK check-in (structured) or TALK
 * IT THROUGH (conversational). Both produce the same thing — today's understanding. If
 * today's snapshot already exists, we never reject a return visit; we offer to talk it
 * through and enrich it. Pure UX layer; reuses the existing check-in + chat.
 */

import { useState } from "react";
import { ListChecks, MessageCircle, ArrowRight, Clock, ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { DailyCheckIn } from "@/components/daily/daily-checkin";
import { TalkSnapshot } from "@/components/daily/talk-snapshot";
import { cn } from "@/lib/utils";

type Mode = "choose" | "quick" | "talk";

export function DailySnapshot() {
  const { hydrated, dailyDoneToday } = useHealth();
  const [mode, setMode] = useState<Mode>("choose");

  if (!hydrated) return null;

  if (mode !== "choose") {
    return (
      <div>
        <button onClick={() => setMode("choose")} className="mx-auto mb-3 flex max-w-md items-center gap-1.5 px-1 text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Another way to take today in
        </button>
        {mode === "quick" ? <DailyCheckIn /> : <TalkSnapshot enrich={dailyDoneToday} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="sa-rise mb-5 flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Today&apos;s snapshot</h1>
          <p className="text-sm text-muted">
            {dailyDoneToday
              ? "Already captured today — but I'm here if you want to talk something through."
              : "How do you want to take today in? Both land in the same place."}
          </p>
        </div>
      </header>

      <div className="sa-rise-2 space-y-3">
        <Choice
          icon={ListChecks}
          title={dailyDoneToday ? "Update today, quickly" : "Quick check-in"}
          meta="~1 minute"
          body="A couple of prompts and one clear next step. The fastest way to capture today."
          onClick={() => setMode("quick")}
        />
        <Choice
          icon={MessageCircle}
          title="Talk it through"
          meta="as long as you need"
          body={dailyDoneToday ? "Say what's happened since — I'll help you think it through, and it enriches today." : "Just say what's on your mind. I'll help you make sense of today — no prompts."}
          onClick={() => setMode("talk")}
        />
      </div>

      <p className="mt-4 text-center text-xs text-muted">Sixty seconds or twenty minutes — both are today&apos;s snapshot.</p>
    </div>
  );
}

function Choice({ icon: Icon, title, meta, body, onClick }: { icon: typeof ListChecks; title: string; meta: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group w-full text-left">
      <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift"><CardBody className="flex items-start gap-3.5 sm:p-5">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-orange-500 group-hover:bg-surface"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-ink">{title}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted"><Clock className="h-3 w-3" /> {meta}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </CardBody></Card>
    </button>
  );
}
