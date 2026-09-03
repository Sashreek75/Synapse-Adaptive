"use client";

/**
 * PLANNER — your tasks + notes in one place, and Synapse's structured view of what's actually due.
 * Documents on the left, a block editor on the right. Any line can be a note, a checkable task (with
 * a due date), or a heading. Everything autosaves on-device and feeds Synapse's obligation awareness.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NotebookPen, Plus, Trash2, CheckSquare, Square, Type as TypeIcon, Heading as HeadingIcon,
  CalendarDays, X,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import {
  loadDocs, createDoc, persistDoc, deleteDoc, newLine,
  type PlannerDoc, type PlannerLine, type LineType,
} from "@/lib/planner";
import { cn } from "@/lib/utils";

function dueLabel(due?: string): { text: string; tone: "over" | "today" | "soon" | "none" } {
  if (!due) return { text: "", tone: "none" };
  const d = new Date(due + "T00:00:00").getTime();
  if (Number.isNaN(d)) return { text: "", tone: "none" };
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((s(new Date(d)) - s(new Date())) / 864e5);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: "over" };
  if (days === 0) return { text: "Today", tone: "today" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  return { text: `${days}d`, tone: "soon" };
}

export default function PlannerPage() {
  const [docs, setDocs] = useState<PlannerDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLTextAreaElement | HTMLInputElement>());

  useEffect(() => {
    const sync = () => setDocs(loadDocs());
    sync();
    window.addEventListener("synapse:planner", sync);
    return () => window.removeEventListener("synapse:planner", sync);
  }, []);

  // Keep a selection.
  useEffect(() => {
    if (!docs.length) { setSelectedId(null); return; }
    if (!selectedId || !docs.some((d) => d.id === selectedId)) setSelectedId(docs[0].id);
  }, [docs, selectedId]);

  useEffect(() => {
    if (!focusId) return;
    const el = inputs.current.get(focusId);
    if (el) { el.focus(); if (el instanceof HTMLTextAreaElement) el.setSelectionRange(el.value.length, el.value.length); }
    setFocusId(null);
  }, [focusId, docs]);

  const doc = useMemo(() => docs.find((d) => d.id === selectedId) || null, [docs, selectedId]);

  const mutate = useCallback((docId: string, fn: (d: PlannerDoc) => PlannerDoc) => {
    setDocs((prev) => {
      const next = prev.map((d) => (d.id === docId ? fn(d) : d));
      const changed = next.find((d) => d.id === docId);
      if (changed) persistDoc(changed);
      return next;
    });
  }, []);

  const addDoc = () => { const d = createDoc("Untitled"); setDocs(loadDocs()); setSelectedId(d.id); setFocusId(d.lines[0]?.id ?? null); };
  const removeDoc = (id: string) => { if (!confirm("Delete this document?")) return; deleteDoc(id); setDocs(loadDocs()); };

  const setTitle = (t: string) => doc && mutate(doc.id, (d) => ({ ...d, title: t }));

  const setLine = (lineId: string, patch: Partial<PlannerLine>) =>
    doc && mutate(doc.id, (d) => ({ ...d, lines: d.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }));

  const cycleType = (line: PlannerLine) => {
    const order: LineType[] = ["text", "task", "heading"];
    const next = order[(order.indexOf(line.type) + 1) % order.length];
    setLine(line.id, { type: next, done: next === "task" ? line.done : undefined, due: next === "task" ? line.due : undefined });
  };
  const setType = (line: PlannerLine, type: LineType) =>
    setLine(line.id, { type, done: type === "task" ? line.done : undefined, due: type === "task" ? line.due : undefined });

  const addLineAfter = (afterId: string | null, type: LineType = "text") => {
    if (!doc) return;
    const ln = newLine(type, "");
    mutate(doc.id, (d) => {
      const idx = afterId ? d.lines.findIndex((l) => l.id === afterId) : d.lines.length - 1;
      const lines = [...d.lines];
      lines.splice(idx + 1, 0, ln);
      return { ...d, lines };
    });
    setFocusId(ln.id);
  };

  const removeLine = (lineId: string) => {
    if (!doc) return;
    mutate(doc.id, (d) => {
      const lines = d.lines.filter((l) => l.id !== lineId);
      return { ...d, lines: lines.length ? lines : [newLine("text", "")] };
    });
  };

  const onKeyDown = (e: React.KeyboardEvent, line: PlannerLine) => {
    if (e.key === "Enter" && !e.shiftKey && line.type !== "text") { /* headings/tasks: enter adds next */ }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addLineAfter(line.id, line.type === "heading" ? "text" : line.type);
    }
    if (e.key === "Backspace" && line.text === "" && doc && doc.lines.length > 1) {
      e.preventDefault();
      const idx = doc.lines.findIndex((l) => l.id === line.id);
      const prev = doc.lines[idx - 1];
      removeLine(line.id);
      if (prev) setFocusId(prev.id);
    }
  };

  const taskCount = (d: PlannerDoc) => d.lines.filter((l) => l.type === "task" && !l.done).length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-500"><NotebookPen className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Planner</h1>
          <p className="text-sm text-muted">Your tasks and notes — and how I know what&apos;s actually on your plate.</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        {/* Documents */}
        <aside className="rounded-2xl border bg-surface p-2 shadow-soft lg:h-[70vh] lg:overflow-y-auto">
          <button onClick={addDoc}
            className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-orange-500 transition hover:bg-orange-500/10">
            <Plus className="h-4 w-4" /> New document
          </button>
          {docs.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">No documents yet. Create one to start planning.</p>}
          {docs.map((d) => (
            <button key={d.id} onClick={() => setSelectedId(d.id)}
              className={cn("group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition",
                d.id === selectedId ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink")}>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title || "Untitled"}</span>
              {taskCount(d) > 0 && <span className="shrink-0 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-500">{taskCount(d)}</span>}
            </button>
          ))}
        </aside>

        {/* Editor */}
        <section className="rounded-2xl border bg-surface p-4 shadow-soft sm:p-6 lg:h-[70vh] lg:overflow-y-auto">
          {!doc ? (
            <div className="grid h-full min-h-[40vh] place-items-center text-center">
              <div>
                <p className="text-sm text-muted">Pick a document, or create one.</p>
                <Button size="sm" className="mt-3" onClick={addDoc}><Plus className="h-4 w-4" /> New document</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <input value={doc.title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled"
                  className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-ink placeholder:text-muted/60 focus:outline-none" />
                <button onClick={() => removeDoc(doc.id)} aria-label="Delete document"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-error"><Trash2 className="h-4 w-4" /></button>
              </div>

              <div className="space-y-0.5">
                {doc.lines.map((line) => (
                  <LineRow key={line.id} line={line}
                    registerRef={(el) => { if (el) inputs.current.set(line.id, el); else inputs.current.delete(line.id); }}
                    onText={(t) => setLine(line.id, { text: t })}
                    onToggleDone={() => setLine(line.id, { done: !line.done })}
                    onCycleType={() => cycleType(line)}
                    onSetType={(t) => setType(line, t)}
                    onDue={(due) => setLine(line.id, { due: due || undefined })}
                    onDelete={() => removeLine(line.id)}
                    onKeyDown={(e) => onKeyDown(e, line)} />
                ))}
              </div>

              <button onClick={() => addLineAfter(doc.lines[doc.lines.length - 1]?.id ?? null)}
                className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted transition hover:text-ink">
                <Plus className="h-4 w-4" /> Add a line
              </button>
            </>
          )}
        </section>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Tip: press <kbd className="rounded border px-1">Enter</kbd> for a new line. Turn any line into a task with the ✓ button, then give it a due date — I&apos;ll plan around what&apos;s due.
      </p>
    </div>
  );
}

function LineRow({
  line, registerRef, onText, onToggleDone, onCycleType, onSetType, onDue, onDelete, onKeyDown,
}: {
  line: PlannerLine;
  registerRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  onText: (t: string) => void;
  onToggleDone: () => void;
  onCycleType: () => void;
  onSetType: (t: LineType) => void;
  onDue: (due: string) => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const [dueOpen, setDueOpen] = useState(false);
  const d = dueLabel(line.due);

  // auto-grow textarea
  const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };

  return (
    <div className="group flex items-start gap-2 rounded-lg px-1 py-0.5 transition hover:bg-surface-2/40">
      {/* leading control */}
      <div className="mt-1.5 shrink-0">
        {line.type === "task" ? (
          <button onClick={onToggleDone} aria-label={line.done ? "Mark not done" : "Mark done"}
            className="grid h-5 w-5 place-items-center rounded-md text-orange-500 transition hover:scale-110">
            {line.done ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted" />}
          </button>
        ) : line.type === "heading" ? (
          <span className="grid h-5 w-5 place-items-center text-muted"><HeadingIcon className="h-4 w-4" /></span>
        ) : (
          <span className="grid h-5 w-5 place-items-center text-muted/60">•</span>
        )}
      </div>

      {/* text */}
      <textarea
        ref={(el) => { registerRef(el); grow(el); }}
        value={line.text}
        onChange={(e) => { onText(e.target.value); grow(e.currentTarget); }}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={line.type === "heading" ? "Heading" : line.type === "task" ? "To-do…" : "Write…"}
        className={cn(
          "min-w-0 flex-1 resize-none bg-transparent py-1 leading-relaxed placeholder:text-muted/50 focus:outline-none",
          line.type === "heading" ? "text-lg font-semibold text-ink" : "text-sm",
          line.type === "task" && line.done ? "text-muted line-through" : "text-ink",
        )}
      />

      {/* due chip (tasks) */}
      {line.type === "task" && (d.tone !== "none" || dueOpen) && (
        <div className="mt-1 flex shrink-0 items-center gap-1">
          {d.tone !== "none" && !dueOpen && (
            <button onClick={() => setDueOpen(true)}
              className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                d.tone === "over" ? "bg-error/15 text-error" : d.tone === "today" ? "bg-orange-500/20 text-orange-500" : "bg-surface-2 text-muted")}>
              {d.text}
            </button>
          )}
          {dueOpen && (
            <span className="flex items-center gap-1">
              <input type="date" value={line.due || ""} onChange={(e) => { onDue(e.target.value); }}
                className="rounded-md border bg-surface px-1.5 py-0.5 text-[11px] text-ink focus:outline-none" />
              <button onClick={() => { onDue(""); setDueOpen(false); }} aria-label="Clear due date" className="text-muted hover:text-ink"><X className="h-3.5 w-3.5" /></button>
            </span>
          )}
        </div>
      )}

      {/* row actions (appear on hover/focus) */}
      <div className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button onClick={() => onSetType(line.type === "task" ? "text" : "task")} title="Toggle task"
          className={cn("grid h-7 w-7 place-items-center rounded-md transition hover:bg-surface-2", line.type === "task" ? "text-orange-500" : "text-muted hover:text-ink")}><CheckSquare className="h-4 w-4" /></button>
        <button onClick={() => onSetType(line.type === "heading" ? "text" : "heading")} title="Toggle heading"
          className={cn("grid h-7 w-7 place-items-center rounded-md transition hover:bg-surface-2", line.type === "heading" ? "text-orange-500" : "text-muted hover:text-ink")}><HeadingIcon className="h-4 w-4" /></button>
        {line.type === "task" && (
          <button onClick={() => setDueOpen((v) => !v)} title="Due date"
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"><CalendarDays className="h-4 w-4" /></button>
        )}
        <button onClick={onDelete} title="Delete line" aria-label="Delete line"
          className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-error"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
