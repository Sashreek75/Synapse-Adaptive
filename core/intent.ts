/**
 * INTENT — telling "I want to goof off on YouTube" apart from "I'm USING YouTube for PSAT prep".
 *
 * A distracting site isn't always a distraction. When someone says they're using it for real work,
 * the question isn't "have they earned a break?" — it's "is this real?". The strongest evidence is
 * that it matches something they already told Synapse (a plan, their focus, a goal, the orb chat).
 * When it does, the gate lets them in without an argument, as a task pass for that site, and keeps
 * an eye on the page titles so it can tell if the "PSAT prep" turns into a chess speedrun.
 */

/** Words that say "I'm doing work here". */
const USE_VERB = /\b(using|use|need|needs|for|watch(ing)?|look(ing)?\s+up|research(ing)?|stud(y|ying)|learn(ing)?|review(ing)?|practic(e|ing)|read(ing)?|follow(ing)?|listen(ing)?\s+to|check(ing)?|find(ing)?|submit(ting)?|assigned|posted)\b/i;
/** What work looks like. */
const WORK_OBJECT = /\b(prep|practice|tutorial|tutorials|lecture|lectures|lesson|lessons|course|class|classes|homework|hw|assignment|assignments|study|studying|review|exam|exams|test|tests|quiz|sat|psat|act|ap|ib|gcse|a-levels?|math|algebra|geometry|calc|calculus|stats|statistics|chem|chemistry|physics|bio|biology|history|english|spanish|french|essay|paper|project|research|notes|teacher|professor|explained|explanation|walkthrough|how\s+to|documentation|docs|code|coding|programming|bug|music|lofi|lo-fi|playlist|focus|group\s+chat|groupchat|my\s+group|team|club|coach|deadline|application|internship|interview)\b/i;
/** It's a break, not work, whatever else they say. */
const REST = /\b(break|rest|bored|chill|relax|fun|free time|game|games|gaming|play|playing|meme|memes|scroll|scrolling|just\s+for\s+a\s+(sec|bit|minute)|one\s+video|deserve)\b/i;

const STOP = new Set(("i im i'm me my mine you your we our the a an and or but so to of in on at by for from with about into is am are was were be been being do doing does did have has had having " +
  "it its it's this that these those there here then than just really very also maybe might gonna going go get got some any all not no yes " +
  "using use need needs watch watching videos video look looking up research researching study studying learn learning review reviewing practice practicing " +
  "read reading follow following listen listening check checking find finding submit submitting want wanna can could should will would " +
  "prep tutorial tutorials lecture lectures lesson lessons course class classes homework hw assignment assignments notes stuff thing things " +
  "work working session today now later right abt about time minutes mins min hour hours bit quick some youtube reddit yt site page channel").split(/\s+/));

export interface UseClaim { text: string; topics: string[] }

/** "I'm using YouTube to watch PSAT prep videos" → { topics: ["psat"] }. Null when it's a break or has no work in it. */
export function useClaim(text: string, siteWords: string[] = []): UseClaim | null {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  if (REST.test(t) && !/\b(music|lofi|lo-fi|playlist)\b/.test(t)) return null;
  const owned = /\bmy\s+(group|team|teacher|class|project|homework|assignment|essay|paper|lecture|course|coach|club|professor|study)\b/.test(t);
  if (!(USE_VERB.test(t) || owned) || !WORK_OBJECT.test(t)) return null;
  const site = new Set(siteWords.map((w) => w.toLowerCase()));
  const topics = [...new Set(words(t).filter((w) => !STOP.has(w) && !site.has(w) && w.length >= 2))];
  return { text, topics };
}

export interface Evidence { source: string; quote: string }

/** Did they already tell Synapse about this? Matches a claim's topics against what they said today. */
export function planEvidence(claim: UseClaim, sources: Evidence[]): Evidence | null {
  if (!claim.topics.length) return null;
  const want = new Set(claim.topics.map(stem));
  for (const s of sources) {
    const hit = words(s.quote.toLowerCase()).find((w) => w.length >= 3 && want.has(stem(w)));
    if (!hit) continue;
    // Show the part of what they said that matters, not the start of a long message.
    const q = s.quote.replace(/\s+/g, " ").trim();
    const i = q.toLowerCase().indexOf(hit);
    const from = Math.max(0, q.lastIndexOf(" ", Math.max(0, i - 35)));
    const snippet = (from > 0 ? "…" : "") + q.slice(from, i + hit.length + 25).trim() + (i + hit.length + 25 < q.length ? "…" : "");
    return { source: s.source, quote: snippet.replace(/^…\s*/, "…") };
  }
  return null;
}

/** Their words with the obvious noise stripped (for showing back to them). */
export function shortPurpose(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const m = /\b(?:for|to)\s+(.{4,60}?)(?:[.!?,]|$)/i.exec(t);
  return (m ? m[1] : t).replace(/^(watch|use|do|study|learn)\s+/i, "").slice(0, 60);
}

function words(t: string) { return t.split(/[^a-z0-9+-]+/).filter(Boolean); }
function stem(w: string) { return w.length > 4 ? w.replace(/(ing|es|s)$/, "") : w; }

/** The meaningful words of a page title ("SAT Math: Hardest Questions - YouTube" → ["sat", "math", "hardest", "questions"]). */
export function titleClaim(title: string, siteWords: string[] = []): UseClaim {
  const site = new Set(siteWords.map((w) => w.toLowerCase()));
  const t = title.toLowerCase();
  return { text: title, topics: [...new Set(words(t).filter((w) => !STOP.has(w) && !site.has(w) && w.length >= 3))] };
}

/** Background music for focus, by its title. */
export const FOCUS_MUSIC = /\b(lo-?fi|study music|focus music|music (for|to) (study|studying|focus|work|concentrat\w*)|beats to (study|relax|focus)|white noise|brown noise|rain sounds|classical music for|piano (music )?for (studying|focus)|study with me|ambient (music|sounds) for)\b/i;
