import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * A tiny, dependency-free markdown renderer for Synapse's replies.
 *
 * The chat model now returns light markdown (short paragraphs, "- " bullets,
 * "1." steps, **bold**). This turns that into readable, spaced-out UI — the
 * ChatGPT-style rhythm — without pulling in a markdown library.
 */

function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={`${keyBase}-b${i}`} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
      : <Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>,
  );
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: "p", lines: para }); para = []; } };
  const flushUl = () => { if (ul.length) { blocks.push({ type: "ul", items: ul }); ul = []; } };
  const flushOl = () => { if (ol.length) { blocks.push({ type: "ol", items: ol }); ol = []; } };
  const flushAll = () => { flushPara(); flushUl(); flushOl(); };

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet) { flushPara(); flushOl(); ul.push(bullet[1]); }
    else if (ordered) { flushPara(); flushUl(); ol.push(ordered[1]); }
    else { flushUl(); flushOl(); para.push(line); }
  }
  flushAll();
  return blocks;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = parse(text);
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-ink", className)}>
      {blocks.map((b, bi) => {
        if (b.type === "ul") return (
          <ul key={bi} className="space-y-1.5">
            {b.items.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                <span>{renderInline(it, `${bi}-${i}`)}</span>
              </li>
            ))}
          </ul>
        );
        if (b.type === "ol") return (
          <ol key={bi} className="space-y-1.5">
            {b.items.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-navy-500">{i + 1}</span>
                <span>{renderInline(it, `${bi}-${i}`)}</span>
              </li>
            ))}
          </ol>
        );
        return (
          <p key={bi}>
            {b.lines.map((l, i) => (
              <Fragment key={i}>{i > 0 && <br />}{renderInline(l, `${bi}-${i}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
