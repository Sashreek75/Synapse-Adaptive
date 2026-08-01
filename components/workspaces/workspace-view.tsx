"use client";

/**
 * WORKSPACE VIEW — renders a Synapse-composed workspace and persists everything the user
 * types. Four interactive block kinds (checklist, tracker, notes, prompts) cover trackers,
 * boards, practice spaces, and dashboards. "prompts" blocks can hand their answers back to
 * Synapse for review, closing the loop between a built tool and the companion.
 */
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { type Workspace, type WsBlock, type WsData, loadWsData, saveWsData } from "@/lib/workspaces";

type ChecklistItem = { text: string; done: boolean };
type Row = Record<string, string>;

export function WorkspaceView({ ws }: { ws: Workspace }) {
  const [data, setData] = useState<WsData>(() => loadWsData(ws.id));
  const patch = useCallback((i: number, value: unknown) => {
    setData((prev) => { const next = { ...prev, [i]: value }; saveWsData(ws.id, next); return next; });
  }, [ws.id]);
  return (
    <div className="space-y-5">
      {ws.blocks.map((block, i) => (
        <section key={i} className="rounded-2xl border bg-surface p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold text-ink">{block.title}</h2>
          <BlockBody block={block} value={data[i]} onChange={(v) => patch(i, v)} wsTitle={ws.title} />
        </section>
      ))}
    </div>
  );
}

function BlockBody({ block, value, onChange, wsTitle }: { block: WsBlock; value: unknown; onChange: (v: unknown) => void; wsTitle: string }) {
  if (block.kind === "checklist") return <Checklist block={block} value={value} onChange={onChange} />;
  if (block.kind === "tracker") return <Tracker block={block} value={value} onChange={onChange} />;
  if (block.kind === "notes") return <Notes block={block} value={value} onChange={onChange} />;
  return <Prompts block={block} value={value} onChange={onChange} wsTitle={wsTitle} />;
}

function Checklist({ block, value, onChange }: { block: Extract<WsBlock, { kind: "checklist" }>; value: unknown; onChange: (v: unknown) => void }) {
  const items: ChecklistItem[] = Array.isArray(value) ? (value as ChecklistItem[]) : block.items.map((t) => ({ text: t, done: false }));
  const set = (next: ChecklistItem[]) => onChange(next);
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <button onClick={() => set(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} aria-pressed={it.done}
            className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors", it.done ? "border-orange-500 bg-orange-500 text-white" : "bg-surface hover:bg-surface-2")}>
            {it.done && <Check className="h-3.5 w-3.5" />}
          </button>
          <input value={it.text} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="Add a step..."
            className={cn("min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none", it.done && "text-muted line-through")} />
          <button onClick={() => set(items.filter((_, j) => j !== i))} aria-label="Remove" className="shrink-0 text-muted hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={() => set([...items, { text: "", done: false }])} className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-muted hover:text-ink"><Plus className="h-3.5 w-3.5" /> Add item</button>
    </div>
  );
}

function Tracker({ block, value, onChange }: { block: Extract<WsBlock, { kind: "tracker" }>; value: unknown; onChange: (v: unknown) => void }) {
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const set = (next: Row[]) => onChange(next);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              {block.columns.map((c) => <th key={c} className="pb-1.5 pr-3 font-medium">{c}</th>)}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={block.columns.length + 1} className="py-2 text-sm text-muted">Nothing logged yet — add your first entry below.</td></tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-line">
                {block.columns.map((c) => (
                  <td key={c} className="py-1 pr-3">
                    <input value={row[c] ?? ""} onChange={(e) => set(rows.map((r, j) => (j === ri ? { ...r, [c]: e.target.value } : r)))}
                      className="w-full min-w-[6rem] rounded-md bg-surface-2 px-2 py-1 text-sm text-ink focus:outline-none" />
                  </td>
                ))}
                <td><button onClick={() => set(rows.filter((_, j) => j !== ri))} aria-label="Delete row" className="text-muted hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => set([...rows, Object.fromEntries(block.columns.map((c) => [c, ""] as [string, string])) as Row])}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"><Plus className="h-3.5 w-3.5" /> {block.addLabel || "Add row"}</button>
    </div>
  );
}

function Notes({ block, value, onChange }: { block: Extract<WsBlock, { kind: "notes" }>; value: unknown; onChange: (v: unknown) => void }) {
  const v = typeof value === "string" ? value : "";
  return (
    <textarea value={v} onChange={(e) => onChange(e.target.value)} placeholder={block.placeholder || "Write here..."} rows={5}
      className="w-full resize-y rounded-xl border bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none" />
  );
}

function Prompts({ block, value, onChange, wsTitle }: { block: Extract<WsBlock, { kind: "prompts" }>; value: unknown; onChange: (v: unknown) => void; wsTitle: string }) {
  const router = useRouter();
  const answers: Record<number, string> = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<number, string>) : {};
  const set = (i: number, text: string) => onChange({ ...answers, [i]: text });
  const review = () => {
    const qa = block.questions.map((q, i) => `Q: ${q}\nA: ${(answers[i] || "").trim() || "(left blank)"}`).join("\n\n");
    const msg = `I've been working in my "${wsTitle}" space. Please review my answers honestly and tell me what to work on next.\n\n${qa}`;
    try { sessionStorage.setItem("synapse.pendingAsk", msg); } catch {}
    router.push("/dashboard#conversation");
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent("synapse:ask")); } catch {} }, 80);
  };
  return (
    <div className="space-y-3">
      {block.questions.map((q, i) => (
        <div key={i}>
          <p className="mb-1 text-sm text-ink">{q}</p>
          <textarea value={answers[i] ?? ""} onChange={(e) => set(i, e.target.value)} rows={2} placeholder="Your answer..."
            className="w-full resize-y rounded-xl border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
        </div>
      ))}
      {block.reviewable && (
        <Button size="sm" variant="outline" onClick={review}><MessageCircle className="h-4 w-4" /> Ask Synapse to review</Button>
      )}
    </div>
  );
}
