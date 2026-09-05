"use client";

/**
 * PLANNER — a full-screen, spacious writing surface (docs on the left, a big clean editor filling the
 * rest). Type anything: notes, headings, checkable tasks with due dates. Paste multi-line text and it
 * splits into blocks; markdown-ish shortcuts ("# ", "[] ", "- ") convert on the fly; Shift+Enter for a
 * soft line break. Everything autosaves on-device and — crucially — the FULL content feeds Synapse, so
 * it reads your notes and uses them as context when it advises you.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NotebookPen, Plus, Trash2, CheckSquare, Square, Heading as HeadingIcon,
  CalendarDays, X, PanelLeft, FileText, Check,
} from "lucide-react";
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
  if (days <= 7) return { text: `${days}d`, tone: "soon" };
  return { text: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }), tone: "soon" };
}

/** Detect a block type from a raw (pasted or typed) line, markdown-ish. */
function detectLine(raw: string): { type: LineType; text: string; done?: boolean } {
  const t = raw.replace(/\s+$/, "");
  if (/^#{1,3}\s+/.test(t)) return { type: "heading", text: t.replace(/^#{1,3}\s+/, "") };
  const task = t.match(/^\s*(?:[-*]\s+)?\[(\s|x|X)\]\s+(.*)$/);
  if (task) return { type: "task", text: task[2], done: /x/i.test(task[1]) };
  const bullet = t.match(/^\s*[-*•]\s+(.*)$/);
  if (bullet) return { type: "text", text: bullet[1] };
  return { type: "text", text: t };
}

export default function PlannerPage() {
  const [docs, setDocs] = useState<PlannerDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());

  useEffect(() => {
    const sync = () => setDocs(loadDocs());
    sync();
    window.addEventListener("synapse:planner", sync);
    return () => window.removeEventListener("synapse:planner", sync);
  }, []);

  useEffect(() => {
    if (!docs.length) { setSelectedId(null); return; }
    if (!selectedId || !docs.some((d) => d.id === selectedId)) setSelectedId(docs[0].id);
  }, [docs, selectedId]);

  useEffect(() => {
    if (!focusId) return;
    const el = inputs.current.get(focusId);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
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

  const addDoc = () => { const d = createDoc("Untitled"); setDocs(loadDocs()); setSelectedId(d.id); setFocusId(d.lines[0]?.id ?? null); setNavOpen(false); };
  const removeDoc = (id: string) => { if (!confirm("Delete this document?")) return; deleteDoc(id); setDocs(loadDocs()); };
  const setTitle = (t: string) => doc && mutate(doc.id, (d) => ({ ...d, title: t }));

  const setLine = (lineId: string, patch: Partial<PlannerLine>) =>
    doc && mutate(doc.id, (d) => ({ ...d, lines: d.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }));

  const setType = (line: PlannerLine, type: LineType) =>
    setLine(line.id, { type, done: type === "task" ? line.done : undefined, due: type === "task" ? line.due : undefined });

  // Typing shortcuts: "# ", "[] ", "- " convert a text line as you type.
  const onLineText = (line: PlannerLine, value: string) => {
    if (line.type === "text") {
      const det = detectLine(value);
      if (det.type !== "text" || det.text !== value) {
        setLine(line.id, { type: det.type, text: det.text, done: det.type === "task" ? !!det.done : undefined });
        return;
      }
    }
    setLine(line.id, { text: value });
  };

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

  const insertLinesAfter = (afterId: string, blocks: { type: LineType; text: string; done?: boolean }[]) => {
    if (!doc || !blocks.length) return;
    const made = blocks.map((b) => ({ ...newLine(b.type, b.text), done: b.type === "task" ? !!b.done : undefined }));
    mutate(doc.id, (d) => {
      const idx = d.lines.findIndex((l) => l.id === afterId);
      const lines = [...d.lines];
      lines.splice(idx + 1, 0, ...made);
      return { ...d, lines };
    });
    setFocusId(made[made.length - 1].id);
  };

  const removeLine = (lineId: string) => {
    if (!doc) return;
    mutate(doc.id, (d) => {
      const lines = d.lines.filter((l) => l.id !== lineId);
      return { ...d, lines: lines.length ? lines : [newLine("text", "")] };
    });
  };

  const onKeyDown = (e: React.KeyboardEvent, line: PlannerLine) => {
    if (e.key === "Enter" && e.shiftKey) return; // soft newline within the block
    if (e.key === "Enter") {
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
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && line.type === "task") {
      e.preventDefault();
      setLine(line.id, { done: !line.done });
    }
  };

  const onPaste = (e: React.ClipboardEvent, line: PlannerLine) => {
    const text = e.clipboardData.getData("text");
    if (!text || !/\r?\n/.test(text)) return; // single line → let the textarea handle it (keeps caret)
    e.preventDefault();
    const rawLines = text.split(/\r?\n/);
    const nonEmpty = rawLines.filter((r) => r.trim().length > 0);
    if (!nonEmpty.length) return;
    const [first, ...rest] = nonEmpty;
    const firstDet = detectLine(first);
    // Merge the first pasted line into the current block (respecting its detected type if the block was empty).
    if (line.type === "text" && line.text.trim() === "") setLine(line.id, { type: firstDet.type, text: firstDet.text, done: firstDet.type === "task" ? !!firstDet.done : undefined });
    else setLine(line.id, { text: (line.text + first).slice(0, 5000) });
    if (rest.length) insertLinesAfter(line.id, rest.map(detectLine));
  };

  const taskStats = (d: PlannerDoc) => {
    const tasks = d.lines.filter((l) => l.type === "task" && l.text.trim());
    return { open: tasks.filter((t) => !t.done).length, total: tasks.length };
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-30 flex bg-surface sm:top-16">
      {/* mobile backdrop */}
      {navOpen && <button aria-label="Close documents" onClick={() => setNavOpen(false)} className="absolute inset-0 z-10 bg-black/40 md:hidden" />}

      {/* Documents sidebar */}
      <aside className={cn(
        "absolute z-20 flex h-full w-72 shrink-0 flex-col border-r bg-surface-2/50 backdrop-blur transition-transform md:static md:w-64 md:translate-x-0",
        navOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-500"><NotebookPen className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Planner</p>
            <p className="truncate text-[11px] text-muted">Synapse reads these to help you</p>
          </div>
          <button onClick={() => setNavOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface md:hidden"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-2.5">
          <button onClick={addDoc}
            className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-medium text-orange-500 transition hover:border-orange-500/40 hover:bg-orange-500/10">
            <Plus className="h-4 w-4" /> New document
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4">
          {docs.length === 0 && <p className="px-3 py-8 text-center text-xs text-muted">No documents yet.<br />Create one to start planning.</p>}
          {docs.map((d) => {
            const st = taskStats(d);
            return (
              <button key={d.id} onClick={() => { setSelectedId(d.id); setNavOpen(false); }}
                className={cn("group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
                  d.id === selectedId ? "bg-surface text-ink shadow-soft" : "text-muted hover:bg-surface/70 hover:text-ink")}>
                <FileText className={cn("h-4 w-4 shrink-0", d.id === selectedId ? "text-orange-500" : "text-muted/70")} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title || "Untitled"}</span>
                {st.open > 0 && <span className="shrink-0 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-500">{st.open}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* slim top bar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <button onClick={() => setNavOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink md:hidden"><PanelLeft className="h-5 w-5" /></button>
          <span className="hidden items-center gap-1.5 text-xs text-muted md:inline-flex"><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved on this device</span>
          <div className="ml-auto flex items-center gap-1">
            {doc && (
              <button onClick={() => removeDoc(doc.id)} aria-label="Delete document"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-error"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!doc ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10 text-orange-500"><NotebookPen className="h-7 w-7" /></span>
                <p className="text-lg font-medium text-ink">Your planning space</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Documents, notes, and tasks — and the clearest picture Synapse has of what&apos;s on your plate.</p>
                <button onClick={addDoc} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600"><Plus className="h-4 w-4" /> New document</button>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-10 sm:py-12">
              <input value={doc.title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled"
                className="mb-4 w-full bg-transparent text-3xl font-bold tracking-tight text-ink placeholder:text-muted/40 focus:outline-none sm:text-4xl" />

              <div className="space-y-0.5">
                {doc.lines.map((line) => (
                  <LineRow key={line.id} line={line}
                    registerRef={(el) => { if (el) inputs.current.set(line.id, el); else inputs.current.delete(line.id); }}
                    onText={(t) => onLineText(line, t)}
                    onToggleDone={() => setLine(line.id, { done: !line.done })}
                    onSetType={(t) => setType(line, t)}
                    onDue={(due) => setLine(line.id, { due: due || undefined })}
                    onDelete={() => removeLine(line.id)}
                    onKeyDown={(e) => onKeyDown(e, line)}
                    onPaste={(e) => onPaste(e, line)} />
                ))}
              </div>

              <button onClick={() => addLineAfter(doc.lines[doc.lines.length - 1]?.id ?? null)}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted/70 transition hover:bg-surface-2/50 hover:text-ink">
                <Plus className="h-4 w-4" /> Add a line
              </button>

              <p className="mt-10 border-t pt-4 text-xs text-muted/70">
                <kbd className="rounded border px-1">Enter</kbd> new line · <kbd className="rounded border px-1">Shift</kbd>+<kbd className="rounded border px-1">Enter</kbd> soft break · type <code className="rounded bg-surface-2 px-1">#</code> for a heading, <code className="rounded bg-surface-2 px-1">[]</code> for a task · paste anything.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LineRow({
  line, registerRef, onText, onToggleDone, onSetType, onDue, onDelete, onKeyDown, onPaste,
}: {
  line: PlannerLine;
  registerRef: (el: HTMLTextAreaElement | null) => void;
  onText: (t: string) => void;
  onToggleDone: () => void;
  onSetType: (t: LineType) => void;
  onDue: (due: string) => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
}) {
  const [dueOpen, setDueOpen] = useState(false);
  const d = dueLabel(line.due);
  const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };

  return (
    <div className="group relative flex items-start gap-2.5 rounded-lg px-1.5 py-0.5 transition hover:bg-surface-2/40">
      {/* leading control */}
      <div className={cn("shrink-0", line.type === "heading" ? "mt-2.5" : "mt-2")}>
        {line.type === "task" ? (
          <button onClick={onToggleDone} aria-label={line.done ? "Mark not done" : "Mark done"}
            className="grid h-5 w-5 place-items-center rounded-md transition hover:scale-110">
            {line.done ? <CheckSquare className="h-[18px] w-[18px] text-orange-500" /> : <Square className="h-[18px] w-[18px] text-muted/60" />}
          </button>
        ) : line.type === "heading" ? (
          <span className="grid h-5 w-5 place-items-center text-muted/50"><HeadingIcon className="h-4 w-4" /></span>
        ) : (
          <span className="grid h-5 w-5 place-items-center text-lg leading-none text-muted/40">•</span>
        )}
      </div>

      {/* text */}
      <textarea
        ref={(el) => { registerRef(el); grow(el); }}
        value={line.text}
        onChange={(e) => { onText(e.target.value); grow(e.currentTarget); }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={1}
        placeholder={line.type === "heading" ? "Heading" : line.type === "task" ? "To-do…" : "Write, paste, or type ‘# ’ / ‘[] ’…"}
        className={cn(
          "min-w-0 flex-1 resize-none bg-transparent py-1 leading-7 placeholder:text-muted/40 focus:outline-none",
          line.type === "heading" ? "text-xl font-semibold text-ink" : "text-[15px]",
          line.type === "task" && line.done ? "text-muted line-through" : "text-ink",
        )}
      />

      {/* due chip (tasks) */}
      {line.type === "task" && (d.tone !== "none" || dueOpen) && (
        <div className="mt-1.5 flex shrink-0 items-center gap-1">
          {d.tone !== "none" && !dueOpen && (
            <button onClick={() => setDueOpen(true)}
              className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                d.tone === "over" ? "bg-error/15 text-error" : d.tone === "today" ? "bg-orange-500/20 text-orange-500" : "bg-surface-2 text-muted")}>
              {d.text}
            </button>
          )}
          {dueOpen && (
            <span className="flex items-center gap-1">
              <input type="date" value={line.due || ""} onChange={(e) => onDue(e.target.value)} autoFocus
                className="rounded-md border bg-surface px-1.5 py-0.5 text-[11px] text-ink focus:outline-none" />
              <button onClick={() => { onDue(""); setDueOpen(false); }} aria-label="Clear due date" className="text-muted hover:text-ink"><X className="h-3.5 w-3.5" /></button>
            </span>
          )}
        </div>
      )}

      {/* row actions */}
      <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
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
