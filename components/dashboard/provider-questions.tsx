"use client";

import { useState } from "react";
import { Check, Plus, Stethoscope } from "lucide-react";
import { Card, CardBody, SectionLabel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useHealth } from "@/components/providers/health-store";

export function ProviderQuestionsCard() {
  const { providerQuestions, addProviderQuestion, setQuestionStatus } = useHealth();
  const [draft, setDraft] = useState("");

  return (
    <Card className="sa-card-hover">
      <CardBody>
        <SectionLabel className="flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5" /> Questions for your provider
        </SectionLabel>
        {providerQuestions.length === 0 ? (
          <p className="text-sm text-muted">As insights come up, questions worth asking your provider will collect here. You can add your own too.</p>
        ) : (
          <ul className="space-y-2">
            {providerQuestions.map((q) => (
              <li key={q.id} className="flex items-start gap-3">
                <button
                  onClick={() => setQuestionStatus(q.id, q.status === "asked" ? "open" : "asked")}
                  aria-label="Toggle asked"
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                    q.status === "asked" ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-surface text-transparent hover:border-navy-400",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <span className={cn("text-sm", q.status === "asked" ? "text-muted line-through" : "text-ink")}>{q.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { addProviderQuestion(draft.trim()); setDraft(""); } }}
            placeholder="Add your own question…"
            className="flex-1 rounded-full border bg-surface px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
          />
          <button
            onClick={() => { if (draft.trim()) { addProviderQuestion(draft.trim()); setDraft(""); } }}
            aria-label="Add" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-white hover:bg-navy-700">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
