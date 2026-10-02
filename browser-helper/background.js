/* Synapse Helper — a sensor and an actuator for the Synapse Windows app. Nothing else.
 * It reports which tab you're on, and does what the app tells it: hold a tab behind a veil,
 * release it, or close it. All decisions, all conversation, all UI live in the orb. */

const URL_WS = "ws://127.0.0.1:47821";
let ws = null;
let backoff = 1000;
let config = { distractions: [], passes: {} }; // pushed by the app; used only to veil instantly
const held = new Set();

function send(msg) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); } catch {} }

function connect() {
  try { ws = new WebSocket(URL_WS); } catch { return retry(); }
  ws.onopen = async () => {
    backoff = 1000;
    send({ type: "hello", browser: navigator.userAgent.includes("Edg/") ? "edge" : "chrome" });
    const tabs = await chrome.tabs.query({});
    const [win] = await chrome.windows.getAll({ populate: false }).then((ws) => ws.filter((w) => w.focused));
    for (const t of tabs) report(t, win && t.windowId === win.id);
  };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m); };
  ws.onclose = () => { ws = null; releaseAll(); config = { distractions: [], passes: {} }; retry(); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}
function retry() { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30_000); }

// Keep the service worker (and the socket) alive.
setInterval(() => send({ type: "ping" }), 20_000);

function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }
function matches(url) {
  const h = hostOf(url);
  return config.distractions.find((d) => h === d || h.endsWith("." + d)) || null;
}

function veil(tabId, on) {
  if (on) held.add(tabId); else held.delete(tabId);
  chrome.tabs.sendMessage(tabId, { synapse: on ? "hold" : "release" }).catch(() => {});
}
function releaseAll() { for (const id of [...held]) veil(id, false); }

async function handle(m) {
  if (m.cmd === "config") { config = { distractions: m.distractions || [], passes: m.passes || {} }; return; }
  if (m.cmd === "hold") for (const id of m.tabIds || []) veil(id, true);
  if (m.cmd === "release") for (const id of m.tabIds || []) veil(id, false);
  if (m.cmd === "close") await chrome.tabs.remove(m.tabIds || []).catch(() => {});
  if (m.cmd === "closeSite") {
    const tabs = await chrome.tabs.query({});
    const ids = tabs.filter((t) => { const h = hostOf(t.url || ""); return h === m.site || h.endsWith("." + m.site); }).map((t) => t.id);
    if (ids.length) await chrome.tabs.remove(ids).catch(() => {});
  }
}

async function report(tab, windowFocused) {
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) return;
  // Veil instantly if this looks like a distraction without a pass; the app then decides.
  const site = matches(tab.url);
  if (site && !(config.passes[site] > Date.now() || config.passes['*'] > Date.now())) veil(tab.id, true);
  if (windowFocused === undefined) {
    const w = await chrome.windows.get(tab.windowId).catch(() => null);
    windowFocused = !!w?.focused;
  }
  send({ type: "tab", tabId: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title || "", active: !!tab.active, focused: !!windowFocused });
}

chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.url || info.title || info.status === "loading") report(tab); });
chrome.tabs.onActivated.addListener(async ({ tabId }) => report(await chrome.tabs.get(tabId).catch(() => null)));
chrome.tabs.onRemoved.addListener((tabId) => { held.delete(tabId); send({ type: "closed", tabId }); });
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) { send({ type: "blur" }); return; }
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  report(tab, true);
});

// A page that loads asks whether it's being held (covers the race with the socket).
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg === "synapse:held?") {
    const id = sender.tab?.id;
    const url = sender.tab?.url || "";
    const site = matches(url);
    reply(held.has(id) || (!!site && !(config.passes[site] > Date.now() || config.passes['*'] > Date.now())));
  }
});

connect();
