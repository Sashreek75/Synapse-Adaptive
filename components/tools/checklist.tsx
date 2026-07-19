"use client";

/**
 * SESSION CHECKLIST — "turn intention into a few concrete steps."
 *
 * The Planner/Executor role in a tiny, durable tool: jot what you're doing today,
 * check it off, clear what's done. Persists locally so it's here when you come
 * back. Deliberately simple — a plan you'll actually use beats a project manager.
 */

import { useEffect, useState } from "react";
import { Plus, X, ListChecks, Eraser } from "lucide-react";
import { Card, CardBody } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const KEY = "synapse.tools.checklist.v1";
interface Item { id: string; text: string; done: boolean }

export function Checklist() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw) as Item[]); } catch {}
    setHydrated(true);
  }, []);

  function persist(next: Item[]) { setItems(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} }
  function add() {
    const t = input.trim(); if (!t) return;
    persist([...items, { id: `t_${Date.now()}`, text: t, done: false }]);
    setInput("");
  }
  function toggle(id: string) { persist(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))); }
  function remove(id: string) { persist(items.filter((i) => i.id !== id)); }
  function clearDone() { persist(items.filter((i) => !i.done)); }

  if (!hydrated) return <Card><CardBody className="h-40" /></Card>;

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card>
      <CardBody className="space-y-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <ListChecks className="h-3.5 w-3.5 text-orange-500" /> Today&apos;s plan
          </p>
          {doneCount > 0 && (
            <button onClick={clearDone} className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-ink">
              <Eraser className="h-3.5 w-3.5" /> Clear done ({doneCount})
            </button>
          )}
        </div>

        <div className="flex gap-2 rounded-2xl border bg-surface p-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add one thing you want to get done…"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-muted focus:outline-none" />
          <button onClick={add} disabled={!input.trim()} aria-label="Add"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-50">
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted">{"Nothing here yet. What's the one thing that would make today feel like progress?"}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li key={i.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                <button onClick={() => toggle(i.id)} aria-pressed={i.done} aria-label={i.done ? "Mark not done" : "Mark done"}
                  className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border transition", i.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line hover:border-orange-400")}>
                  {i.done && <span className="text-[11px] leading-none">✓</span>}
                </button>
                <span className={cn("min-w-0 flex-1 text-sm", i.done ? "text-muted line-through" : "text-ink")}>{i.text}</span>
                <button onClick={() => remove(i.id)} aria-label="Remove" className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100 hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
