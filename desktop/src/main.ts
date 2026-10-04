/**
 * SYNAPSE — the Windows app.
 *
 *   Orb UI ─┐                         ┌─ Context (foreground window, idle time, browser tab)
 *           ├── Synapse core (brain) ─┼─ Goals
 *   Agent  ─┘                         └─ Memory
 *
 * This process is the background agent: it samples what you're doing, owns the one Synapse
 * brain, talks to the browser helper, and drives the orb window. There is no other interface
 * apart from a tray menu for the few settings that shouldn't be one impulse away.
 */
import { app, BrowserWindow, Tray, Menu, ipcMain, screen, powerMonitor, globalShortcut, desktopCapturer, nativeImage, Notification, shell, systemPreferences } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createSynapse, relayTransport, geminiTransport, siteName, cleanSite, ANY_SITE, pageOnly, isGenericPage, type Synapse, type GateTurn } from "../../core/synapse";
import { Bridge, type TabInfo } from "./bridge";
import { foreground, BROWSERS, bringToFront, nativeHandle, closeBrowserTab, minimize, type Foreground } from "./foreground";

declare const __RELAY_URL__: string;

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId("com.synapse.orb");
const isMac = process.platform === "darwin";
const SHORTCUT_LABEL = isMac ? "⌘⇧Space" : "Ctrl+Shift+Space";
let screenPermissionMissing = false;

/* ---------------- storage + core ---------------- */

const dataDir = app.getPath("userData");
const brainFile = path.join(dataDir, "brain.json");
const storage = {
  load: () => { try { return fs.readFileSync(brainFile, "utf8"); } catch { return null; } },
  save: (json: string) => { fs.mkdirSync(dataDir, { recursive: true }); const tmp = brainFile + ".tmp"; fs.writeFileSync(tmp, json); fs.renameSync(tmp, brainFile); },
};

/** Diagnostics: one plain-text log next to the brain, so "it didn't close my tab" can be traced. */
const logFile = path.join(dataDir, "synapse.log");
function log(msg: string) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2_000_000) fs.renameSync(logFile, logFile + ".old");
    fs.appendFileSync(logFile, `${new Date().toISOString()}  ${msg}\n`);
  } catch { /* never let logging break anything */ }
}

let syn: Synapse;
const bridge = new Bridge();
let orb: BrowserWindow;
let settingsWin: BrowserWindow | null = null;
let tray: Tray;

type Mode = "dock" | "peek" | "card";
let mode: Mode = "dock";
let slideTimer: NodeJS.Timeout | null = null;
let cardSize = { w: 380, h: 220 };

/**
 * A gate can be started two ways:
 *   "helper" — the browser helper told us the exact tab (we can veil it and close it precisely)
 *   "window" — no helper; we recognised the site from the browser's window title (Windows) or
 *              AppleScript URL (Mac), and close it by sending the browser Ctrl+W / AppleScript.
 */
interface Gate {
  site: string; transcript: GateTurn[]; judging: boolean;
  via: "helper" | "window"; target?: Foreground;
  budgetMs: number; resumedAt: number; backstop?: NodeJS.Timeout; running: boolean;
  typingSince?: number; typingUsedMs: number;
}
let gate: Gate | null = null;
/** After a gate ends with "close the tab", don't reopen a gate for that site while it closes. */
const cooldown = new Map<string, number>();
function coolingDown(site: string) { return (cooldown.get(site) ?? 0) > Date.now(); }
/** A tab for this site showed up while we were still closing the last one: look again once the
 *  cooldown is over, so it never sits under the veil with no card. */
const recheckTimers = new Map<string, NodeJS.Timeout>();
function recheckAfterCooldown(site: string) {
  clearTimeout(recheckTimers.get(site));
  const wait = Math.max(50, (cooldown.get(site) ?? 0) - Date.now() + 50);
  recheckTimers.set(site, setTimeout(() => {
    recheckTimers.delete(site);
    const t = bridge.activeTab();
    if (t) onTab(t);
    else if (!helperSeesBrowser()) watch();
  }, wait));
}
const passTimers = new Map<string, NodeJS.Timeout>();
const reachTimers = new Map<string, NodeJS.Timeout>();

const ORB_BOX = 76;       // window size when docked
const DOCK_HIDE = 30;     // px of the docked orb tucked past the screen edge

/* ---------------- orb window ---------------- */

function workArea() { return screen.getPrimaryDisplay().workArea; }
function orbY() { const wa = workArea(); return Math.round(wa.y + wa.height * 0.62); }

function layout(next: Mode = mode) {
  if (next === "card" && slideTimer) { clearInterval(slideTimer); slideTimer = null; }
  mode = next;
  const wa = workArea();
  const hasPass = chipShown();
  if (mode === "card") {
    const w = cardSize.w + 24, h = cardSize.h + 24;
    const y = Math.max(wa.y + 8, Math.min(orbY() + ORB_BOX / 2 - h + 40, wa.y + wa.height - h - 8));
    orb.setBounds({ x: wa.x + wa.width - w - 8, y, width: w, height: h });
  } else {
    const w = hasPass ? ORB_BOX + 104 : ORB_BOX;
    const tucked = mode === "dock" && !hasPass ? DOCK_HIDE : 0;
    orb.setBounds({ x: wa.x + wa.width - w + tucked, y: orbY() - ORB_BOX / 2, width: w, height: ORB_BOX });
  }
  orb.webContents.send("orb", { type: "mode", mode, pass: passView() });
}

/** Slide the docked orb out of (or back into) the screen edge in a few quick steps. */
function slidePeek(out: boolean) {
  if (chipShown()) return;                 // with a pass/pause chip the orb is already fully out
  mode = out ? "peek" : "dock";
  const wa = workArea();
  const target = wa.x + wa.width - ORB_BOX + (out ? 0 : DOCK_HIDE);
  if (slideTimer) clearInterval(slideTimer);
  slideTimer = setInterval(() => {
    if (mode === "card") { if (slideTimer) clearInterval(slideTimer); slideTimer = null; return; }
    const [x, y] = orb.getPosition();
    const next = Math.abs(target - x) <= 4 ? target : Math.round(x + (target - x) * 0.45);
    orb.setPosition(next, y);
    if (next === target && slideTimer) { clearInterval(slideTimer); slideTimer = null; }
  }, 16);
}

/**
 * The orb is a fixed-size UI, not a web page: Ctrl+minus / Ctrl+scroll used to zoom it (and the
 * zoom was remembered), shrinking it until it was unreadable. Lock it at 100% for good.
 */
function lockZoom(win: BrowserWindow) {
  const wc = win.webContents;
  const reset = () => { wc.setZoomFactor(1); wc.setVisualZoomLevelLimits(1, 1).catch(() => {}); };
  wc.on("did-finish-load", reset);
  wc.on("zoom-changed", reset);
  wc.on("before-input-event", (e, input) => {
    if ((input.control || input.meta) && ["-", "=", "+", "0", "Minus", "Equal", "Plus"].includes(input.key)) e.preventDefault();
  });
  reset();
}

function createOrb() {
  orb = new BrowserWindow({
    width: ORB_BOX, height: ORB_BOX, frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false,
    alwaysOnTop: true, show: false, backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  orb.setAlwaysOnTop(true, "screen-saver");
  orb.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  orb.loadFile(path.join(__dirname, "orb", "index.html"));
  lockZoom(orb);
  orb.once("ready-to-show", () => { layout("dock"); orb.showInactive(); });
  orb.on("blur", () => { if (mode === "card" && !gate) orb.webContents.send("orb", { type: "blur" }); });
  screen.on("display-metrics-changed", () => layout());
}

function resizeHidden(fn: () => void) {
  orb.setOpacity(0);
  fn();
  setTimeout(() => orb.setOpacity(1), 24);
}

function openCard(takeFocus = true) {
  if (mode !== "card") resizeHidden(() => layout("card"));
  else layout("card");
  if (!takeFocus) { orb.showInactive(); orb.moveTop(); return; }
  orb.show(); orb.moveTop(); orb.focus();
  if (process.platform === "win32") bringToFront(nativeHandle(orb.getNativeWindowHandle()));
}
function closeCard() { if (!gate && mode === "card") resizeHidden(() => layout("dock")); }

/* ---------------- passes ---------------- */

/** The pass the chip shows: free time if they have it (it covers everything), else the one ending soonest. */
function soonestPass() {
  const now = Date.now();
  const live = Object.values(syn.brain.s.passes).filter((p) => p.expiresAt > now);
  return live.find((p) => p.site === ANY_SITE) ?? live.sort((a, b) => a.expiresAt - b.expiresAt)[0] ?? null;
}
function passView() {
  const until = syn.brain.paused();
  if (until) return { name: "Paused", expiresAt: until, paused: true, open: syn.brain.pausedIndefinitely() };
  const off = syn.brain.offClock();
  if (off) return { name: "Work's done", expiresAt: off.until ?? off.since + 10 * 3600_000, paused: true };
  const p = soonestPass();
  if (p?.auto) return { name: `${siteName(p.site)} · on task`, expiresAt: p.expiresAt, paused: false, label: true };
  return p ? { name: siteName(p.site), expiresAt: p.expiresAt } : null;   // "Free time 14:59"
}
function chipShown() { return !!soonestPass() || !!syn.brain.paused() || !!syn.brain.offClock(); }
/** Not gating right now: they paused Synapse, or their work is done for the day. */
function standingDown() { return !!syn.brain.paused() || !!syn.brain.offClock(); }

function pushConfig() {
  const passes: Record<string, number> = {};
  for (const p of Object.values(syn.brain.s.passes)) passes[p.site] = p.expiresAt;
  // While paused the helper has nothing to veil.
  // The helper never veils on its own any more: Synapse watches what they're doing first, and holds a
  // tab only when it decides to ask (see observeTick).
  bridge.config([], passes);
}

/* ---------------- pause: "leave me alone for a bit" ---------------- */

let pauseTimer: NodeJS.Timeout | null = null;
function schedulePause() {
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = null;
  const until = syn.brain.paused();
  // An open-ended /pause has no timer (and setTimeout can't wait a year: it would fire immediately).
  if (until && !syn.brain.pausedIndefinitely()) pauseTimer = setTimeout(() => { syn.brain.paused(); onPauseChanged(false); notice("I'm back on.", 2500); }, Math.max(0, until - Date.now()) + 200);
}
/** Called after pausing or resuming from anywhere (tray, the orb, or the pause running out). */
function onPauseChanged(announce = true) {
  const until = syn.brain.paused();
  if (until && gate) { endGate(); bridge.release([...bridge.tabs.keys()]); }
  log(until ? `paused until ${new Date(until).toISOString()}` : "resumed");
  schedulePause();
  pushConfig();
  buildTray();
  layout();
  if (announce && mode !== "card") orb.webContents.send("orb", { type: "mode", mode, pass: passView() });
  if (!until) recheckSoon(800);   // back on: the tab they're sitting on gets its gate now
}
function pauseFor(minutes: number) {
  const until = syn.brain.pause(minutes);
  onPauseChanged();
  notice(`I'm off until ${new Date(until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Relax.`, 2500);
}
/** Entering or leaving "work's done": release everything / start gating again, and update the chip and tray. */
let wasFree = false;
function syncFreeState() {
  const free = !!syn.brain.offClock();
  if (free === wasFree) return;
  wasFree = free;
  log(free ? "work's done: not gating until they start working again" : "back to work: gating again");
  if (free) { if (gate) endGate(); bridge.release([...bridge.tabs.keys()]); }
  pushConfig(); buildTray(); layout();
  if (mode !== "card") orb.webContents.send("orb", { type: "mode", mode, pass: passView() });
  if (!free) recheckSoon(800);
}
function clockBackIn() { syn.brain.clockBackIn("from the tray menu"); syncFreeState(); notice("Back on. Let's go.", 2000); }

function resetFromTray() {
  syn.brain.reset();
  for (const t of passTimers.values()) clearTimeout(t);
  passTimers.clear();
  onPauseChanged(); syncFreeState();
  notice("Reset. I'm fully back on.", 2200);
}

function resumeNow() { syn.brain.resume(); onPauseChanged(); notice("I'm back on.", 2000); }

/** Every way a gate ends goes through here, so the orb always learns the gate is over. */
function endGate() {
  if (gate) clearTimeout(gate.backstop);
  gate = null;
  orb?.webContents.send("orb", { type: "gate-ended" });
}

function schedulePass(site: string) {
  const p = syn.brain.activePass(site);
  if (!p) { clearTimeout(passTimers.get(site)); return; }
  const key = p.site;                       // may be free time ("*") covering this site
  clearTimeout(passTimers.get(key));
  passTimers.set(key, setTimeout(() => expirePass(key), Math.max(0, p.expiresAt - Date.now())));
}

function expirePass(site: string, early = false) {
  clearTimeout(passTimers.get(site)); passTimers.delete(site);
  const wasAuto = !!syn.brain.s.passes[site]?.auto;
  syn.brain.endPass(site, early ? "ended_early" : "expired");
  if (wasAuto) { pushConfig(); layout(); log(`on-task window for ${site} lapsed; watching again`); return; }   // the watcher looks again
  pushConfig();
  layout();
  // Paused: they asked to be left alone. The pass just ends quietly.
  if (syn.brain.paused()) return;
  // Still covered by another pass (free time, or a site pass during free time)? Then nothing ends for them.
  const stillCovered = site !== ANY_SITE && !!syn.brain.activePass(site);
  if (stillCovered) return;
  const focus = syn.brain.currentFocus();
  const label = site === ANY_SITE ? "free time" : siteName(site);
  notice(early ? `Done with ${label}. Good.` : `That's your ${label === "free time" ? "free time" : `time on ${label}`}.${focus ? ` Back to ${focus.text}.` : " Back to it."}`, 4000);
  // Time's up means the tab closes — don't open a fresh gate on it in the moments before it does.
  const delay = early ? 600 : 3000;
  for (const d of site === ANY_SITE ? syn.brain.s.settings.distractions : [site]) if (!syn.brain.activePass(d)) cooldown.set(d, Date.now() + delay + 2500);
  closeIfShowing(site, delay);
}

/** They went back to work before their break ran out: stop the timer, quietly. Nothing to close. */
function endPassOnLeave(site: string, fg: Foreground) {
  const p = syn.brain.s.passes[site];
  const left = p ? Math.max(0, Math.round((p.expiresAt - Date.now()) / 60_000)) : 0;
  clearTimeout(passTimers.get(site)); passTimers.delete(site);
  syn.brain.endPass(site, "ended_early");
  if (!p?.auto) syn.brain.noteAppEvent(`they left ${site === ANY_SITE ? "their break" : siteName(site)} for "${cleanTitleForLog(fg.title)}" with ${left} min left, so Synapse stopped the timer`);
  log(`left ${site === ANY_SITE ? "break" : site} for ${fg.app} "${cleanTitleForLog(fg.title)}" with ${left} min left: timer stopped`);
  pushConfig();
  // Tuck away: no card, no message — the chip just disappears.
  if (mode === "card" && !gate) orb.webContents.send("orb", { type: "close-card" });
  layout();
  if (mode !== "card") orb.webContents.send("orb", { type: "mode", mode, pass: passView() });
}
function cleanTitleForLog(t: string) { return (t || "").replace(/\s+[-–—]\s+(Google Chrome|Microsoft.*Edge|Mozilla Firefox)$/i, "").slice(0, 60); }

/**
 * When a pass ends, close the distracting tab they're LOOKING AT (if the pass covered it and nothing
 * else still does). Tabs in the background aren't touched: they get a gate the next time they're
 * opened. And nothing is pulled to the front if they've already moved on to something else.
 */
function closeIfShowing(passSite: string, delay: number) {
  setTimeout(async () => {
    if (syn.brain.paused()) return;
    const covers = (d: string | null) => !!d && (passSite === ANY_SITE || d === passSite) && !syn.brain.activePass(d);
    const tab = helperSeesBrowser() ? bridge.activeTab() : null;
    if (tab) {
      let host = ""; try { host = new URL(tab.url).hostname; } catch { /* ignore */ }
      const d = syn.brain.matchDistraction(host);
      if (covers(d)) { cooldown.set(d!, Date.now() + 8000); bridge.close([tab.tabId]); log(`pass over: closed ${d} (helper)`); }
      return;
    }
    const fg = await foreground();
    if (!fg || !BROWSERS.test(fg.app)) return;          // they're elsewhere: nothing to close, nothing stolen
    const d = siteOf(fg);
    if (covers(d)) { cooldown.set(d!, Date.now() + 8000); closeSite(d!, fg); }
  }, delay);
}

/* ---------------- the gate ---------------- */

function tabsOf(site: string) {
  return [...bridge.tabs.values()].filter((t) => {
    try {
      const host = new URL(t.url).hostname;
      if (site === ANY_SITE) return !!syn.brain.matchDistraction(host);   // free time covers every distraction
      const h = host.replace(/^www\./, ""); return h === site || h.endsWith("." + site);
    } catch { return false; }
  }).map((t) => t.tabId);
}

function onTab(t: TabInfo) {
  if (standingDown()) { bridge.release([t.tabId]); return; }
  let host = "";
  try { host = new URL(t.url).hostname; } catch { return; }
  const site = syn.brain.matchDistraction(host);
  const looking = t.active && t.focused;

  if (!site) {
    bridge.release([t.tabId]);   // never leave a veil on a page that isn't a distraction (e.g. studio.youtube.com)
    // They left for something else while being asked — that's walking away, and it counts.
    if (gate && looking && !gate.judging) {
      clearTimeout(gate.backstop);
      syn.brain.logGate({ site: gate.site, kind: "walked_away" });
      const name = siteName(gate.site);
      endGate();
      notice(`Good call. ${name} can wait.`, 2500);
    }
    return;
  }
  if (syn.brain.activePass(site)) { bridge.release([t.tabId]); if (looking) driftCheck(site, t.title, "helper"); return; }
  if (looking && gate && !gate.judging && site !== gate.site) { bridge.hold([t.tabId]); moveGate(site, t.title); return; }
  if (looking && !gate) {
    if (!coolingDown(site)) observeTick(site, t.title, "helper");
    else { bridge.hold([t.tabId]); recheckAfterCooldown(site); }
  }
}

/**
 * WATCH FIRST, THEN DECIDE. Opening YouTube or Instagram isn't a crime: what matters is what they DO
 * there. So instead of stopping them the moment a "distracting" site appears, Synapse looks at what's
 * actually on the page — the page title, and (if they allow it) a look at the screen — and:
 *   productive (SAT prep videos, focus music, a business chat) → lets them be, quietly, and keeps watching;
 *   distracting (a game, a chess stream, reels) → gives them a few seconds to leave on their own, then asks;
 *   can't tell (a home page, a feed) → keeps watching, and asks only if that goes on for a minute.
 * Sites they were just turned away from, and game sites, get asked straight away.
 */
interface Observation { site: string; via: Gate["via"]; target?: Foreground; since: number; lastTitle: string; busy: boolean; shotAt: number; flagAt?: number; flagWhat?: string }
let observing: Observation | null = null;
const OBSERVE_GRACE_MS = 60_000;   // still can't tell after this long (scrolling a feed) → ask
const CONFIRM_MS = 6_000;          // looks like a distraction → a few seconds to leave on their own first

function recentlyTurnedAway(site: string) {
  const t = Date.now();
  return syn.brain.s.gateLog.some((e) => e.site === site && (e.kind === "deny" || e.kind === "timeout") && t - e.ts < 10 * 60_000);
}

function observeTick(site: string | null, title: string, via: Gate["via"], target?: Foreground) {
  if (observing && observing.site !== site) { log(`watch ${observing.site}: they left`); observing = null; }
  if (!site || gate || standingDown()) return;
  if (syn.brain.activePass(site)) { observing = null; return; }
  const now = Date.now();
  if (!observing) {
    if (recentlyTurnedAway(site)) { startGate(site, title, via, target); return; }
    observing = { site, via, target, since: now, lastTitle: "", busy: false, shotAt: 0 };
    log(`watch ${site}: looking before deciding — "${title.slice(0, 70)}"`);
  }
  const o = observing;
  if (target) o.target = target;
  if (o.flagAt && now >= o.flagAt) { flag(o, `That looks like ${o.flagWhat}. What's going on?`); return; }
  if (o.busy) return;
  const page = pageOnly(title, site);
  const generic = isGenericPage(page, site);
  const wantShot = generic && syn.brain.s.settings.shareScreen && now - o.since > 8000 && now - o.shotAt > 20_000;
  if (title !== o.lastTitle || wantShot) { void assess(o, title, wantShot); return; }
  if (!o.flagAt && now - o.since > OBSERVE_GRACE_MS) flag(o, `You've been on ${siteName(site)} for a bit. What are you up to?`);
}

async function assess(o: Observation, title: string, withShot: boolean) {
  o.busy = true;
  o.lastTitle = title;
  let r: Awaited<ReturnType<Synapse["assessPage"]>>;
  try {
    const shot = withShot ? await captureScreen(true) : null;
    if (withShot) o.shotAt = Date.now();
    r = await syn.assessPage({ site: o.site, title, screenshot: shot, seconds: (Date.now() - o.since) / 1000 });
  } catch (e) { r = { verdict: "unclear", what: siteName(o.site), source: "offline" }; log(`watch ${o.site}: check failed ${String(e).slice(0, 120)}`); }
  o.busy = false;
  if (observing !== o || gate) return;
  log(`watch ${o.site}: "${pageOnly(title, o.site).slice(0, 60)}"${withShot ? " +screen" : ""} → ${r.verdict} (${r.what}; ${r.source})`);
  if (r.verdict === "productive") {
    observing = null;
    const p = syn.brain.grantPass(o.site, 20, r.what, "task", true);
    syn.brain.noteAppEvent(`Synapse saw them working on ${siteName(o.site)} (${r.what}) and let them be`);
    schedulePass(p.site); pushConfig(); layout();
  } else if (r.verdict === "distracting") {
    if (!o.flagAt) { o.flagAt = Date.now() + CONFIRM_MS; o.flagWhat = r.what; }
  } else if (o.flagAt && title !== o.flagWhat) {
    o.flagAt = undefined;   // moved on to something that isn't clearly a distraction: keep watching
  }
}

function flag(o: Observation, opener: string) {
  observing = null;
  log(`watch ${o.site}: asking — ${opener}`);
  syn.brain.noteAppEvent(`Synapse watched them on ${siteName(o.site)} ("${pageOnly(o.lastTitle, o.site).slice(0, 60)}") and decided to ask`);
  if (o.via === "helper") bridge.hold(tabsOf(o.site));
  startGate(o.site, o.lastTitle, o.via, o.target, opener);
}

/**
 * ON-TASK CHECK. A task pass ("PSAT prep on YouTube") is trust, not a free pass: each new page they
 * open on that site is checked against what they said it was for. A clear mismatch ("CHESS SPEEDRUN
 * IS BACK") ends the pass and asks them about it. Home pages, searches and anything ambiguous never
 * interrupt them.
 */
const taskChecks = new Map<string, "pending" | "yes" | "no" | "unsure">();
function driftCheck(site: string, rawTitle: string, via: Gate["via"], target?: Foreground) {
  const p = syn.brain.activePass(site);
  if (!p || p.kind !== "task" || p.site === ANY_SITE) return;
  const title = (rawTitle || "").replace(/\s+[-–—]\s+(Google Chrome|Microsoft.*Edge|Mozilla Firefox|Brave|Opera|Safari|Arc)$/i, "").replace(/^\(\d+\+?\)\s*/, "").trim();
  // Nothing specific to judge yet: the site's home page, a bare site name, a search page.
  if (!title || title.length < 6 || /^(youtube|reddit|x|twitter|instagram|tiktok|twitch|netflix)$/i.test(title) || /^(home|search|results)\b/i.test(title)) return;
  const key = `${p.grantedAt}|${site}|${title}`;
  if (taskChecks.has(key)) return;
  taskChecks.set(key, "pending");
  if (taskChecks.size > 300) taskChecks.delete(taskChecks.keys().next().value!);
  // A window Synapse opened on its own (it saw them working): judge each new page fresh — switching
  // from SAT prep to a chem lecture is still work. A pass they asked for: does the page fit what they said?
  const check: Promise<{ fits: "yes" | "no" | "unsure"; why: string }> = p.auto
    ? syn.assessPage({ site, title: rawTitle }).then((a) => {
        if (a.verdict === "productive") { const q = syn.brain.s.passes[p.site]; if (q?.auto) { q.reason = a.what; syn.brain.grantPass(site, 20, a.what, "task", true); schedulePass(site); } }
        return { fits: a.verdict === "distracting" ? "no" : a.verdict === "productive" ? "yes" : "unsure", why: a.what };
      })
    : syn.checkOnTask(site, title, p.reason);
  check.then((r) => {
    taskChecks.set(key, r.fits);
    log(`on-task check ${site}: "${title.slice(0, 60)}" → ${r.fits}${r.why ? ` (${r.why})` : ""}`);
    if (r.fits !== "no" || gate || syn.brain.paused()) return;
    const still = syn.brain.activePass(site);
    if (!still || still.grantedAt !== p.grantedAt) return;
    // Off task: the pass ends and they're asked about it, gently.
    clearTimeout(passTimers.get(site)); passTimers.delete(site);
    syn.brain.endPass(site, "ended_early");
    syn.brain.noteAppEvent(`during a ${siteName(site)} pass for "${p.reason.slice(0, 80)}" they opened "${title.slice(0, 80)}", which didn't fit, so Synapse ended the pass`);
    pushConfig(); layout();
    if (via === "helper") bridge.hold(tabsOf(site));
    const bare = title.replace(new RegExp(`\\s+[-–—|]\\s+${siteName(site).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "");
    const short = bare.length > 50 ? bare.slice(0, 50) + "…" : bare;
    startGate(site, title, via, target, p.auto ? `"${short}" — that doesn't look like work. What's going on?` : `"${short}" doesn't look like what you came here for. What's going on?`);
  }).catch(() => taskChecks.set(key, "unsure"));
}

/** The gate follows them to the next distraction, keeping the time they had left. */
function moveGate(site: string, pageTitle: string | undefined, target?: Foreground) {
  if (!gate) return;
  log(`gate moved: ${gate.site} → ${site}`);
  syn.brain.logGate({ site, kind: "opened", text: pageTitle?.slice(0, 120) });
  gate.site = site;
  if (target) gate.target = target;
  orb.webContents.send("orb", { type: "gate-site", site, name: siteName(site) });
}

function startGate(site: string, pageTitle: string | undefined, via: Gate["via"], target?: Foreground, openerOverride?: string) {
  if (standingDown()) return;
  log(`gate open: ${site} via ${via}${pageTitle ? ` — "${pageTitle.slice(0, 80)}"` : ""}`);
  // Main owns a backstop deadline (the orb's own clock normally fires first). It allows a short
  // grace for the card to appear, and pauses while Synapse is thinking.
  gate = { site, transcript: [], judging: false, via, target, budgetMs: (syn.brain.s.settings.windowSeconds + 3) * 1000, resumedAt: Date.now(), running: false, typingUsedMs: 0 };
  armBackstop();
  syn.brain.logGate({ site, kind: "opened", text: pageTitle?.slice(0, 120) });
  const opener = openerOverride ?? syn.gateOpener(site);
  gate.transcript.push({ role: "synapse", text: opener });
  openCard();
  orb.webContents.send("orb", { type: "gate", site, name: siteName(site), opener, seconds: syn.brain.s.settings.windowSeconds });
}

function armBackstop() {
  if (!gate) return;
  const g = gate;
  clearTimeout(g.backstop);
  g.resumedAt = Date.now();
  g.running = true;
  g.backstop = setTimeout(() => { if (gate === g && !g.judging) { orb.webContents.send("orb", { type: "timeout" }); gateTimeout(); } }, Math.max(0, g.budgetMs));
}
function pauseBackstop() {
  if (!gate || !gate.running) return;
  clearTimeout(gate.backstop);
  gate.running = false;
  gate.budgetMs -= Date.now() - gate.resumedAt;
}

/** The orb tells us while they're actively typing their case; the backstop waits too (capped). */
function gateTyping(on: boolean) {
  const g = gate;
  if (!g || g.judging) return;
  if (on && g.typingSince == null && g.typingUsedMs < 50_000) { g.typingSince = Date.now(); pauseBackstop(); }
  else if (!on && g.typingSince != null) { g.typingUsedMs += Date.now() - g.typingSince; g.typingSince = undefined; armBackstop(); }
}

/** Close every tab showing `site`: precisely through the helper, or the front tab via the OS. */
async function closeSite(site: string, target?: Foreground) {
  cooldown.set(site, Date.now() + 6000);
  if (bridge.connected) { bridge.closeSite(site); log(`close ${site}: asked the browser helper`); }
  // The helper only covers the browser it's installed in, so always also handle the window we saw.
  const fg = target ?? await foreground();
  if (!fg || !BROWSERS.test(fg.app)) {
    if (bridge.connected) cooldown.set(site, Date.now() + 1500);   // the helper closes tabs reliably
    else log(`close ${site}: no browser window to close (front app: ${fg?.app ?? "unknown"})`);
    return;
  }
  const result = await closeBrowserTab(fg, (now) => siteOf(now) === site, (m) => log(`${site} ${m}`), site);
  log(`close ${site}: ${result} (${fg.app})`);
  // Closed: a moment's grace for the browser to settle. Not closed: wait a bit before asking again.
  cooldown.set(site, Date.now() + (result === "closed" || result === "gone" ? 1500 : 5000));
  if (result === "minimized") notice(`I couldn't close the ${siteName(site)} tab, so I hid the window.`, 3500);
}

async function argue(text: string) {
  if (!gate || gate.judging) return;
  const g = gate;
  if (g.typingSince != null) { g.typingUsedMs += Date.now() - g.typingSince; g.typingSince = undefined; }
  g.judging = true;
  pauseBackstop();
  const pageTitle = [...bridge.tabs.values()].find((t) => tabsOf(g.site).includes(t.tabId))?.title
    ?? (g.target?.title ? g.target.title.replace(/\s+[-–—]\s+(Google Chrome|Microsoft.*Edge|Mozilla Firefox|Brave|Opera|Safari|Arc)$/i, "") : undefined);
  let v: Awaited<ReturnType<Synapse["judge"]>>;
  try { v = await syn.judge({ site: g.site, argument: text, transcript: g.transcript, pageTitle }); }
  catch (e) {
    log(`gate judge failed: ${String(e).slice(0, 200)}`);
    v = { decision: "ask", minutes: null, reply: "I couldn't think that through — say it once more, briefly.", source: "offline" };
  }
  log(`gate verdict: ${g.site} ${v.decision}${v.minutes ? ` ${v.minutes}m` : ""} (${v.source})`);
  g.transcript.push({ role: "user", text }, { role: "synapse", text: v.reply });
  g.judging = false;
  if (gate !== g) {
    // They walked away while I was thinking. If I said yes, the pass is real: track it anyway.
    if (v.decision === "allow" && v.pass) { schedulePass(v.pass.site); pushConfig(); }
    return;
  }
  orb.webContents.send("orb", { type: "verdict", ...v });
  if (v.decision === "ask") armBackstop();
  else clearTimeout(g.backstop);
  if (v.decision === "deny") {
    // Not convinced = the tab closes now, whatever the clock says. The reply stays up a moment
    // so they can read why.
    gate = null;
    cooldown.set(g.site, Date.now() + 8000);
    log(`gate deny: closing ${g.site}`);
    setTimeout(() => closeSite(g.site, g.target), 1600);
    setTimeout(() => { if (!gate && mode === "card") orb.webContents.send("orb", { type: "close-card" }); }, 3200);
    recheckSoon(3600);
    return;
  }
  if (v.decision === "allow" && v.free) {
    gate = null;
    if (v.command === "pause") { bridge.release([...bridge.tabs.keys()]); onPauseChanged(false); }
    syncFreeState();
    setTimeout(() => { if (!gate) layout("dock"); }, 2600);
    return;
  }
  if (v.decision === "allow") {
    gate = null;
    const key = v.pass?.site ?? g.site;              // a break is free time ("*"), not just this site
    schedulePass(key);
    pushConfig();
    bridge.release(tabsOf(key));
    setTimeout(() => { if (!gate) layout("dock"); }, 2200);
    recheckSoon(2400);
  } else if (v.decision === "crisis") {
    gate = null;
    bridge.release(tabsOf(g.site));
  }
}

function gateTimeout() {
  if (!gate) return;
  const { site, target } = gate;
  clearTimeout(gate.backstop);
  syn.brain.logGate({ site, kind: "timeout" });
  log(`gate timeout: ${site}`);
  gate = null;
  closeSite(site, target);
  notice(`Time's up. Closed ${siteName(site)}.`, 2500);
  recheckSoon(3000);
}

/** After a gate ends: if they're sitting on another held distraction (helper), gate that one now. */
function recheckSoon(ms: number) {
  setTimeout(() => { const t = bridge.connected ? bridge.activeTab() : null; if (t && !gate) onTab(t); }, ms);
}

function gateLeave() {
  if (!gate) return;
  const { site, target } = gate;
  clearTimeout(gate.backstop);
  syn.brain.logGate({ site, kind: "walked_away" });
  gate = null;
  closeSite(site, target);
  notice("Good call.", 1800);
}

/* ---------------- notices + check-ins ---------------- */

function notice(text: string, ms = 4000) {
  if (gate) { log(`notice skipped during a gate: ${text}`); return; }   // never cover an active gate
  openCard(false);
  orb.webContents.send("orb", { type: "notice", text, ms });
}

function scheduleReachouts() {
  for (const r of syn.brain.s.reachouts) {
    if (reachTimers.has(r.id)) continue;
    // Timers can't wait more than ~24 days (longer ones fire at once), so long waits re-arm in steps.
    reachTimers.set(r.id, setTimeout(() => {
      reachTimers.delete(r.id);
      if (Date.now() < r.at - 500) { scheduleReachouts(); return; }
      syn.brain.s.reachouts = syn.brain.s.reachouts.filter((x) => x.id !== r.id);
      if (syn.brain.paused()) {
        // Open-ended /pause: they asked to be left alone, so the check-in is dropped. A timed pause: after it.
        if (!syn.brain.pausedIndefinitely()) { syn.brain.s.reachouts.push({ ...r, at: (syn.brain.paused() ?? Date.now()) + 60_000 }); scheduleReachouts(); }
        return;
      }
      syn.brain.addTurn("synapse", r.text, "ask");
      if (!gate) notice(r.text, 9000);
      if (Notification.isSupported()) new Notification({ title: "Synapse", body: r.text, silent: true }).show();
    }, Math.min(6 * 3600_000, Math.max(1000, r.at - Date.now()))));
  }
}

/* ---------------- clarity: ask ---------------- */

async function captureScreen(background = false): Promise<string | null> {
  // macOS needs Screen Recording permission; without it the capture is just the wallpaper.
  if (isMac && systemPreferences.getMediaAccessStatus("screen") !== "granted") {
    if (background) return null;            // never pop a permission prompt from a background check
    screenPermissionMissing = true;
    desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {}); // triggers the system prompt once
    return null;
  }
  if (!background) screenPermissionMissing = false;
  // Asking about the screen: hide the orb for the shot. A background look leaves it alone (no flicker).
  const prev = orb.getOpacity();
  if (!background) { orb.setOpacity(0); await new Promise((r) => setTimeout(r, 120)); }
  try {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const scale = Math.min(1, 1600 / display.size.width);
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: Math.round(display.size.width * scale), height: Math.round(display.size.height * scale) } });
    const src = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
    return src ? src.thumbnail.toJPEG(72).toString("base64") : null;
  } catch { return null; } finally { if (!background) orb.setOpacity(prev || 1); }
}

let askPending = false;

async function ask(text: string, share: boolean) {
  const onboarding = !syn.brain.s.profile.onboardedAt;
  askPending = true;
  let r: { text: string; sawScreen: boolean; passChanges?: { site: string; minutes: number }[]; pauseChanged?: boolean; reset?: boolean };
  try {
    const shot = share ? await captureScreen() : null;
    r = await syn.ask(text, { screenshot: shot, onboarding });
  } catch (e) {
    log(`ask failed: ${String(e).slice(0, 200)}`);
    r = { text: "Something went wrong on my side. Ask me again in a moment.", sawScreen: false };
    syn.brain.addTurn("synapse", r.text, "ask");
  } finally { askPending = false; }
  scheduleReachouts();
  // They may have changed a pass by talking ("make it 20 minutes").
  for (const c of (r as { passChanges?: { site: string; minutes: number }[] }).passChanges ?? []) {
    log(`pass changed in conversation: ${c.site} → ${c.minutes} min from now`);
    if (c.minutes > 0) {
      schedulePass(c.site);
      bridge.release(tabsOf(c.site));
      if (gate && (c.site === ANY_SITE || c.site === gate.site)) { log(`gate ${gate.site} ended: pass granted in conversation`); endGate(); }
    }
    else { clearTimeout(passTimers.get(c.site)); passTimers.delete(c.site); closeIfShowing(c.site, 600); }
  }
  if ((r as { reset?: boolean }).reset) {
    // /reset: Synapse takes back control. Every pass and free-time timer is gone; the tab they're on gets a gate.
    for (const t of passTimers.values()) clearTimeout(t);
    passTimers.clear();
    log("reset: fully back on");
  }
  if ((r as { pauseChanged?: boolean }).pauseChanged) onPauseChanged();
  syncFreeState();
  layout();
  pushConfig(); // they may have added a distraction by talking
  const note = share && screenPermissionMissing
    ? "\n\n(I couldn't see your screen: allow Synapse under System Settings → Privacy & Security → Screen Recording, then reopen Synapse.)" : "";
  orb.webContents.send("orb", { type: "reply", text: r.text + note, sawScreen: r.sawScreen });
}

function openAsk() {
  if (gate) { openCard(); return; }
  openCard();
  const onboarding = !syn.brain.s.profile.onboardedAt;
  // The conversation survives closing the orb: send back the recent exchange (last 12 hours).
  const since = Date.now() - 12 * 3600_000;
  const history = syn.brain.s.turns.filter((t) => t.ts >= since && t.surface !== "gate").slice(-12).map((t) => ({ role: t.role, text: t.text }));
  orb.webContents.send("orb", {
    type: "ask", onboarding, share: syn.brain.s.settings.shareScreen, history, pending: askPending,
    prompt: onboarding ? "I'm Synapse. I'll sit here at the edge of your screen. What are you working toward right now?" : null,
  });
}

/* ---------------- background agent ---------------- */

/** True when the browser helper is connected AND it's the browser in front — then its precise
 *  tab events drive the gate and the window-title fallback stays out of the way. */
function helperSeesBrowser() { return bridge.connected && bridge.browserFocused; }

function siteOf(fg: Foreground): string | null {
  if (fg.url) { try { return syn.brain.matchDistraction(new URL(fg.url).hostname); } catch { return null; } }
  return syn.brain.matchTitle(fg.title);
}

/** Seconds since the last keyboard/mouse input. (Tests that fake the foreground window also fake "active".) */
function idleSeconds() { return process.env.SYNAPSE_FAKE_FG ? 0 : powerMonitor.getSystemIdleTime(); }

let watching = false;
let lastBrowser: { fg: Foreground; at: number } | null = null;
let lastObserve = 0;

/**
 * THE WATCHER — runs every ~0.6s (Windows) / 1.2s (Mac). Reads the window in front straight from
 * the OS, feeds the brain's activity log every 5s, and — when the helper isn't covering this
 * browser — recognises distracting sites itself and starts the gate.
 */
async function watch() {
  if (watching) return;
  watching = true;
  try {
    if (syn.brain.paused()) return;          // paused: not watching, not gating, not logging
    const fg = await foreground();
    if (!fg || /synapse|electron/i.test(fg.app)) return;
    const isBrowser = BROWSERS.test(fg.app);
    if (isBrowser) lastBrowser = { fg, at: Date.now() };
    const tab = isBrowser && helperSeesBrowser() ? bridge.activeTab() : null;

    if (Date.now() - lastObserve >= 5000) {
      lastObserve = Date.now();
      syn.brain.observe({ app: fg.app, title: tab?.title || fg.title, url: tab?.url || fg.url, idleSec: idleSeconds() });
    }
    // On a break but back at real work for a solid minute? Then the break is over — end it and tuck away.
    const idle = idleSeconds();
    if (idle < 180) for (const k of syn.brain.leftPass({ app: fg.app, title: tab?.title || fg.title, url: tab?.url || fg.url })) endPassOnLeave(k, fg);
    if (syn.brain.offClock()) { if (gate) { endGate(); bridge.release([...bridge.tabs.keys()]); } observing = null; return; }   // work's done: no gates
    if (!isBrowser) { if (observing) { log(`watch ${observing.site}: they left`); observing = null; } return; }
    if (helperSeesBrowser()) {
      let site: string | null = null;
      try { site = tab ? syn.brain.matchDistraction(new URL(tab.url).hostname) : null; } catch { site = null; }
      if (!gate) observeTick(site, tab?.title || fg.title, "helper");
      return;
    }

    const site = siteOf(fg);
    if (gate?.via === "window" && !gate.judging && site && site !== gate.site && !syn.brain.activePass(site)) {
      // Hopped from one distraction to another: same gate, same clock — not "walking away".
      moveGate(site, fg.title, fg);
      return;
    }
    if (gate?.via === "window" && !gate.judging && site !== gate.site) {
      // Same browser, different page now — they switched away on their own.
      clearTimeout(gate.backstop);
      syn.brain.logGate({ site: gate.site, kind: "walked_away" });
      const name = siteName(gate.site);
      endGate();
      notice(`Good call. ${name} can wait.`, 2500);
      return;
    }
    if (site && !gate && coolingDown(site) && !syn.brain.activePass(site)) { recheckAfterCooldown(site); return; }
    if (site && !gate && syn.brain.activePass(site)) { observing = null; driftCheck(site, fg.title, "window", fg); return; }
    if (gate) return;
    observeTick(site, fg.title, "window", fg);
  } finally {
    watching = false;
  }
}

/* ---------------- tray + settings ---------------- */

function helperPath() {
  return app.isPackaged ? path.join(process.resourcesPath, "browser-helper") : path.join(__dirname, "..", "..", "browser-helper");
}

function buildTray() {
  const menu = Menu.buildFromTemplate([
    { label: `Talk to Synapse          ${SHORTCUT_LABEL}`, click: openAsk },
    { type: "separator" },
    { label: bridge.connected ? "Browser helper: connected" : "Browser helper: not connected — set up…", click: () => openSettings("helper") },
    syn.brain.paused()
      ? { label: syn.brain.pausedIndefinitely() ? "Paused (/pause) — turn back on (/reset)" : `Paused until ${new Date(syn.brain.paused()!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — resume now`, click: resetFromTray }
      : { label: "Pause Synapse", submenu: [
          { label: "Until I turn it back on (/pause)", click: () => { syn.brain.pause(null); onPauseChanged(); notice("Paused until you type /reset.", 2500); } },
          { label: "30 minutes", click: () => pauseFor(30) },
          { label: "1 hour", click: () => pauseFor(60) },
          { label: "2 hours", click: () => pauseFor(120) },
          { label: "Until tomorrow morning", click: () => { const d = new Date(); d.setDate(d.getDate() + (d.getHours() >= 6 ? 1 : 0)); d.setHours(6, 0, 0, 0); pauseFor((d.getTime() - Date.now()) / 60_000); } },
        ] },
    ...(syn.brain.offClock() ? [{ label: "Work's done — I'm back to work", click: clockBackIn }] : []),
    { label: "Distracting sites & limits…", click: () => openSettings("sites") },
    { label: "Open diagnostics log", click: () => { log("log opened"); shell.openPath(logFile); } },
    { label: isMac ? "Open at login" : "Start with Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { type: "separator" },
    { label: "Quit Synapse", click: () => { syn.brain.noteAppEvent(`they quit Synapse at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`); syn.brain.flush(); app.exit(0); } },
  ]);
  tray.setContextMenu(menu);
}

function openSettings(section: "sites" | "helper") {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); settingsWin.webContents.send("settings", { section }); return; }
  settingsWin = new BrowserWindow({
    width: 460, height: 600, resizable: false, minimizable: false, maximizable: false, title: "Synapse", autoHideMenuBar: true, backgroundColor: "#07111d",
    icon: path.join(__dirname, "orb", "orb-256.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  });
  settingsWin.loadFile(path.join(__dirname, "orb", "settings.html"), { hash: section });
  lockZoom(settingsWin);
  settingsWin.on("closed", () => { settingsWin = null; });
}

/* ---------------- IPC ---------------- */

function wireIpc() {
  ipcMain.on("orb:peek", (_e, on: boolean) => { if (mode !== "card") slidePeek(!!on); });
  ipcMain.on("orb:ignore-mouse", () => { /* no-op: click-through used a system mouse hook that caused lag */ });
  ipcMain.on("orb:size", (_e, s: { w: number; h: number }) => { cardSize = { w: Math.min(420, Math.max(260, s.w)), h: Math.min(560, Math.max(80, s.h)) }; if (mode === "card") layout("card"); });
  ipcMain.on("orb:open-ask", () => openAsk());
  ipcMain.on("orb:close", () => closeCard());
  ipcMain.handle("orb:ask", (_e, text: string, share: boolean) => ask(String(text).slice(0, 2000), !!share));
  ipcMain.on("orb:set-share", (_e, on: boolean) => { syn.brain.s.settings.shareScreen = !!on; syn.brain.touch(); });
  ipcMain.on("gate:argue", (_e, text: string) => argue(String(text).slice(0, 1200)));
  ipcMain.on("gate:timeout", () => gateTimeout());
  ipcMain.on("gate:typing", (_e, on: boolean) => gateTyping(!!on));
  ipcMain.on("gate:leave", () => gateLeave());
  ipcMain.on("pass:end", () => { const p = soonestPass(); if (p) expirePass(p.site, true); });

  ipcMain.handle("settings:get", () => ({
    distractions: syn.brain.s.settings.distractions, windowSeconds: syn.brain.s.settings.windowSeconds, maxMinutes: syn.brain.s.settings.maxMinutes,
    helperConnected: bridge.connected, helperPath: helperPath(), goals: syn.brain.s.goals.filter((g) => !g.doneAt).map((g) => g.title),
  }));
  ipcMain.handle("settings:set", (_e, s: { distractions: string[]; windowSeconds: number; maxMinutes: number }) => {
    const before = new Set(syn.brain.s.settings.distractions);
    const next = [...new Set((s.distractions || []).map(cleanSite).filter((d) => d.includes(".")))];
    const removed = [...before].filter((d) => !next.includes(d));
    syn.brain.s.settings.distractions = next;
    syn.brain.s.settings.windowSeconds = Math.max(5, Math.min(120, Math.round(s.windowSeconds) || 15));
    syn.brain.s.settings.maxMinutes = Math.max(1, Math.min(120, Math.round(s.maxMinutes) || 30));
    if (removed.length) syn.brain.noteAppEvent(`they removed ${removed.join(", ")} from their distraction list`);
    syn.brain.touch();
    pushConfig();
    return true;
  });
  ipcMain.on("settings:open-helper", () => shell.openPath(helperPath()));
}

/* ---------------- boot ---------------- */

app.whenReady().then(() => {
  const key = process.env.GEMINI_API_KEY;
  const installIdHolder = { id: "" };
  syn = createSynapse({
    storage,
    callModel: key ? geminiTransport(key) : (c) => relayTransport(process.env.SYNAPSE_RELAY_URL || __RELAY_URL__, installIdHolder.id, fetch, (m) => log(m))(c),
  });
  installIdHolder.id = syn.brain.s.installId;

  Menu.setApplicationMenu(null);   // no hidden menu shortcuts (zoom, reload, devtools) on the orb
  createOrb();
  wireIpc();

  if (isMac) app.dock?.hide();
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, "orb", isMac ? "orb-18.png" : "orb-32.png"));
  tray = new Tray(trayIcon);
  tray.setToolTip("Synapse");
  tray.on("click", openAsk);
  buildTray();

  bridge.on("tab", onTab);
  bridge.on("status", (on: boolean) => { if (on) pushConfig(); buildTray(); settingsWin?.webContents.send("settings", { helperConnected: on }); });
  bridge.start();

  for (const site of Object.keys(syn.brain.s.passes)) schedulePass(site);
  scheduleReachouts();
  setInterval(watch, isMac ? 1200 : 600);
  setInterval(() => { syncFreeState(); if (mode !== "card" && chipShown()) orb.webContents.send("orb", { type: "mode", mode, pass: passView() }); }, 1000);
  // Safety net: if the orb is still showing a gate that no longer exists, close it.
  setInterval(() => { if (!gate && mode === "card") orb.webContents.send("orb", { type: "gate-ended" }); }, 4000);
  schedulePause();

  globalShortcut.register("CommandOrControl+Shift+Space", openAsk);
  if (app.isPackaged && !syn.brain.s.profile.onboardedAt) app.setLoginItemSettings({ openAtLogin: true });
  if (!syn.brain.s.profile.onboardedAt) setTimeout(openAsk, 1800);
});

app.on("second-instance", openAsk);
app.on("window-all-closed", () => { /* keep running in the tray */ });
app.on("before-quit", () => syn?.brain.flush());
