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
export interface Pass { site: string; minutes: number; grantedAt: number; expiresAt: number; reason: string }
export type GateKind = "opened" | "pass" | "deny" | "ask" | "timeout" | "walked_away" | "expired" | "ended_early";
export interface GateEvent { ts: number; site: string; kind: GateKind; minutes?: number; text?: string }
export interface Turn { ts: number; role: "user" | "synapse"; text: string; surface: "ask" | "gate" | "onboarding" }
export interface Segment { app: string; title: string; site?: string; start: number; end: number }
export interface Reachout { id: string; at: number; text: string }

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

const IDLE_BREAK_SEC = 5 * 60;          // idle this long = the work streak resets
const SEGMENT_GAP_MS = 20_000;          // samples further apart than this start a new segment
const KEEP_ACTIVITY_MS = 24 * 3600_000;

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
export function siteName(site: string) { const c = catalogEntry(site); if (c) return c.names[0]; const n = site.split(".")[0]; return NAMES[n] || n.charAt(0).toUpperCase() + n.slice(1); }

export function cleanSite(input: string): string {
  let s = input.trim().toLowerCase();
  try { if (/^https?:\/\//.test(s)) s = new URL(s).hostname; } catch { /* keep */ }
  return s.replace(/^www\./, "").replace(/\/.*$/, "");
}

/** "Research paper - Google Docs - Google Chrome" → "Research paper - Google Docs" */
export function cleanTitle(title: string): string {
  return title.replace(/\s+[-–—]\s+(Google Chrome|Microsoft\u200B? Edge|Mozilla Firefox|Brave|Opera|Vivaldi)$/i, "").replace(/^\(\d+\)\s*/, "").trim().slice(0, 120);
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
  if (site === "reddit.com" && (/(^|\s|:)r\/\w+/.test(t) || /\breddit\b/i.test(t))) return true;
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
    return this.s.settings.distractions.find((d) => h === d || h.endsWith("." + d)) ?? null;
  }

  /**
   * Which distracting site a browser WINDOW TITLE shows, for when the browser helper isn't
   * installed. Browsers put the page title in the window title ("Lofi beats - YouTube - Google
   * Chrome"), and sites end their titles with their own name, so we match on that suffix.
   */
  matchTitle(windowTitle: string): string | null {
    const t = stripBrowserSuffix(windowTitle).replace(/^\(\d+\+?\)\s*/, "").trim();
    if (!t || /[-–—|]\s*(Google Search|Bing|DuckDuckGo|Search|Google Docs|Google Slides|Google Sheets)\s*$/i.test(t)) return null;
    for (const d of this.s.settings.distractions) if (titleShowsSite(t, d)) return d;
    return null;
  }

  /** One sample from the background agent: the foreground window, and how long the user has been idle. */
  observe(sample: { app: string; title: string; url?: string; idleSec: number }) {
    const t = this.now();
    if (sample.idleSec >= IDLE_BREAK_SEC) { this.s.workStreakStart = undefined; this.touch(); return; }
    let site: string | undefined;
    if (sample.url) { try { site = this.matchDistraction(new URL(sample.url).hostname) ?? undefined; } catch { /* ignore */ } }
    const title = cleanTitle(sample.title || "");
    const last = this.s.activity[this.s.activity.length - 1];
    if (last && last.app === sample.app && last.title === title && t - last.end < SEGMENT_GAP_MS) last.end = t;
    else this.s.activity.push({ app: sample.app, title, site, start: t, end: t });

    if (site) this.s.workStreakStart = undefined;                      // a distraction breaks the streak
    else if (!this.s.workStreakStart || (this.s.lastActiveAt && t - this.s.lastActiveAt > IDLE_BREAK_SEC * 1000)) this.s.workStreakStart = t;
    this.s.lastActiveAt = t;
    this.touch();
  }

  workStreakMinutes(): number {
    return this.s.workStreakStart ? mins(this.now() - this.s.workStreakStart) : 0;
  }

  /** Where the last N minutes actually went, grouped by window, excluding Synapse itself. */
  recentWindows(windowMin = 60, limit = 5): { label: string; minutes: number; distraction: boolean }[] {
    const from = this.now() - windowMin * 60_000;
    const agg = new Map<string, { ms: number; distraction: boolean }>();
    for (const a of this.s.activity) {
      if (a.end < from || /synapse/i.test(a.app)) continue;
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
    const f = this.s.focus;
    if (f && this.now() - f.setAt < 3 * 3600_000) return { text: f.text, source: "stated" };
    const top = this.recentWindows(30, 3).find((w) => !w.distraction && w.minutes >= 5 && !/^(explorer|searchhost|shellexperiencehost|lockapp)/i.test(w.label));
    return top ? { text: top.label.replace(/\s*\([^)]*\)$/, ""), source: "inferred" } : null;
  }

  /* ---------------- the gate ---------------- */

  activePass(site: string): Pass | null {
    const p = this.s.passes[site];
    return p && p.expiresAt > this.now() ? p : null;
  }

  logGate(ev: Omit<GateEvent, "ts">) { this.s.gateLog.push({ ts: this.now(), ...ev }); this.touch(); }

  grantPass(site: string, minutes: number, reason: string): Pass {
    const t = this.now();
    const p: Pass = { site, minutes, reason: reason.slice(0, 240), grantedAt: t, expiresAt: t + minutes * 60_000 };
    this.s.passes[site] = p;
    this.logGate({ site, kind: "pass", minutes, text: reason.slice(0, 240) });
    return p;
  }

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
      minutes: passes.reduce((a, e) => a + (e.minutes ?? 0), 0),
      denials: ev.filter((e) => e.kind === "deny" || e.kind === "timeout").length,
      walkedAway: ev.filter((e) => e.kind === "walked_away").length,
      reasons: passes.map((e) => `${siteName(e.site)} ${e.minutes}m: "${e.text ?? ""}"`),
    };
  }

  /* ---------------- conversation + memory ---------------- */

  addTurn(role: Turn["role"], text: string, surface: Turn["surface"]) { this.s.turns.push({ ts: this.now(), role, text: text.slice(0, 1500), surface }); this.touch(); }
  noteAppEvent(text: string) { this.s.appEvents.push({ ts: this.now(), text }); this.touch(); }

  /** Read the hidden tags the model appended, apply them to state, and return the clean reply. */
  ingest(raw: string): { text: string; reachouts: Reachout[] } {
    const t = this.now();
    const reachouts: Reachout[] = [];
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
      } else if (kind === "focus") this.s.focus = { text: a.slice(0, 160), setAt: t };
      else if (kind === "distraction") { const d = cleanSite(a); if (d.includes(".") && !this.s.settings.distractions.includes(d)) this.s.settings.distractions.push(d); }
      else if (kind === "reachout") {
        const n = parseInt(a, 10);
        if (n > 0 && parts[1]) { const r = { id: rid(), at: t + Math.min(24 * 60, n) * 60_000, text: parts[1].slice(0, 200) }; this.s.reachouts.push(r); reachouts.push(r); }
      } else if (kind === "principle") this.s.memory.principles.push({ text: a, ts: t });
      else if (kind === "mindshift") this.s.memory.mindshifts.push({ text: a, ts: t });
      else if (kind === "observe") this.s.memory.observations.push({ key: a, text: parts[1] ?? a, ts: t });
      else if (kind === "rec") this.s.memory.calls.push({ text: a, ts: t });
    }
    this.touch();
    const text = raw.replace(/\[\[[\s\S]*?\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return { text, reachouts };
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

    const focus = this.currentFocus();
    if (focus) lines.push(focus.source === "stated"
      ? `WORKING ON (they told you, ${mins(t - (this.s.focus?.setAt ?? t))} min ago): ${focus.text}`
      : `WORKING ON (inferred from their screen, not stated): ${focus.text}`);

    const streak = this.workStreakMinutes();
    const windows = this.recentWindows(60, 5);
    lines.push(`COMPUTER ACTIVITY: ${streak ? `actively working for ${streak} min without a break` : "no continuous work streak right now"}.` +
      (windows.length ? `\nLast hour, by time:\n${windows.map((w) => `- ${w.label}: ${w.minutes} min${w.distraction ? " [distraction]" : ""}`).join("\n")}` : "\nNo activity recorded in the last hour."));

    const d = this.today();
    lines.push(`DISTRACTION GATE TODAY: ${d.passes} passes (${d.minutes} min), ${d.denials} denied or timed out, ${d.walkedAway} times they walked away on their own.` +
      (d.reasons.length ? `\nReasons that got them in today:\n- ${d.reasons.slice(-5).join("\n- ")}` : ""));
    const live = Object.values(this.s.passes).filter((p) => p.expiresAt > t);
    if (live.length) lines.push(`ACTIVE PASS: ${live.map((p) => `${siteName(p.site)}, ${Math.ceil((p.expiresAt - t) / 60_000)} min left`).join("; ")}`);

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
      const convo = this.s.turns.filter((x) => t - x.ts < 6 * 3600_000).slice(-10);
      if (convo.length) lines.push(`RECENT EXCHANGES WITH THE ORB:\n${convo.map((x) => `${x.role === "user" ? "Them" : "Synapse"}${x.surface === "gate" ? " (at the gate)" : ""}: ${x.text.slice(0, 400)}`).join("\n")}`);
    }
    return lines.join("\n\n");
  }
}
