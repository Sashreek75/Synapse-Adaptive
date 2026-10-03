/**
 * THE BRAIN — Synapse's single source of truth.
 * ----------------------------------------------
 * The old web app kept ~30 separate stores (goals, commitments, decisions, principles, presence,
 * activity…) and every screen assembled its own context for the model. That's why it felt like
 * several systems. Here there is exactly ONE state object and exactly ONE context builder.
 * The gate, the clarity conversation, check-ins and onboarding all read the same picture, and
 * everything they learn is written back to the same place.
 *
 * Pure TypeScript: no Electron, no DOM. Storage is injected so it's testable anywhere.
 */

export interface Goal { id: string; title: string; deadline?: string; createdAt: number; doneAt?: number }
/** "break" = rest/free time; "task" = a site they need for something specific (a lecture, a reply). */
export type PassKind = "break" | "task";
export interface Pass { site: string; minutes: number; grantedAt: number; expiresAt: number; reason: string; kind?: PassKind }
export type GateKind = "opened" | "pass" | "extended" | "deny" | "ask" | "timeout" | "walked_away" | "expired" | "ended_early";
export interface GateEvent { ts: number; site: string; kind: GateKind; minutes?: number; text?: string }
export interface Turn { ts: number; role: "user" | "synapse"; text: string; surface: "ask" | "gate" | "onboarding" }
export interface Segment { app: string; title: string; site?: string; start: number; end: number; onPass?: PassKind }
export interface Reachout { id: string; at: number; text: string }
export interface PassChange { site: string; minutes: number }

export interface Settings {
  distractions: string[];
  windowSeconds: number;
  maxMinutes: number;
  shareScreen: boolean;
  defaultsVersion?: number;
}

export interface BrainState {
  version: 1;
  installId: string;
  profile: { onboardedAt?: number };
  settings: Settings;
  goals: Goal[];
  focus?: { text: string; setAt: number };
  /** They told us they're done working ("done studying, gn"). Synapse treats them as off the clock. */
  offClock?: { since: number; said: string };
  /** They asked Synapse to leave them alone for a while. No gates, no watching, no check-ins. */
  pausedUntil?: number;
  memory: {
    principles: { text: string; ts: number }[];
    mindshifts: { text: string; ts: number }[];
    observations: { key: string; text: string; ts: number }[];
    calls: { text: string; ts: number }[];
  };
  reachouts: Reachout[];
  passes: Record<string, Pass>;
  gateLog: GateEvent[];
  turns: Turn[];
  activity: Segment[];
  workStreakStart?: number;
  lastActiveAt?: number;
  appEvents: { ts: number; text: string }[];
}

export interface Storage { load(): string | null; save(json: string): void }

import { DEFAULT_DISTRACTIONS, DEFAULTS_VERSION, catalogEntry } from "./distractions";
export { DEFAULT_DISTRACTIONS, DISTRACTION_CATALOG } from "./distractions";

const IDLE_BREAK_SEC = 5 * 60;
const SAMPLE_MS = 5000;                 // each activity sample stands for ~5s
const BREAK_GAP_MS = 5 * 60_000;        // this long away (or on distractions) = a real break
const SESSION_GAP_MS = 10 * 60_000;     // this long = a new work session
/** Not work, not distraction: the OS itself. */
const SYSTEM_APPS = /^(lockapp|explorer|searchhost|searchapp|shellexperiencehost|startmenuexperiencehost|applicationframehost|textinputhost|synapse|electron)(\.exe)?$/i;
const FOCUS_IDLE_RESET_SEC = 30 * 60;   // away this long and "what they're working on" is stale
const OFF_CLOCK_MS = 10 * 3600_000;     // "done for the day" lasts this long at most (until the next day)
const SEGMENT_GAP_MS = 20_000;          // samples further apart than this start a new segment
const KEEP_ACTIVITY_MS = 24 * 3600_000;
const BACK_TO_WORK_MS = 60_000;            // a solid minute back on real work during a break = the break is over
const BREAK_MIN_BEFORE_RETURN_MS = 60_000; // …but not in the first minute of the break

function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function fresh(): BrainState {
  return {
    version: 1,
    installId: rid(),
    profile: {},
    settings: { distractions: [...DEFAULT_DISTRACTIONS], windowSeconds: 15, maxMinutes: 30, shareScreen: true, defaultsVersion: DEFAULTS_VERSION },
    goals: [],
    memory: { principles: [], mindshifts: [], observations: [], calls: [] },
    reachouts: [],
    passes: {},
    gateLog: [],
    turns: [],
    activity: [],
    appEvents: [],
  };
}

const NAMES: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", x: "X", twitter: "Twitter", reddit: "Reddit", instagram: "Instagram", facebook: "Facebook", netflix: "Netflix", twitch: "Twitch", discord: "Discord", pinterest: "Pinterest" };
/** The "site" key for free time: every distracting site is open until it runs out. */
export const ANY_SITE = "*";
/** Domains that are the same site (twitter.com redirects to x.com). A pass for one covers the other. */
const SAME_SITE: Record<string, string[]> = { "x.com": ["twitter.com"], "twitter.com": ["x.com"], "threads.net": ["threads.com"], "threads.com": ["threads.net"] };
export function sameSite(site: string): string[] { return [site, ...(SAME_SITE[site] ?? [])]; }
export function siteName(site: string) { if (site === ANY_SITE) return "Free time"; const c = catalogEntry(site); if (c) return c.names[0]; const n = site.split(".")[0]; return NAMES[n] || n.charAt(0).toUpperCase() + n.slice(1); }

export function cleanSite(input: string): string {
  let s = input.trim().toLowerCase();
  try { if (/^https?:\/\//.test(s)) s = new URL(s).hostname; } catch { /* keep */ }
  return s.replace(/^www\./, "").replace(/\/.*$/, "");
}

/** "Research paper - Google Docs - Google Chrome" → "Research paper - Google Docs" */
export function cleanTitle(title: string): string {
  return title.replace(/\s+[-–—]\s+(Google Chrome|Microsoft\u200B? Edge|Mozilla Firefox|Brave|Opera|Vivaldi)$/i, "").replace(/^\(\d+\)\s*/, "").trim().slice(0, 120);
}


/**
 * Did they just say they're done working? ("done studying, gn", "calling it a night",
 * "I'm finished for today", "going to bed"). A plain break ("quick break") is NOT this.
 */
export function saysDoneWorking(text: string): boolean {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  if (/\b(quick|short|small|\d+[- ]?min(ute)?s?)\s+break\b/.test(t)) return false;
  // "I'm NOT done studying", "not finished yet"
  if (/\b(not|n't|never|almost|nearly|barely)\s+(really\s+|quite\s+|yet\s+)?(done|finished|through)\b/.test(t)) return false;
  // "done with math, starting chem now", "finished the intro, onto the body" — moving on, not stopping
  if (/\b(done|finished|through)\b[\s\S]{0,60}\b(now (i'?m |i |gonna |going to )?(start|do|work|move)|starting|start on|onto|on to|moving on|next (up|is)|then (i'?ll|gonna|going to)|time for (my|the) (next|other))\b/.test(t)) return false;
  return /\b(done|finished|through|wrapping up|wrapped up|stopping|calling it)\b[^.!?]{0,30}\b(studying|study|working|work|homework|hw|school ?work|coding|for (the|to)(day|night|nite)|for today|for tonight|for the day|for the night)\b/.test(t)
    || /\bcalling it (a )?(night|day)\b/.test(t)
    || /\b(i'?m|im|i am) (done|finished)( for (now|today|tonight|the day|the night))?\s*[,.!]*\s*(gn|good ?night|bye)?\s*$/.test(t)
    || /(^\s*gn\b|\bgn[\s!.]*$)/.test(t)
    || /\b(good ?night|nighty? ?night)\b(?!'s)(?! sleep)/.test(t) && t.split(/\s+/).length <= 8
    || /\b(going|heading|off) to (bed|sleep)\b/.test(t)
    || /\bday'?s (done|over)\b/.test(t);
}

/** Remove the browser's own name (and Edge's profile name) from the end of a window title. */
export function stripBrowserSuffix(title: string): string {
  return title
    .replace(/\s+[-–—]\s+(Google Chrome|Mozilla Firefox|Brave|Opera|Vivaldi|Arc|Chromium)(\s+[-–—].*)?$/i, "")
    .replace(/\s+[-–—]\s+Microsoft\u200B?\s?Edge.*$/i, "")
    .replace(/\s+[-–—]\s+(Personal|Work|Profile \d+|InPrivate)$/i, "")
    .replace(/\s+and \d+ more pages?$/i, "")
    .trim();
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SEP = "[-–—|:•·]";

/** Does this page title look like it belongs to `site`? */
export function titleShowsSite(t: string, site: string): boolean {
  if (site === "x.com" || site === "twitter.com") return /\/\s*X$/.test(t) || /^X$/.test(t) || /\bon X:/.test(t) || /\/\s*Twitter$/.test(t) || /^Twitter$/.test(t) || /\bon Twitter:/.test(t);
  if (site === "reddit.com" && (/(^|[-–—|:•·]\s*)r\/\w+(\s|$)/.test(t) || /\bon Reddit$/i.test(t))) return true;
  if (site === "store.steampowered.com" && /(\bon Steam|Welcome to Steam)$/.test(t)) return true;
  const domain = esc(site);
  if (new RegExp(`(^|\\s)${domain}(\\W|$)`, "i").test(t)) return true;          // "youtube.com", "Amazon.com: …"
  const names = catalogEntry(site)?.names ?? [siteName(site)];
  return names.some((raw) => {
    const name = esc(raw);
    return new RegExp(`(^|${SEP}\\s*)${name}\\s*$`, "i").test(t)               // "Video title - YouTube"
      || new RegExp(`^${name}(\\s*$|\\s*${SEP})`, "i").test(t)                 // "TikTok - Make Your Day", "Netflix"
      || new RegExp(`\\bon ${name}:`, "i").test(t);                                // "Someone on Instagram: \"…\""
  });
}

const NEUTRAL_SUFFIX = new RegExp(`[-–—|:•·]\\s*(${[
  "Google Search", "Bing", "DuckDuckGo", "Search", "Google Docs", "Google Slides", "Google Sheets", "Google Drive", "Google Scholar",
  "Wikipedia", "Stack Overflow", "Stack Exchange", "GitHub", "GitLab", "MDN Web Docs", "W3Schools", "GeeksforGeeks", "Medium",
  "Quora", "Khan Academy", "Quizlet", "Canvas", "Classroom", "Google Classroom", "Schoology", "Notion", "Gmail", "Outlook",
  "ChatGPT", "Claude", "Gemini", "Desmos", "Coursera", "edX", "Overleaf", "Replit", "LeetCode", "Codecademy", "College Board",
].join("|")})\\s*$`, "i");
const WORK_SUBDOMAIN = /^(developers?|dev|docs|api|status|aws|help|support|business|ads|studio|creators?|partner|press|careers|investor|engineering)\./;

const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const mins = (ms: number) => Math.round(ms / 60_000);

export class Brain {
  s: BrainState;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  constructor(private storage: Storage, private now: () => number = () => Date.now()) {
    let loaded: BrainState | null = null;
    try { const raw = storage.load(); if (raw) loaded = JSON.parse(raw); } catch { loaded = null; }
    const base = fresh();
    this.s = loaded && loaded.version === 1
      ? { ...base, ...loaded, settings: { ...base.settings, ...loaded.settings }, memory: { ...base.memory, ...loaded.memory } }
      : base;
    // Older installs: merge in sites added to the default list since they installed.
    if (loaded && (loaded.settings?.defaultsVersion ?? 1) < DEFAULTS_VERSION) {
      this.s.settings.distractions = [...new Set([...this.s.settings.distractions, ...DEFAULT_DISTRACTIONS])];
      this.s.settings.defaultsVersion = DEFAULTS_VERSION;
    }
  }

  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Persist soon (coalesces bursts of observations into one write). */
  touch() {
    this.listeners.forEach((f) => f());
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.flush(); }, 1500);
  }
  flush() {
    this.prune();
    try { this.storage.save(JSON.stringify(this.s)); } catch { /* best effort */ }
  }

  private prune() {
    const t = this.now();
    this.s.activity = this.s.activity.filter((a) => t - a.end < KEEP_ACTIVITY_MS);
    this.s.gateLog = this.s.gateLog.filter((e) => t - e.ts < 14 * 86400_000).slice(-500);
    this.s.turns = this.s.turns.slice(-60);
    this.s.appEvents = this.s.appEvents.slice(-50);
    for (const [k, p] of Object.entries(this.s.passes)) if (p.expiresAt < t) delete this.s.passes[k];
    for (const key of ["principles", "mindshifts", "observations", "calls"] as const) (this.s.memory[key] as unknown[]) = this.s.memory[key].slice(-40);
  }

  /* ---------------- sensing ---------------- */

  matchDistraction(hostname: string): string | null {
    const h = (hostname || "").toLowerCase().replace(/^www\./, "");
    // Work-facing parts of distracting companies are not distractions: aws.amazon.com,
    // developers.facebook.com, studio.youtube.com, docs.…, dev.epicgames.com …
    if (WORK_SUBDOMAIN.test(h)) return null;
    return this.s.settings.distractions.find((d) => h === d || h.endsWith("." + d)) ?? null;
  }

  /**
   * Which distracting site a browser WINDOW TITLE shows, for when the browser helper isn't
   * installed. Browsers put the page title in the window title ("Lofi beats - YouTube - Google
   * Chrome"), and sites end their titles with their own name, so we match on that suffix.
   */
  matchTitle(windowTitle: string): string | null {
    const t = stripBrowserSuffix(windowTitle).replace(/^\(\d+\+?\)\s*/, "").trim();
    if (!t) return null;
    // A page whose title ENDS with a non-distraction site is that site, whatever it mentions:
    // "YouTube - Wikipedia", "How to scrape Reddit - Stack Overflow", "Instagram - Google Search".
    if (NEUTRAL_SUFFIX.test(t)) return null;
    for (const d of this.s.settings.distractions) if (titleShowsSite(t, d)) return d;
    return null;
  }

  /** One sample from the background agent: the foreground window, and how long the user has been idle. */
  observe(sample: { app: string; title: string; url?: string; idleSec: number }) {
    const t = this.now();
    if (sample.idleSec >= IDLE_BREAK_SEC) {
      this.s.workStreakStart = undefined;
      // Away from the computer for a long stretch: whatever they said they were doing is over.
      if (sample.idleSec >= FOCUS_IDLE_RESET_SEC && this.s.focus) this.s.focus = undefined;
      this.touch(); return;
    }
    let site: string | undefined;
    if (sample.url) { try { site = this.matchDistraction(new URL(sample.url).hostname) ?? undefined; } catch { /* ignore */ } }
    else site = this.matchTitle(sample.title || "") ?? undefined;
    const title = cleanTitle(sample.title || "");
    // Time on a site they were let into FOR A TASK (a lecture for class) is work, not distraction.
    const onPass = site ? this.activePass(site)?.kind : undefined;
    const last = this.s.activity[this.s.activity.length - 1];
    if (last && last.app === sample.app && last.title === title && last.onPass === onPass && t - last.end < SEGMENT_GAP_MS) last.end = t;
    else this.s.activity.push({ app: sample.app, title, site, start: t, end: t, ...(onPass ? { onPass } : {}) });

    if (site && onPass !== "task") this.s.workStreakStart = undefined;                      // a distraction breaks the streak
    else if (!this.s.workStreakStart || (this.s.lastActiveAt && t - this.s.lastActiveAt > IDLE_BREAK_SEC * 1000)) this.s.workStreakStart = t;
    this.s.lastActiveAt = t;
    this.touch();
  }

  /** Kept for compatibility: minutes of work since their last real break. */
  workStreakMinutes(): number { return this.workStats().sinceBreakMin; }

  /**
   * How much they've actually worked, measured from the activity log — not from a streak that
   * any tab switch could reset. A visit to a distracting site doesn't erase the work before it;
   * only a real break does (≥ 5 min away from the computer, or ≥ 5 min on distractions).
   * A new SESSION starts after ≥ 10 min away / on distractions.
   */
  workStats() {
    const now = this.now();
    const from = dayStart(now);
    // The OS itself and empty browser tabs are neither work nor distraction.
    const segs = this.s.activity.filter((a) => !SYSTEM_APPS.test(a.app) && !/^(New Tab|Untitled|Task Switching)?$/i.test(a.title.trim())).sort((a, b) => a.start - b.start);
    let workToday = 0, distractToday = 0;
    let sessionStart: number | null = null, sessionWork = 0, sessionDistract = 0;
    let sinceBreak = 0, distractRun = 0, prevEnd = 0;
    for (const a of segs) {
      const start = a.start;
      const dur = a.end - start + SAMPLE_MS;
      // Only the part of a segment after midnight counts toward TODAY; sessions and breaks run across midnight.
      const durToday = a.end < from ? 0 : a.end - Math.max(start, from) + SAMPLE_MS;
      const gap = prevEnd ? start - prevEnd - SAMPLE_MS : Infinity;
      if (gap >= SESSION_GAP_MS) { sessionStart = start; sessionWork = 0; sessionDistract = 0; sinceBreak = 0; distractRun = 0; }
      else if (gap >= BREAK_GAP_MS) sinceBreak = 0;
      if (a.site && a.onPass !== "task") {
        distractToday += durToday; sessionDistract += dur; distractRun += dur;
        if (distractRun >= SESSION_GAP_MS) { sessionStart = a.end; sessionWork = 0; sessionDistract = 0; sinceBreak = 0; }
        else if (distractRun >= BREAK_GAP_MS) sinceBreak = 0;
      } else {
        distractRun = 0;
        workToday += durToday; sessionWork += dur; sinceBreak += dur;
      }
      prevEnd = a.end;
    }
    // Away right now? Then the current session/streak is over.
    if (prevEnd && now - prevEnd >= SESSION_GAP_MS) { sessionStart = null; sessionWork = 0; sessionDistract = 0; sinceBreak = 0; }
    else if (prevEnd && now - prevEnd >= BREAK_GAP_MS) sinceBreak = 0;
    return {
      todayMin: mins(workToday), distractTodayMin: mins(distractToday),
      sessionStart, sessionMin: mins(sessionWork), sessionDistractMin: mins(sessionDistract),
      sinceBreakMin: mins(sinceBreak),
    };
  }

  /** Where the last N minutes actually went, grouped by window, excluding Synapse itself. */
  recentWindows(windowMin = 60, limit = 5): { label: string; minutes: number; distraction: boolean }[] {
    const from = this.now() - windowMin * 60_000;
    const agg = new Map<string, { ms: number; distraction: boolean }>();
    for (const a of this.s.activity) {
      if (a.end < from || SYSTEM_APPS.test(a.app)) continue;
      const label = a.title ? `${a.title} (${a.app.replace(/\.exe$/i, "")})` : a.app.replace(/\.exe$/i, "");
      const ms = a.end - Math.max(a.start, from) + 5000; // each sample stands for ~5s
      const cur = agg.get(label) ?? { ms: 0, distraction: !!a.site };
      cur.ms += ms; agg.set(label, cur);
    }
    return [...agg.entries()].map(([label, v]) => ({ label, minutes: Math.max(1, mins(v.ms)), distraction: v.distraction }))
      .filter((x) => x.minutes >= 1).sort((a, b) => b.minutes - a.minutes).slice(0, limit);
  }

  /** What they're working on: what they SAID (for 3h), else what the screen suggests. */
  currentFocus(): { text: string; source: "stated" | "inferred" } | null {
    if (this.offClock()) return null;
    const f = this.s.focus;
    if (f && this.now() - f.setAt < 2 * 3600_000) return { text: f.text, source: "stated" };
    const top = this.recentWindows(30, 5).find((w) => !w.distraction && w.minutes >= 5
      && !/\((lockapp|explorer|searchhost|shellexperiencehost|applicationframehost)\)$/i.test(w.label)
      && !/^(New Tab|Untitled|Inbox|Gmail|Task Switching)\b/i.test(w.label));
    return top ? { text: top.label.replace(/\s*\([^)]*\)$/, ""), source: "inferred" } : null;
  }

  paused(): number | null {
    const u = this.s.pausedUntil;
    if (!u) return null;
    if (u <= this.now()) { this.s.pausedUntil = undefined; this.noteAppEvent("pause ended"); return null; }
    return u;
  }
  pause(minutes: number) {
    this.s.pausedUntil = this.now() + Math.max(1, Math.min(16 * 60, Math.round(minutes))) * 60_000;
    this.noteAppEvent(`they paused Synapse until ${new Date(this.s.pausedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    this.touch();
    return this.s.pausedUntil;
  }
  resume() {
    if (!this.s.pausedUntil) return;
    this.s.pausedUntil = undefined;
    this.noteAppEvent("they turned Synapse back on");
    this.touch();
  }

  /** Off the clock until they start something new, or ~10 hours pass (the next day). */
  offClock(): { since: number; said: string } | null {
    const o = this.s.offClock;
    if (!o) return null;
    if (this.now() - o.since > OFF_CLOCK_MS) { this.s.offClock = undefined; return null; }
    return o;
  }

  /** They said they're done working. Clears what they were "working on" and says so in context. */
  endWork(said: string) {
    this.s.focus = undefined;
    this.s.workStreakStart = undefined;
    this.s.offClock = { since: this.now(), said: said.slice(0, 160) };
    this.touch();
  }

  /** They're back at it ("ok starting my essay"). */
  startWork(text: string) {
    this.s.offClock = undefined;
    this.s.focus = { text: text.slice(0, 160), setAt: this.now() };
    this.touch();
  }

  /* ---------------- the gate ---------------- */

  /** "youtube", "YouTube", "youtube.com", "https://youtube.com/…" → "youtube.com" (only listed sites). */
  resolveSite(name: string): string | null {
    const n0 = name.trim().toLowerCase();
    // "free time", "games", "anything", "*" → free time across every distracting site
    if (/^(\*|any|all|anything|everything|free( time)?|games?|gaming|social( media)?|video|streaming|shopping|news|distractions?)$/.test(n0)) return ANY_SITE;
    const c = cleanSite(name);
    const direct = this.matchDistraction(c);
    if (direct) return direct;
    const n = name.trim().toLowerCase();
    if (n === "x" || n === "twitter") return this.s.settings.distractions.includes("x.com") ? "x.com" : "twitter.com";
    return this.s.settings.distractions.find((d) => siteName(d).toLowerCase() === n || d.split(".")[0] === n) ?? null;
  }

  /** A pass for this site — or free time, which covers every site. */
  activePass(site: string): Pass | null {
    const t = this.now();
    for (const k of sameSite(site)) { const p = this.s.passes[k]; if (p && p.expiresAt > t) return p; }
    const any = this.s.passes[ANY_SITE];
    return any && any.expiresAt > t ? any : null;
  }

  logGate(ev: Omit<GateEvent, "ts">) { this.s.gateLog.push({ ts: this.now(), ...ev }); this.touch(); }

  grantPass(site: string, minutes: number, reason: string, kind: PassKind = site === ANY_SITE ? "break" : "task"): Pass {
    const t = this.now();
    const prev = this.s.passes[site] && this.s.passes[site].expiresAt > t ? this.s.passes[site] : null;
    if (prev) {
      // Already have one: this is an extension (or a change), not another pass for the day's count.
      const before = prev.expiresAt;
      prev.expiresAt = t + minutes * 60_000;
      prev.minutes = Math.round((prev.expiresAt - prev.grantedAt) / 60_000);
      if (kind === "break") prev.kind = "break";
      this.logGate({ site, kind: "extended", minutes: Math.round((prev.expiresAt - before) / 60_000), text: reason.slice(0, 240) });
      return prev;
    }
    const p: Pass = { site, minutes, reason: reason.slice(0, 240), grantedAt: t, expiresAt: t + minutes * 60_000, kind };
    this.s.passes[site] = p;
    this.logGate({ site, kind: "pass", minutes, text: reason.slice(0, 240) });
    return p;
  }

  /**
   * BACK TO WORK DURING A BREAK. Called on every look at the screen. If they're on a break and have
   * been on real work (not a distraction, not the desktop, not an empty tab) for a solid minute, the
   * break is over: returns the pass to end. Glancing at a doc for a few seconds doesn't count, and
   * neither does the first minute of the break. Task passes (a lecture for class) are left alone —
   * switching to notes during a lecture is part of the task.
   */
  backToWork(sample: { app: string; title: string; url?: string }): string | null {
    const t = this.now();
    const live = Object.values(this.s.passes).filter((p) => p.expiresAt > t && (p.kind === "break" || (!p.kind && p.site === ANY_SITE)));
    if (!live.length) { this.backSince = null; return null; }
    let site: string | null = null;
    if (sample.url) { try { site = this.matchDistraction(new URL(sample.url).hostname); } catch { site = null; } }
    else site = this.matchTitle(sample.title || "");
    const title = cleanTitle(sample.title || "");
    const working = !site && !SYSTEM_APPS.test(sample.app) && !!title && !/^(New Tab|Untitled|Task Switching|Start)$/i.test(title);
    if (!working) { this.backSince = null; return null; }
    const p = live.sort((a, b) => b.expiresAt - a.expiresAt)[0];
    if (t - p.grantedAt < BREAK_MIN_BEFORE_RETURN_MS) return null;
    if (this.backSince == null) this.backSince = t;
    if (t - this.backSince < BACK_TO_WORK_MS) return null;
    this.backSince = null;
    return p.site;
  }
  private backSince: number | null = null;

  endPass(site: string, kind: "expired" | "ended_early") {
    if (!this.s.passes[site]) return;
    delete this.s.passes[site];
    this.logGate({ site, kind });
  }

  today() {
    const from = dayStart(this.now());
    const ev = this.s.gateLog.filter((e) => e.ts >= from);
    const passes = ev.filter((e) => e.kind === "pass");
    return {
      passes: passes.length,
      minutes: passes.reduce((a, e) => a + (e.minutes ?? 0), 0) + ev.filter((e) => e.kind === "extended").reduce((a, e) => a + Math.max(0, e.minutes ?? 0), 0),
      denials: ev.filter((e) => e.kind === "deny" || e.kind === "timeout").length,
      walkedAway: ev.filter((e) => e.kind === "walked_away").length,
      reasons: passes.map((e) => `${siteName(e.site)} ${e.minutes}m: "${e.text ?? ""}"`),
    };
  }

  /* ---------------- conversation + memory ---------------- */

  addTurn(role: Turn["role"], text: string, surface: Turn["surface"]) { this.s.turns.push({ ts: this.now(), role, text: text.slice(0, 1500), surface }); this.touch(); }
  noteAppEvent(text: string) { this.s.appEvents.push({ ts: this.now(), text }); this.touch(); }

  /** Read the hidden tags the model appended, apply them to state, and return the clean reply. */
  ingest(raw: string): { text: string; reachouts: Reachout[]; passChanges: PassChange[] } {
    const t = this.now();
    const reachouts: Reachout[] = [];
    const passChanges: PassChange[] = [];
    for (const m of raw.matchAll(/\[\[\s*([a-z-]+)\s*:\s*([\s\S]*?)\]\]/gi)) {
      const kind = m[1].toLowerCase();
      const parts = m[2].split("|").map((x) => x.trim());
      const a = parts[0] ?? "";
      if (!a) continue;
      if (kind === "goal") {
        if (!this.s.goals.some((g) => !g.doneAt && g.title.toLowerCase() === a.toLowerCase()))
          this.s.goals.push({ id: rid(), title: a.slice(0, 200), deadline: /^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? "") ? parts[1] : undefined, createdAt: t });
      } else if (kind === "goal-done") {
        const g = this.s.goals.find((g) => !g.doneAt && (g.title.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(g.title.toLowerCase())));
        if (g) g.doneAt = t;
      } else if (kind === "focus") this.startWork(a);
      else if (kind === "done-working") this.endWork(a);
      else if (kind === "distraction") { const d = cleanSite(a); if (d.includes(".") && !this.s.settings.distractions.includes(d)) this.s.settings.distractions.push(d); }
      else if (kind === "reachout") {
        const n = parseInt(a, 10);
        if (n > 0 && parts[1]) { const r = { id: rid(), at: t + Math.min(24 * 60, n) * 60_000, text: parts[1].slice(0, 200) }; this.s.reachouts.push(r); reachouts.push(r); }
      } else if (kind === "principle") this.s.memory.principles.push({ text: a, ts: t });
      else if (kind === "mindshift") this.s.memory.mindshifts.push({ text: a, ts: t });
      else if (kind === "observe") this.s.memory.observations.push({ key: a, text: parts[1] ?? a, ts: t });
      else if (kind === "rec") this.s.memory.calls.push({ text: a, ts: t });
      else if (kind === "free") {
        // [[free: minutes]] — free time: any distracting site, for that long.
        const n = parseInt(a, 10);
        if (Number.isNaN(n) || n < 0) continue;
        if (n === 0) { if (this.s.passes[ANY_SITE]) { this.endPass(ANY_SITE, "ended_early"); passChanges.push({ site: ANY_SITE, minutes: 0 }); } continue; }
        const minutes = Math.min(n, this.s.settings.maxMinutes);
        this.grantPass(ANY_SITE, minutes, "free time, granted in conversation", "break");
        passChanges.push({ site: ANY_SITE, minutes });
      }
      else if (kind === "pass") {
        // [[pass: site | minutes from now]] — change (or end, with 0) a timed pass from the conversation.
        const site = this.resolveSite(a);
        const n = parseInt(parts[1] ?? "", 10);
        if (!site || Number.isNaN(n) || n < 0) continue;
        if (n === 0) {
          // "End my YouTube time" when what they have is free time: end the free time.
          const key = site !== ANY_SITE && !this.s.passes[site] && this.s.passes[ANY_SITE] ? ANY_SITE : site;
          if (this.s.passes[key]) { this.endPass(key, "ended_early"); passChanges.push({ site: key, minutes: 0 }); }
          continue;
        }
        const minutes = Math.min(n, this.s.settings.maxMinutes);
        // Changing "the pass" while what they have is free time changes the free time.
        const key = site !== ANY_SITE && !((this.s.passes[site]?.expiresAt ?? 0) > t) && (this.s.passes[ANY_SITE]?.expiresAt ?? 0) > t ? ANY_SITE : site;
        this.grantPass(key, minutes, "changed in conversation", key === ANY_SITE ? "break" : "task");
        passChanges.push({ site: key, minutes });
      }
    }
    this.touch();
    const text = raw.replace(/\[\[[\s\S]*?\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return { text, reachouts, passChanges };
  }

  /* ---------------- the ONE context builder ---------------- */

  /**
   * Everything Synapse knows, as one block. The gate and the conversation both call this, so
   * they can never disagree about who this person is or what they're doing.
   */
  context(opts: { purpose: "gate" | "ask"; site?: string; screen?: string | null; localTime?: string } ): string {
    const t = this.now();
    const lines: string[] = [];
    const localTime = opts.localTime ?? new Date(t).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    lines.push(`NOW: ${localTime}`);

    const goals = this.s.goals.filter((g) => !g.doneAt);
    lines.push(goals.length
      ? `Goals:\n${goals.map((g) => `- ${g.title}${g.deadline ? ` (due ${g.deadline})` : ""}`).join("\n")}`
      : "Goals: none captured yet.");

    const pausedUntil = this.paused();
    if (pausedUntil) lines.push(`PAUSED: they turned Synapse off until ${new Date(pausedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} to relax. Don't push work on them.`);
    const off = this.offClock();
    if (off) lines.push(`OFF THE CLOCK: at ${new Date(off.since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} they said they were done working ("${off.said}"). Don't treat them as mid-task; they're winding down unless they say otherwise.`);
    const focus = this.currentFocus();
    if (focus) lines.push(focus.source === "stated"
      ? `WORKING ON (they told you, ${mins(t - (this.s.focus?.setAt ?? t))} min ago): ${focus.text}`
      : `WORKING ON (inferred from their screen, not stated): ${focus.text}`);

    const w = this.workStats();
    const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
    const windows = this.recentWindows(60, 5);
    lines.push(`WORK TIME (measured on this computer; distraction sites and time away don't count; it can't see work done off the computer): ` +
      `today ${hm(w.todayMin)} of work, ${hm(w.distractTodayMin)} on distraction sites. ` +
      (w.sessionStart ? `This session (since ${new Date(w.sessionStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}): ${hm(w.sessionMin)} of work. Since their last real break: ${hm(w.sinceBreakMin)}.` : "No work session in progress right now.") +
      ` Use these numbers exactly; never round them up or invent others.` +
      (windows.length ? `\nLast hour, by time:\n${windows.map((w) => `- ${w.label}: ${w.minutes} min${w.distraction ? " [distraction]" : ""}`).join("\n")}` : "\nNo activity recorded in the last hour."));

    const d = this.today();
    lines.push(`DISTRACTION GATE TODAY: ${d.passes} passes (${d.minutes} min), ${d.denials} denied or timed out, ${d.walkedAway} times they walked away on their own.` +
      (d.reasons.length ? `\nReasons that got them in today:\n- ${d.reasons.slice(-5).join("\n- ")}` : ""));
    const live = Object.values(this.s.passes).filter((p) => p.expiresAt > t);
    if (live.length) lines.push(`ACTIVE PASS: ${live.map((p) => p.site === ANY_SITE
      ? `FREE TIME — every distracting site is open, ${Math.ceil((p.expiresAt - t) / 60_000)} min left of ${p.minutes}`
      : `${siteName(p.site)} (${p.site}), ${Math.ceil((p.expiresAt - t) / 60_000)} min left of ${p.minutes}`).join("; ")}`);
    lines.push(`PASS LIMIT: the longest pass they've allowed is ${this.s.settings.maxMinutes} min.`);

    const mem = this.s.memory;
    const memLines = [
      ...mem.principles.slice(-5).map((p) => `- principle: ${p.text}`),
      ...mem.mindshifts.slice(-3).map((p) => `- changed my mind: ${p.text}`),
      ...mem.observations.slice(-5).map((o) => `- noticed: ${o.text}`),
      ...mem.calls.slice(-4).map((c) => `- I recommended: ${c.text}`),
    ];
    if (memLines.length) lines.push(`WHAT I KNOW ABOUT HOW THEY WORK:\n${memLines.join("\n")}`);

    const ev = this.s.appEvents.filter((e) => t - e.ts < 24 * 3600_000).slice(-3);
    if (ev.length) lines.push(`SYNAPSE ITSELF: ${ev.map((e) => e.text).join("; ")}`);

    if (opts.purpose === "ask") {
      lines.push(opts.screen
        ? `THEIR SCREEN RIGHT NOW (they chose to share it):\n${opts.screen}`
        : "They did not share their screen for this message; if the question depends on it, say so.");
    }
    // ONE BRAIN: the gate and the orb read the same conversation. What they told the orb ("I'm in
    // class, nothing to do") and what Synapse said back ("yes, go play") count at the gate too.
    const convo = this.s.turns.filter((x) => t - x.ts < 4 * 3600_000).slice(opts.purpose === "gate" ? -12 : -10);
    if (convo.length) lines.push(`RECENT CONVERSATION (orb and gate; newest last — this is YOU talking to them):\n${convo.map((x) => `[${new Date(x.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}] ${x.role === "user" ? "Them" : "Synapse"}${x.surface === "gate" ? " (at the gate)" : ""}: ${x.text.slice(0, 400)}`).join("\n")}`);
    return lines.join("\n\n");
  }
}
