"use client";

/**
 * The wisdom surface on "Who You're Becoming": the rare, earned revisions in how Synapse sees the
 * person ("I used to think... now I think..."), and the living principles it weighs every decision
 * against. This is where accumulated wisdom — not just information — becomes visible.
 */
import { useEffect, useState } from "react";
import { RefreshCw, Plus, Trash2, Lightbulb } from "lucide-react";
import { Card, CardBody } from "@/components/ui/primitives";
import {
  loadPrinciples, loadMindShifts, addPrinciple, updatePrinciple, removePrinciple, removeMindShift,
  type Principle, type MindShift,
} from "@/lib/principles";
import { validateText } from "@/lib/validation";

export function ChangedMyMind() {
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [shifts, setShifts] = useState<MindShift[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const sync = () => { setPrinciples(loadPrinciples()); setShifts(loadMindShifts()); };
    sync();
    window.addEventListener("synapse:principles", sync);
    return () => window.removeEventListener("synapse:principles", sync);
  }, []);

  const draftCheck = validateText(draft, { minLength: 4 });
  const add = () => { if (draftCheck.ok) { addPrinciple(draft); setDraft(""); } };

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-5 sm:p-6">
        {shifts.length > 0 && (
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><RefreshCw className="h-4 w-4 text-orange-500" /> What I&apos;ve changed my mind about you</p>
            <div className="space-y-2">
              {[...shifts].reverse().map((m) => (
                <div key={m.id} className="group flex items-start justify-between gap-2 rounded-xl border border-orange-200/50 bg-orange-500/5 p-3">
                  <p className="text-sm leading-relaxed text-ink">
                    {m.from ? <><span className="text-muted">I used to think {m.from}. </span>Now: {m.to}</> : m.to}
                  </p>
                  <button onClick={() => removeMindShift(m.id)} aria-label="Remove" className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100 hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><Lightbulb className="h-4 w-4 text-orange-500" /> What&apos;s almost always true for you</p>
          {principles.length > 0 ? (
            <div className="space-y-1.5">
              {principles.map((p) => (
                <div key={p.id} className="group flex items-center gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  <input defaultValue={p.text} onBlur={(e) => updatePrinciple(p.id, e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none" />
                  <button onClick={() => removePrinciple(p.id)} aria-label="Remove" className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100 hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Nothing carved in yet. As we work together I&apos;ll form a few durable truths about how you actually work — and I&apos;ll tell you honestly when I change my mind about you.</p>
          )}
          <div className="mt-3 flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a truth about yourself..." className="min-w-0 flex-1 rounded-lg border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none" />
            <button onClick={add} disabled={!draftCheck.ok} aria-label="Add principle" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-muted hover:text-ink disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
          {draft.trim().length > 0 && draftCheck.message && <p className="mt-1.5 text-xs text-orange-400">{draftCheck.message}</p>}
        </div>
      </CardBody>
    </Card>
  );
}
