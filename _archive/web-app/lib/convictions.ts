/**
 * CONVICTIONS — the standing judgments Synapse is willing to stand behind.
 *
 * V11 turns Synapse from "correct" into "worth listening to". A conviction is not advice
 * and not an observation — it is a conclusion Synapse holds, voices rarely, expresses with
 * humility, and (crucially) REMEMBERS. Convictions persist, influence future conversations
 * until the evidence changes, and carry their own falsifier ("what would change my mind").
 *
 * This is a behavioral layer. It NEVER manufactures certainty: convictions are only ever
 * promoted from judgments the frozen machinery already earned (a momentum read that has
 * cleared its gates, or the reasoning pipeline saying it changed its mind). Nothing here
 * touches the statistical engine, confidence math, memory architecture, or safety.
 */

import type { MomentumRead } from "@/lib/momentum";
import type { FocusLike } from "@/lib/commitments";
import { witness } from "@/lib/activity";

export const CONVICTIONS_KEY = "synapse.convictions.v1";

export type ConvictionStatus = "held" | "revised" | "released";
export type ConvictionSource = "momentum" | "mindshift" | "reasoning" | "drift" | "growth";
/** How the conviction should OPEN: an invitation to think together, a gentle challenge, a
 * naming of growth the person hasn't noticed, or a plain thought. Collaboration over verdict. */
export type ConvictionTone = "invite" | "challenge" | "growth" | "thought";

export interface Conviction {
  id: string;
  statement: string;        // the judgment, in the first person
  basis: string;            // what points to it, in plain words
  wouldChangeIt: string;    // the falsifier — what would make Synapse drop it
  humility: string;         // e.g. "I could be wrong," ("" when none needed)
  tone: ConvictionTone;     // shapes how it opens (invite / challenge / growth / thought)
  source: ConvictionSource;
  status: ConvictionStatus;
  createdAt: string;
  updatedAt: string;
  lastSurfacedAt?: string;
  history: { at: string; status: ConvictionStatus; note?: string }[];
}

/** Convictions are RARE by construction: at most one surfaces every few days. Scarcity is
 * what gives them weight — when Synapse says "I've been thinking", the user should stop. */
export const SURFACE_GAP_MS = 3 * 864e5;

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function loadConvictions(): Conviction[] {
  try { const r = localStorage.getItem(CONVICTIONS_KEY); return r ? (JSON.parse(r) as Conviction[]) : []; } catch { return []; }
}
function save(list: Conviction[]) { try { localStorage.setItem(CONVICTIONS_KEY, JSON.stringify(list.slice(-60))); } catch {} }
function emit() { try { window.dispatchEvent(new CustomEvent("synapse:convictions")); } catch {} }

export function heldConvictions(list: Conviction[] = loadConvictions()): Conviction[] {
  return list.filter((c) => c.status === "held");
}

export interface ConvictionCandidate { statement: string; basis: string; wouldChangeIt: string; humility?: string; source: ConvictionSource; tone?: ConvictionTone }

/** Hold a conviction. Deduped by statement so the same judgment is never doubled; returns
 * the existing one if already held. This is the ONLY way a conviction enters the store, and
 * callers only ever pass judgments the engine/momentum already earned. */
export function promoteConviction(cand: ConvictionCandidate, now = new Date()): Conviction {
  const list = loadConvictions();
  const existing = list.find((c) => c.status === "held" && norm(c.statement) === norm(cand.statement));
  if (existing) return existing;
  const iso = now.toISOString();
  const c: Conviction = {
    id: `cv_${now.getTime()}`, statement: cand.statement.trim(), basis: cand.basis, wouldChangeIt: cand.wouldChangeIt,
    humility: cand.humility ?? "I could be wrong,", tone: cand.tone ?? "thought", source: cand.source, status: "held",
    createdAt: iso, updatedAt: iso, history: [{ at: iso, status: "held" }],
  };
  list.push(c); save(list); emit(); return c;
}

/** Synapse changing its mind — this STRENGTHENS trust, so it is first-class, not a failure. */
export function reviseConviction(id: string, note?: string, now = new Date()): void {
  const list = loadConvictions(); const c = list.find((x) => x.id === id); if (!c) return;
  const iso = now.toISOString(); c.status = "revised"; c.updatedAt = iso; c.history.push({ at: iso, status: "revised", note }); save(list); emit();
}
export function releaseConviction(id: string, note?: string, now = new Date()): void {
  const list = loadConvictions(); const c = list.find((x) => x.id === id); if (!c) return;
  const iso = now.toISOString(); c.status = "released"; c.updatedAt = iso; c.history.push({ at: iso, status: "released", note }); save(list); emit(); witness("conviction_released", c.statement);
}

/** The one conviction it is appropriate to VOICE right now — or null. Scarcity + timing:
 * a held conviction that has never surfaced, or not for a few days. Good judgment is mostly restraint. */
export function convictionToSurface(list: Conviction[] = loadConvictions(), now = new Date()): Conviction | null {
  const t = now.getTime();
  const held = heldConvictions(list);
  if (!held.length) return null;
  const recentlySurfaced = held.some((c) => c.lastSurfacedAt && t - new Date(c.lastSurfacedAt).getTime() < SURFACE_GAP_MS);
  if (recentlySurfaced) return null;                 // one at a time, spaced out — protect the weight
  const unsurfaced = held.filter((c) => !c.lastSurfacedAt);
  const pick = (unsurfaced.length ? unsurfaced : held).slice(-1)[0];
  return pick ?? null;
}

export function recordSurfaced(id: string, now = new Date()): void {
  const list = loadConvictions(); const c = list.find((x) => x.id === id); if (!c) return;
  c.lastSurfacedAt = now.toISOString(); save(list); witness("conviction_seen", c.statement);
}

/** Lines describing currently-held convictions, for the conversation context — so a belief
 * Synapse holds actually shapes future replies until the evidence changes. */
export function convictionContextLines(list: Conviction[] = loadConvictions()): string[] {
  return heldConvictions(list).map((c) => `Standing conviction you currently hold about them (act from it, express it with humility, and revise it out loud if the evidence shifts): "${c.statement}" — based on ${c.basis}. You would change your mind if ${c.wouldChangeIt}.`);
}

/* ── Deriving convictions from already-earned judgments (never manufactured) ──────── */

/** Promote a momentum read into a standing judgment — only the conviction-worthy kinds
 * (the ones that are genuine judgments, not encouragement). Returns a candidate or null. */
export function convictionFromMomentum(m: MomentumRead): ConvictionCandidate | null {
  switch (m.kind) {
    case "stuck":
      return { source: "momentum", tone: "challenge", statement: "I don't think the task itself is the real problem here — something underneath it is.", basis: "we keep circling the same commitment without it moving", wouldChangeIt: "you break through it in a session or two", humility: "I might be wrong, but" };
    case "shrinking":
      return { source: "momentum", tone: "challenge", statement: "I think your confidence dipped before your schedule did — the ambition faded first.", basis: "your promises have been getting quietly smaller", wouldChangeIt: "you set a bigger one and keep it", humility: "I could be wrong," };
    case "fracturing":
      return { source: "momentum", tone: "challenge", statement: "I don't think this is a discipline problem — something changed for you.", basis: "a run of missed promises that isn't like you", wouldChangeIt: "you string a few kept promises together again", humility: "I could be wrong," };
    case "raise_bar":
      return { source: "momentum", tone: "growth", statement: "I think you've outgrown the size of the steps you've been setting.", basis: "you've kept everything you promised for a good stretch", wouldChangeIt: "a bigger ask turns out to be too much right now", humility: "" };
    default:
      return null;  // building / recovering / early are encouragement, not convictions
  }
}

/** POSITIVE INTERRUPTION — name growth the person hasn't noticed. People rarely update their
 * identity UPWARD; when earned momentum shows they've become someone new, say so as confidently
 * as any challenge. Fires only on already-earned strength — never flattery. */
export function convictionFromGrowth(trajectory: string | null | undefined, m: MomentumRead, focus: FocusLike[] = []): ConvictionCandidate | null {
  const focusGrew = (() => {
    if (focus.length < 4) return false;
    const mins = focus.map((x) => Math.round(x.elapsedSec / 60));
    const third = Math.max(1, Math.floor(mins.length / 3));
    return Math.max(...mins.slice(-third)) >= Math.max(...mins.slice(0, third)) + 15;
  })();
  if (m.kind === "raise_bar") {
    return { source: "growth", tone: "growth",
      statement: "I don't think you've noticed what's changed — a while ago every hard step was a negotiation; lately you just begin. I think you've become more consistent than you still give yourself credit for.",
      basis: "a sustained run of promises made and kept", wouldChangeIt: "you'd have to start slipping repeatedly for me to doubt it", humility: "" };
  }
  if (m.state === "building" && focusGrew) {
    return { source: "growth", tone: "growth",
      statement: "Worth saying out loud: your focus has grown a lot — the stretches that used to be your ceiling are routine now. You're becoming someone who does the deep work, whether you've registered it yet or not.",
      basis: "your focus sessions getting materially longer over time", wouldChangeIt: "a real, sustained drop back toward where you started", humility: "" };
  }
  return null;
}

/** The reasoning pipeline's "I've changed my mind" is itself a conviction, already humble. */
export function convictionFromMindShift(mindShift?: string | null): ConvictionCandidate | null {
  const s = (mindShift || "").trim();
  if (!s) return null;
  return { source: "mindshift", tone: "invite", statement: s, basis: "watching your own data change over time", wouldChangeIt: "the trend reverses again", humility: "" };
}

/* ── GUARDIANSHIP: the drift conviction ─────────────────────────────────────────
 * The highest-stakes judgment of all. Once someone tells Synapse who they are trying to
 * become, Synapse quietly guards that future — and if their actions and their aspiration
 * sustain a separation (an EARNED drift, never one bad day), it says so first. It always
 * leaves room that the goal itself may have honestly changed; the point is that drift be
 * chosen consciously, not happen by accident. Fires only on already-earned momentum. */
export function convictionFromDrift(trajectory: string | null | undefined, m: MomentumRead): ConvictionCandidate | null {
  const goal = (trajectory || "").trim();
  if (!goal) return null;                 // nothing to guard yet
  if (m.kind !== "fracturing") return null; // only sustained separation counts as drift
  return {
    source: "drift",
    tone: "challenge",
    statement: `I don't think your days are pointing at ${goal} the way they were — your actions and what you told me you want are starting to disagree.`,
    basis: "a sustained stretch where what you're doing and what you said you're working toward have pulled apart",
    wouldChangeIt: "you put a few real steps back toward it — or you tell me the goal itself has genuinely changed",
    humility: "I might be reading this wrong,",
  };
}
