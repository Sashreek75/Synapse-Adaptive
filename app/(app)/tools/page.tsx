"use client";

/**
 * TOOLS — the Executor role, as surfaces you actually use.
 *
 * A calm home for the practical things Synapse can do FOR you: a focus timer and
 * a session checklist today (drafts, summaries, brainstorming and planning happen
 * in the conversation, where the Executor/Teacher role delivers them). Deliberately
 * small and dependable — no dashboards, no metrics, just tools that help you move.
 */

import Link from "next/link";
import { Wrench, MessageCircle } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { FocusTimer } from "@/components/tools/focus-timer";
import { Checklist } from "@/components/tools/checklist";

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <Wrench className="h-5 w-5 text-orange-500" /> Tools
          </h1>
          <p className="text-sm text-muted">{"Practical help for getting things done — set a timer, plan your day, then get to work."}</p>
        </div>
      </header>

      <FocusTimer />
      <Checklist />

      <Card className="bg-surface/60">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{"Need a draft, a summary, or a plan? Just ask — I'll put it together with you."}</p>
          <Link href="/dashboard#conversation" className="shrink-0"><Button size="sm" variant="outline">Ask Synapse <MessageCircle className="h-4 w-4" /></Button></Link>
        </CardBody>
      </Card>
    </div>
  );
}
