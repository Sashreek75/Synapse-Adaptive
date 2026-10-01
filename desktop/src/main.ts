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
import { createSynapse, relayTransport, geminiTransport, siteName, cleanSite, type Synapse, type GateTurn } from "../../core/synapse";
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
const passTimers = new Map<string, NodeJS.Timeout>();
const reachTimers = new Map<string, NodeJS.Timeout>();

const ORB_BOX = 76;       // window size when docked

/* ---------------- orb window ---------------- */

function workArea() { return screen.getPrimaryDisplay().workArea; }
function orbY() { const wa = workArea(); return Math.round(wa.y + wa.height * 0.62); }

function layout(next: Mode = mode) {
  mode = next;
  const wa = workArea();
  const hasPass = !!soonestPass();
  if (mode === "card") {
    const w = cardSize.w + 24, h = cardSize.h + 24;
    const y = Math.max(wa.y + 8, Math.min(orbY() + ORB_BOX / 2 - h + 40, wa.y + wa.height - h - 8));
    orb.setBounds({ x: wa.x + wa.width - w - 8, y, width: w, height: h });
  } else {
    // The orb tucks itself past the edge with CSS (smooth); the window just hugs the screen edge.
    const w = hasPass ? ORB_BOX + 104 : ORB_BOX;
    orb.setBounds({ x: wa.x + wa.width - w, y: orbY() - ORB_BOX / 2, width: w, height: ORB_BOX });
    orb.setIgnoreMouseEvents(true, { forward: true });
  }
  orb.webContents.send("orb", { type: "mode", mode, pass: passView() });
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
  orb.once("ready-to-show", () => { layout("dock"); orb.showInactive(); orb.setIgnoreMouseEvents(true, { forward: true }); });
  orb.on("blur", () => { if (mode === "card" && !gate) orb.webContents.send("orb", { type: "blur" }); });
  screen.on("display-metrics-changed", () => layout());
}

function openCard(takeFocus = true) {
  layout("card");
  orb.setIgnoreMouseEvents(false);
  if (!takeFocus) { orb.showInactive(); orb.moveTop(); return; }
  orb.show(); orb.moveTop(); orb.focus();
  if (process.platform === "win32") bringToFront(nativeHandle(orb.getNativeWindowHandle()));
}
function closeCard() { if (!gate) layout("dock"); }

/* ---------------- passes ---------------- */

function soonestPass() {
  const now = Date.now();
  return Object.values(syn.brain.s.passes).filter((p) => p.expiresAt > now).sort((a, b) => a.expiresAt - b.expiresAt)[0] ?? null;
}
function passView() { const p = soonestPass(); return p ? { name: siteName(p.site), expiresAt: p.expiresAt } : null; }

function pushConfig() {
  const passes: Record<string, number> = {};
  for (const p of Object.values(syn.brain.s.passes)) passes[p.site] = p.expiresAt;
  bridge.config(syn.brain.s.settings.distractions, passes);
}

function schedulePass(site: string) {
  const p = syn.brain.activePass(site);
  clearTimeout(passTimers.get(site));
  if (!p) return;
  passTimers.set(site, setTimeout(() => expirePass(site), Math.max(0, p.expiresAt - Date.now())));
}

function expirePass(site: string, early = false) {
  clearTimeout(passTimers.get(site)); passTimers.delete(site);
  syn.brain.endPass(site, early ? "ended_early" : "expired");
  pushConfig();
  const focus = syn.brain.currentFocus();
  notice(early ? `Done with ${siteName(site)}. Good.` : `That's your time on ${siteName(site)}.${focus ? ` Back to ${focus.text}.` : " Back to it."}`, 4000);
  setTimeout(() => closeSite(site), early ? 600 : 3000);
  layout();
}

/* ---------------- the gate ---------------- */

function tabsOf(site: string) {
  return [...bridge.tabs.values()].filter((t) => { try { const h = new URL(t.url).hostname.replace(/^www\./, ""); return h === site || h.endsWith("." + site); } catch { return false; } }).map((t) => t.tabId);
}

function onTab(t: TabInfo) {
  let host = "";
  try { host = new URL(t.url).hostname; } catch { return; }
  const site = syn.brain.matchDistraction(host);
  const looking = t.active && t.focused;

  if (!site) {
    // They left for something else while being asked — that's walking away, and it counts.
    if (gate && looking && !gate.judging) {
      clearTimeout(gate.backstop);
      syn.brain.logGate({ site: gate.site, kind: "walked_away" });
      const name = siteName(gate.site);
      gate = null;
      notice(`Good call. ${name} can wait.`, 2500);
    }
    return;
  }
  if (syn.brain.activePass(site)) { bridge.release([t.tabId]); return; }
  bridge.hold([t.tabId]);
  if (looking && !gate) startGate(site, t.title, "helper");
}

function startGate(site: string, pageTitle: string | undefined, via: Gate["via"], target?: Foreground) {
  log(`gate open: ${site} via ${via}${pageTitle ? ` — "${pageTitle.slice(0, 80)}"` : ""}`);
  // Main owns a backstop deadline (the orb's own clock normally fires first). It allows a short
  // grace for the card to appear, and pauses while Synapse is thinking.
  gate = { site, transcript: [], judging: false, via, target, budgetMs: (syn.brain.s.settings.windowSeconds + 3) * 1000, resumedAt: Date.now(), running: false, typingUsedMs: 0 };
  armBackstop();
  syn.brain.logGate({ site, kind: "opened", text: pageTitle?.slice(0, 120) });
  const opener = syn.gateOpener(site);
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
  if (bridge.connected) { bridge.closeSite(site); log(`close ${site}: asked the browser helper`); }
  // The helper only covers the browser it's installed in, so always also handle the window we saw.
  const fg = target ?? await foreground();
  if (!fg || !BROWSERS.test(fg.app)) { if (!bridge.connected) log(`close ${site}: no browser window to close (front app: ${fg?.app ?? "unknown"})`); return; }
  const result = await closeBrowserTab(fg, (now) => siteOf(now) === site, (m) => log(`${site} ${m}`));
  log(`close ${site}: ${result} (${fg.app})`);
  if (result === "minimized") notice(`I couldn't close the ${siteName(site)} tab, so I hid the window.`, 3500);
}

async function argue(text: string) {
  if (!gate || gate.judging) return;
  const g = gate;
  if (g.typingSince != null) { g.typingUsedMs += Date.now() - g.typingSince; g.typingSince = undefined; }
  g.judging = true;
  pauseBackstop();
  const pageTitle = [...bridge.tabs.values()].find((t) => tabsOf(g.site).includes(t.tabId))?.title;
  let v: Awaited<ReturnType<Synapse["judge"]>>;
  try { v = await syn.judge({ site: g.site, argument: text, transcript: g.transcript, pageTitle }); }
  catch (e) {
    log(`gate judge failed: ${String(e).slice(0, 200)}`);
    v = { decision: "deny", minutes: null, reply: "I couldn't think that through. Try once more, briefly.", source: "offline" };
  }
  log(`gate verdict: ${g.site} ${v.decision}${v.minutes ? ` ${v.minutes}m` : ""} (${v.source})`);
  g.transcript.push({ role: "user", text }, { role: "synapse", text: v.reply });
  g.judging = false;
  if (gate !== g) return; // they walked away while I was thinking
  orb.webContents.send("orb", { type: "verdict", ...v });
  if (v.decision === "deny" || v.decision === "ask") armBackstop();
  if (v.decision === "allow" || v.decision === "crisis") clearTimeout(g.backstop);
  if (v.decision === "allow") {
    gate = null;
    schedulePass(g.site);
    pushConfig();
    bridge.release(tabsOf(g.site));
    setTimeout(() => layout("dock"), 2200);
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
  openCard(false);
  orb.webContents.send("orb", { type: "notice", text, ms });
}

function scheduleReachouts() {
  for (const r of syn.brain.s.reachouts) {
    if (reachTimers.has(r.id)) continue;
    reachTimers.set(r.id, setTimeout(() => {
      reachTimers.delete(r.id);
      syn.brain.s.reachouts = syn.brain.s.reachouts.filter((x) => x.id !== r.id);
      syn.brain.addTurn("synapse", r.text, "ask");
      if (!gate) notice(r.text, 9000);
      if (Notification.isSupported()) new Notification({ title: "Synapse", body: r.text, silent: true }).show();
    }, Math.max(1000, r.at - Date.now())));
  }
}

/* ---------------- clarity: ask ---------------- */

async function captureScreen(): Promise<string | null> {
  // macOS needs Screen Recording permission; without it the capture is just the wallpaper.
  if (isMac && systemPreferences.getMediaAccessStatus("screen") !== "granted") {
    screenPermissionMissing = true;
    desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {}); // triggers the system prompt once
    return null;
  }
  screenPermissionMissing = false;
  const prev = orb.getOpacity();
  orb.setOpacity(0);
  await new Promise((r) => setTimeout(r, 120));
  try {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const scale = Math.min(1, 1600 / display.size.width);
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: Math.round(display.size.width * scale), height: Math.round(display.size.height * scale) } });
    const src = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
    return src ? src.thumbnail.toJPEG(72).toString("base64") : null;
  } catch { return null; } finally { orb.setOpacity(prev || 1); }
}

let askPending = false;

async function ask(text: string, share: boolean) {
  const onboarding = !syn.brain.s.profile.onboardedAt;
  askPending = true;
  let r: { text: string; sawScreen: boolean; passChanges?: { site: string; minutes: number }[] };
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
    if (c.minutes > 0) { schedulePass(c.site); bridge.release(tabsOf(c.site)); }
    else { clearTimeout(passTimers.get(c.site)); passTimers.delete(c.site); setTimeout(() => closeSite(c.site), 600); }
  }
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

let watching = false;
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
    const fg = await foreground();
    if (!fg || /synapse|electron/i.test(fg.app)) return;
    const isBrowser = BROWSERS.test(fg.app);
    const tab = isBrowser && helperSeesBrowser() ? bridge.activeTab() : null;

    if (Date.now() - lastObserve >= 5000) {
      lastObserve = Date.now();
      syn.brain.observe({ app: fg.app, title: tab?.title || fg.title, url: tab?.url || fg.url, idleSec: powerMonitor.getSystemIdleTime() });
    }
    if (!isBrowser || helperSeesBrowser()) return;

    const site = siteOf(fg);
    if (gate?.via === "window" && !gate.judging && site !== gate.site) {
      // Same browser, different page now — they switched away on their own.
      clearTimeout(gate.backstop);
      syn.brain.logGate({ site: gate.site, kind: "walked_away" });
      const name = siteName(gate.site);
      gate = null;
      notice(`Good call. ${name} can wait.`, 2500);
      return;
    }
    if (!site || gate || syn.brain.activePass(site)) return;
    startGate(site, fg.title, "window", fg);
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
  settingsWin.on("closed", () => { settingsWin = null; });
}

/* ---------------- IPC ---------------- */

function wireIpc() {
  ipcMain.on("orb:peek", () => { /* peeking is pure CSS now */ });
  ipcMain.on("orb:ignore-mouse", (_e, on: boolean) => { if (mode !== "card") orb.setIgnoreMouseEvents(!!on, { forward: true }); });
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
    callModel: key ? geminiTransport(key) : (c) => relayTransport(process.env.SYNAPSE_RELAY_URL || __RELAY_URL__, installIdHolder.id)(c),
  });
  installIdHolder.id = syn.brain.s.installId;

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
  setInterval(() => { if (mode !== "card" && soonestPass()) orb.webContents.send("orb", { type: "mode", mode, pass: passView() }); }, 1000);

  globalShortcut.register("CommandOrControl+Shift+Space", openAsk);
  if (app.isPackaged && !syn.brain.s.profile.onboardedAt) app.setLoginItemSettings({ openAtLogin: true });
  if (!syn.brain.s.profile.onboardedAt) setTimeout(openAsk, 1800);
});

app.on("second-instance", openAsk);
app.on("window-all-closed", () => { /* keep running in the tray */ });
app.on("before-quit", () => syn?.brain.flush());
