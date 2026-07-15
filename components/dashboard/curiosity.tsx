"use client";

import { useMemo, useState } from "react";
import { MessageCircleQuestion, Check } from "lucide-react";
import { Card, CardBody } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { curiosityQuestion } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

/** "Questions Synapse wants to ask" — adaptive curiosity that fills context gaps. */
export function Curiosity() {
  const { profile, series, recentChanges, contextNotes, addContextNote } = useHealth();
  const q = useMemo(() => curiosityQuestion(series, profile.path, recentChanges), [series, profile.path, recentChanges]);
  const [answered, setAnswered] = useState(false);
  const [custom, setCustom] = useState("");

  // Only ask once per day per prompt.
  const askedToday = contextNotes.some((n) => n.date.slice(0, 10) === new Date().toISOString().slice(0, 10) && n.prompt === q.prompt);
  if (askedToday || answered) {
    return (
      <Card className="border-emerald-200/60 dark:border-emerald-500/20"><CardBody className="flex items-center gap-2 text-sm text-muted">
        <Check className="h-4 w-4 text-emerald-600" /> Thanks — I&apos;ll factor that into your next report.
      </CardBody></Card>
    );
  }

  function answer(text: string) {
    if (!text.trim()) return;
    addContextNote(q.prompt, text.trim());
    setAnswered(true);
  }

  return (
    <Card className="sa-rise overflow-hidden border-navy-200/50">
      <CardBody>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-navy-500">
          <MessageCircleQuestion className="h-3.5 w-3.5 text-orange-500" /> Synapse wants to ask
        </div>
        <p className="text-ink">{q.prompt}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {q.chips.map((c) => (
            <button key={c} onClick={() => answer(c)} className={cn("rounded-full border bg-surface px-3 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:text-ink")}>{c}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && answer(custom)} placeholder="…or tell me in your words" className="flex-1 rounded-full border bg-surface px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400" />
        </div>
      </CardBody>
    </Card>
  );
}
