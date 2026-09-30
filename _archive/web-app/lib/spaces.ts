/**
 * SPACES — the user's own filing system for their health information.
 *
 * The user creates folders with plain-language names ("Behavioral insights",
 * "My sleep stuff"). Synapse can't reliably route by free-text names alone, so
 * every piece of content is TAGGED with stable categories, and each Space holds
 * a set of those tags. We infer a Space's tags from its name; if the name is
 * ambiguous we ask the user to pick once (in the UI) and remember it. This keeps
 * names human while routing stays reliable.
 */

import { metricLabel } from "@/lib/metrics";
import type { Insight, SignalId } from "@/types";
import type { ExperimentRecord } from "@/lib/focus";

export type SpaceTag =
  | "behavioral" | "sleep" | "focus" | "stress" | "mood"
  | "energy" | "recovery" | "cognition" | "symptoms" | "general";

export const SPACE_TAGS: { tag: SpaceTag; label: string; hint: string }[] = [
  { tag: "behavioral", label: "Behavioral insights", hint: "Recommendations, suggestions & experiments" },
  { tag: "sleep", label: "Sleep", hint: "Sleep quality & consistency" },
  { tag: "focus", label: "Focus & attention", hint: "Attention and concentration" },
  { tag: "stress", label: "Stress", hint: "Stress & pressure" },
  { tag: "mood", label: "Mood", hint: "How you're feeling" },
  { tag: "energy", label: "Energy", hint: "Energy & fatigue" },
  { tag: "recovery", label: "Recovery", hint: "Injury / rehab / recovery" },
  { tag: "cognition", label: "Cognition", hint: "Memory, reaction, processing" },
  { tag: "symptoms", label: "Symptoms", hint: "Symptom tracking" },
  { tag: "general", label: "Everything else", hint: "Anything not otherwise categorized" },
];

export const TAG_LABEL: Record<SpaceTag, string> = Object.fromEntries(
  SPACE_TAGS.map((t) => [t.tag, t.label]),
) as Record<SpaceTag, string>;

export interface Space {
  id: string;
  name: string;
  tags: SpaceTag[];
  createdAt: string;
  /** Items the user manually added (override auto-tagging). */
  pinnedIds?: string[];
  /** Items the user manually removed from this folder. */
  hiddenIds?: string[];
}

export interface SpaceItem {
  id: string;
  kind: "focus" | "experiment" | "insight" | "note";
  title: string;
  body?: string;
  date?: string;
  tags: SpaceTag[];
}

const METRIC_TAGS: Partial<Record<SignalId, SpaceTag[]>> = {
  sleep_quality: ["sleep"],
  fatigue: ["energy"],
  stress: ["stress"],
  mood: ["mood"],
  attention: ["focus", "cognition"],
  reaction_time: ["cognition"],
  working_memory: ["cognition"],
  processing_speed: ["cognition"],
  symptoms: ["symptoms"],
};

/** Keyword hints that map a folder name (or a free-text note) to tags. */
const HINTS: [RegExp, SpaceTag][] = [
  [/behav|habit|routine|action|suggest|recommend|advice|insight|experiment|coach|decision|focus of/i, "behavioral"],
  [/sleep|rest|bed ?time|nap|insomnia/i, "sleep"],
  [/focus|attention|concentrat|distract/i, "focus"],
  [/stress|anxiet|overwhelm|pressure|tension|calm/i, "stress"],
  [/mood|feel|emotion|happy|sad|down|irritab/i, "mood"],
  [/energy|fatigue|tired|exhaust|drained|stamina/i, "energy"],
  [/recover|rehab|injur|\bpt\b|physical therapy|knee|concussion|surgery|healing/i, "recovery"],
  [/cogniti|memory|brain|mental|reaction|processing|think|sharp/i, "cognition"],
  [/symptom|pain|headache|flare|ache|dizz|nausea/i, "symptoms"],
];

/** Infer a Space's tags from its name. Returns [] when the name is ambiguous. */
export function inferTagsFromName(name: string): SpaceTag[] {
  const out = new Set<SpaceTag>();
  for (const [re, tag] of HINTS) if (re.test(name)) out.add(tag);
  return [...out];
}

/** Tag a free-text note by scanning its words. */
function tagsForText(text: string): SpaceTag[] {
  const out = new Set<SpaceTag>();
  for (const [re, tag] of HINTS) if (re.test(text)) out.add(tag);
  return out.size ? [...out] : ["general"];
}

function tagsForInsight(i: Insight): SpaceTag[] {
  const out = new Set<SpaceTag>();
  for (const ref of i.evidenceRefs ?? []) {
    const m = ref.replace("metric:", "") as SignalId;
    for (const t of METRIC_TAGS[m] ?? []) out.add(t);
  }
  if (i.category === "behavioral_focus" || (i.suggestedFocus?.length ?? 0) > 0) out.add("behavioral");
  return out.size ? [...out] : ["general"];
}

const metricTags = (m: SignalId): SpaceTag[] => [...new Set([...(METRIC_TAGS[m] ?? []), "behavioral" as SpaceTag])];

export interface SpaceSourceData {
  insights?: Insight[];
  experiments?: ExperimentRecord[];
  notes?: { id: string; prompt: string; answer: string; date: string }[];
  focus?: { id: string; title: string; metric: SignalId; focusAction: string } | null;
}

/** Build every taggable item from the user's current data. */
export function allItems(data: SpaceSourceData): SpaceItem[] {
  const items: SpaceItem[] = [];
  if (data.focus) {
    items.push({
      id: `focus_${data.focus.id}`, kind: "focus",
      title: `This week's focus — ${data.focus.title}`, body: data.focus.focusAction,
      tags: metricTags(data.focus.metric),
    });
  }
  for (const e of data.experiments ?? []) {
    items.push({
      id: `exp_${e.id}`, kind: "experiment", title: e.title, body: e.behavior,
      date: e.startedAt, tags: metricTags(e.metric),
    });
  }
  for (const i of data.insights ?? []) {
    items.push({
      id: `ins_${i.id}`, kind: "insight", title: i.observation, body: i.reasoning,
      date: i.createdAt, tags: tagsForInsight(i),
    });
  }
  for (const n of data.notes ?? []) {
    items.push({
      id: `note_${n.id}`, kind: "note", title: n.prompt, body: n.answer,
      date: n.date, tags: tagsForText(`${n.prompt} ${n.answer}`),
    });
  }
  return items;
}

/**
 * The items that belong in a Space: everything whose tags match, PLUS anything
 * the user manually pinned, MINUS anything they manually removed. Manual choices
 * always win over the auto-tagging.
 */
export function itemsForSpace(space: Space, data: SpaceSourceData): SpaceItem[] {
  const want = new Set(space.tags);
  const pinned = new Set(space.pinnedIds ?? []);
  const hidden = new Set(space.hiddenIds ?? []);
  return allItems(data)
    .filter((it) => !hidden.has(it.id) && (pinned.has(it.id) || it.tags.some((t) => want.has(t))))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** A couple of friendly starter folders to suggest on an empty Spaces page. */
export const SUGGESTED_SPACES: { name: string; tags: SpaceTag[] }[] = [
  { name: "Behavioral insights", tags: ["behavioral"] },
  { name: "My sleep", tags: ["sleep"] },
  { name: "Focus & energy", tags: ["focus", "cognition", "energy"] },
  { name: "Stress & mood", tags: ["stress", "mood"] },
];
