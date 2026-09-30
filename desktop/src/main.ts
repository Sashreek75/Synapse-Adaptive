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
import { foreground, BROWSERS } from "./foreground";

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

let syn: Synapse;
const bridge = new Bridge();
let orb: BrowserWindow;
let settingsWin: BrowserWindow | null = null;
let tray: Tray;

type Mode = "dock" | "peek" | "card";
let mode: Mode = "dock";
let cardSize = { w: 380, h: 220 };

interface Gate { site: string; transcript: GateTurn[]; judging: boolean }
let gate: Gate | null = null;
const passTimers = new Map<string, NodeJS.Timeout>();
const reachTimers = new Map<string, NodeJS.Timeout>();

const ORB_BOX = 76;       // window size when docked
const DOCK_HIDE = 30;     // px of the docked window tucked past the screen edge

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
    const w = hasPass ? ORB_BOX + 104 : ORB_BOX;
    const tucked = mode === "dock" && !hasPass ? DOCK_HIDE : 0;
    orb.setBounds({ x: wa.x + wa.width - w + tucked, y: orbY() - ORB_BOX / 2, width: w, height: ORB_BOX });
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
  orb.once("ready-to-show", () => { layout("dock"); orb.showInactive(); });
  orb.on("blur", () => { if (mode === "card" && !gate) orb.webContents.send("orb", { type: "blur" }); });
  screen.on("display-metrics-changed", () => layout());
}

function openCard() {
  layout("card");
  orb.show(); orb.moveTop(); orb.focus();
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
  setTimeout(() => bridge.closeSite(site), early ? 600 : 3000);
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
      syn.brain.logGate({ site: gate.site, kind: "walked_away" });
      const name = siteName(gate.site);
      gate = null;
      notice(`Good call. ${name} can wait.`, 2500);
    }
    return;
  }
  if (syn.brain.activePass(site)) { bridge.release([t.tabId]); return; }
  bridge.hold([t.tabId]);
  if (looking && !gate) startGate(site, t.title);
}

function startGate(site: string, pageTitle?: string) {
  gate = { site, transcript: [], judging: false };
  syn.brain.logGate({ site, kind: "opened", text: pageTitle?.slice(0, 120) });
  const opener = syn.gateOpener(site);
  gate.transcript.push({ role: "synapse", text: opener });
  openCard();
  orb.webContents.send("orb", { type: "gate", site, name: siteName(site), opener, seconds: syn.brain.s.settings.windowSeconds });
}

async function argue(text: string) {
  if (!gate || gate.judging) return;
  const g = gate;
  g.judging = true;
  const pageTitle = [...bridge.tabs.values()].find((t) => tabsOf(g.site).includes(t.tabId))?.title;
  const v = await syn.judge({ site: g.site, argument: text, transcript: g.transcript, pageTitle });
  g.transcript.push({ role: "user", text }, { role: "synapse", text: v.reply });
  g.judging = false;
  if (gate !== g) return; // they walked away while I was thinking
  orb.webContents.send("orb", { type: "verdict", ...v });
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
  const site = gate.site;
  syn.brain.logGate({ site, kind: "timeout" });
  gate = null;
  bridge.closeSite(site);
  notice(`Time's up. Closed ${siteName(site)}.`, 2500);
}

function gateLeave() {
  if (!gate) return;
  const site = gate.site;
  syn.brain.logGate({ site, kind: "walked_away" });
  gate = null;
  bridge.closeSite(site);
  notice("Good call.", 1800);
}

/* ---------------- notices + check-ins ---------------- */

function notice(text: string, ms = 4000) {
  openCard();
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

async function ask(text: string, share: boolean) {
  const onboarding = !syn.brain.s.profile.onboardedAt;
  const shot = share ? await captureScreen() : null;
  const r = await syn.ask(text, { screenshot: shot, onboarding });
  scheduleReachouts();
  pushConfig(); // they may have added a distraction by talking
  const note = share && screenPermissionMissing
    ? "\n\n(I couldn't see your screen: allow Synapse under System Settings → Privacy & Security → Screen Recording, then reopen Synapse.)" : "";
  orb.webContents.send("orb", { type: "reply", text: r.text + note, sawScreen: r.sawScreen });
}

function openAsk() {
  if (gate) { openCard(); return; }
  openCard();
  const onboarding = !syn.brain.s.profile.onboardedAt;
  orb.webContents.send("orb", {
    type: "ask", onboarding, share: syn.brain.s.settings.shareScreen,
    prompt: onboarding ? "I'm Synapse. I'll sit here at the edge of your screen. What are you working toward right now?" : null,
  });
}

/* ---------------- background agent ---------------- */

async function sample() {
  const fg = await foreground();
  const idleSec = powerMonitor.getSystemIdleTime();
  if (!fg) return;
  if (/^synapse/i.test(fg.app) || /^electron/i.test(fg.app)) return;
  const tab = BROWSERS.test(fg.app) ? bridge.activeTab() : null;
  syn.brain.observe({ app: fg.app, title: tab?.title || fg.title, url: tab?.url, idleSec });
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
  ipcMain.on("orb:peek", (_e, on: boolean) => { if (mode !== "card") layout(on ? "peek" : "dock"); });
  ipcMain.on("orb:size", (_e, s: { w: number; h: number }) => { cardSize = { w: Math.min(420, Math.max(260, s.w)), h: Math.min(560, Math.max(80, s.h)) }; if (mode === "card") layout("card"); });
  ipcMain.on("orb:open-ask", () => openAsk());
  ipcMain.on("orb:close", () => closeCard());
  ipcMain.handle("orb:ask", (_e, text: string, share: boolean) => ask(String(text).slice(0, 2000), !!share));
  ipcMain.on("orb:set-share", (_e, on: boolean) => { syn.brain.s.settings.shareScreen = !!on; syn.brain.touch(); });
  ipcMain.on("gate:argue", (_e, text: string) => argue(String(text).slice(0, 1200)));
  ipcMain.on("gate:timeout", () => gateTimeout());
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
  setInterval(sample, 5000);
  setInterval(() => { if (mode !== "card") orb.webContents.send("orb", { type: "mode", mode, pass: passView() }); }, 1000);

  globalShortcut.register("CommandOrControl+Shift+Space", openAsk);
  if (app.isPackaged && !syn.brain.s.profile.onboardedAt) app.setLoginItemSettings({ openAtLogin: true });
  if (!syn.brain.s.profile.onboardedAt) setTimeout(openAsk, 1800);
});

app.on("second-instance", openAsk);
app.on("window-all-closed", () => { /* keep running in the tray */ });
app.on("before-quit", () => syn?.brain.flush());
