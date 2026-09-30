/* Synapse Orb — background service worker.
 * Owns: settings, timed passes, today's gate log, calls to the Synapse server, tab closing,
 * screenshots, and check-in notifications. Content scripts never talk to the network directly
 * (a content script's fetch would be subject to the page's CORS rules; this worker's is not). */

const DEFAULTS = {
  serverUrl: "http://localhost:3000",
  sites: ["youtube.com", "reddit.com", "x.com", "twitter.com", "instagram.com", "tiktok.com", "facebook.com", "netflix.com", "twitch.tv"],
  goals: "",
  windowSeconds: 15,
  maxMinutes: 30,
  orbEverywhere: true,
  shareScreenDefault: false,
};

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(settings || {}) };
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings) await chrome.storage.local.set({ settings: DEFAULTS });
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-orb") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "synapse:toggle" }).catch(() => {});
});

/* ---------- helpers ---------- */

function matchSite(hostname, sites) {
  const h = (hostname || "").toLowerCase().replace(/^www\./, "");
  return sites.find((s) => { s = s.toLowerCase().trim(); return s && (h === s || h.endsWith("." + s)); }) || null;
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function getLog() {
  const { log } = await chrome.storage.local.get("log");
  const today = dayKey();
  if (!log || log.day !== today) return { day: today, events: [] };
  return log;
}

async function addEvent(ev) {
  const log = await getLog();
  log.events.push({ ts: Date.now(), ...ev });
  if (log.events.length > 300) log.events = log.events.slice(-300);
  await chrome.storage.local.set({ log });
}

async function todaySummary() {
  const log = await getLog();
  const passes = log.events.filter((e) => e.kind === "pass");
  const denials = log.events.filter((e) => e.kind === "deny" || e.kind === "timeout").length;
  const minutes = passes.reduce((a, e) => a + (e.minutes || 0), 0);
  return { passes: passes.length, minutes, denials, recent: passes.map((e) => `${e.site}: ${e.reason}`.slice(0, 160)) };
}

async function getPasses() {
  const { passes } = await chrome.storage.local.get("passes");
  const now = Date.now();
  const live = {};
  for (const [k, v] of Object.entries(passes || {})) if (v.expiresAt > now) live[k] = v;
  return live;
}

function localTime() {
  return new Date().toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

async function post(path, body, timeoutMs = 20000) {
  const { serverUrl } = await getSettings();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(serverUrl.replace(/\/+$/, "") + path, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null };
  } finally { clearTimeout(t); }
}

/* Strict offline judge — used only when the Synapse server or the AI can't answer.
 * It never opens the gate for a vague reason: it needs a real reason AND a number of minutes. */
function offlineJudge(argument, maxMinutes, today) {
  const a = argument.toLowerCase();
  const words = a.split(/\s+/).filter(Boolean).length;
  const reason = /(exhaust|tired|fried|burn(t|ed) out|break|been (working|studying)|worked|studied|hours|lecture|tutorial|assignment|homework|class|course|teacher|for school|need to watch|research)/.test(a);
  const dur = a.match(/(\d{1,3})\s*(m\b|min|mins|minute|minutes)/);
  const cap = Math.min(15, maxMinutes);
  if (today.passes >= 3) return { decision: "deny", minutes: null, reply: "Offline mode, and you've already had 3 passes today. Not this time." };
  if (words < 10 || !reason) return { decision: "deny", minutes: null, reply: "Offline mode: I need a real reason — what you've been doing and why you need this site." };
  if (!dur) return { decision: "ask", minutes: null, reply: "Offline mode: how many minutes, exactly?" };
  const m = Math.max(1, Math.min(cap, parseInt(dur[1], 10)));
  return { decision: "allow", minutes: m, reply: `Offline mode: ${m} minutes${m < parseInt(dur[1], 10) ? ` (offline cap is ${cap})` : ""}. Timer's running.` };
}

async function grantPass(site, minutes, reason) {
  const passes = await getPasses();
  const expiresAt = Date.now() + minutes * 60_000;
  passes[site] = { expiresAt, minutes, reason, grantedAt: Date.now() };
  await chrome.storage.local.set({ passes });
  chrome.alarms.create(`pass:${site}`, { when: expiresAt });
  await addEvent({ kind: "pass", site, minutes, reason: reason.slice(0, 200) });
  return passes[site];
}

async function closeSiteTabs(site) {
  const tabs = await chrome.tabs.query({});
  const ids = tabs.filter((t) => { try { return matchSite(new URL(t.url || "").hostname, [site]); } catch { return false; } }).map((t) => t.id);
  if (ids.length) await chrome.tabs.remove(ids).catch(() => {});
}

async function expirePass(site) {
  const { passes } = await chrome.storage.local.get("passes");
  if (passes?.[site]) { delete passes[site]; await chrome.storage.local.set({ passes }); }
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    try { if (matchSite(new URL(t.url || "").hostname, [site])) chrome.tabs.sendMessage(t.id, { type: "synapse:expired", site }).catch(() => {}); } catch {}
  }
  setTimeout(() => closeSiteTabs(site), 4000);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("pass:")) {
    const site = alarm.name.slice(5);
    const { passes } = await chrome.storage.local.get("passes");
    const p = passes?.[site];
    if (p && p.expiresAt <= Date.now() + 1000) await expirePass(site);
  } else if (alarm.name.startsWith("reach:")) {
    const { reachouts } = await chrome.storage.local.get("reachouts");
    const r = reachouts?.[alarm.name];
    if (r) {
      chrome.notifications.create(alarm.name, { type: "basic", iconUrl: "icons/orb-128.png", title: "Synapse", message: r.text, priority: 1 });
      delete reachouts[alarm.name];
      await chrome.storage.local.set({ reachouts });
    }
  }
});

/* ---------- messages from content scripts / options ---------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});

async function handle(msg, sender) {
  const settings = await getSettings();

  if (msg.type === "synapse:status") {
    let host = "";
    try { host = new URL(msg.url).hostname; } catch {}
    const site = matchSite(host, settings.sites);
    const passes = await getPasses();
    return {
      site,
      pass: site ? passes[site] || null : null,
      windowSeconds: Math.max(5, Math.min(120, Number(settings.windowSeconds) || 15)),
      orbEverywhere: settings.orbEverywhere,
      shareScreenDefault: settings.shareScreenDefault,
      isSynapseServer: (() => { try { return new URL(settings.serverUrl).host === new URL(msg.url).host; } catch { return false; } })(),
    };
  }

  if (msg.type === "synapse:argue") {
    const today = await todaySummary();
    const body = {
      site: msg.site, pageTitle: msg.pageTitle, argument: msg.argument, transcript: msg.transcript || [],
      goals: settings.goals, today, maxMinutes: settings.maxMinutes, localTime: localTime(),
    };
    const r = await post("/api/extension/gate", body, 12000);
    let verdict = r.ok && r.data?.decision ? r.data : null;
    let offline = false;
    if (!verdict) { verdict = offlineJudge(msg.argument, settings.maxMinutes, today); offline = true; }
    if (verdict.decision === "allow") {
      const pass = await grantPass(msg.site, verdict.minutes, msg.argument);
      return { ...verdict, pass, offline };
    }
    if (verdict.decision === "deny") await addEvent({ kind: "deny", site: msg.site, reason: msg.argument.slice(0, 200) });
    return { ...verdict, offline };
  }

  if (msg.type === "synapse:timeout") {
    await addEvent({ kind: "timeout", site: msg.site });
    if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id).catch(() => {});
    return { ok: true };
  }

  if (msg.type === "synapse:leave") {
    await addEvent({ kind: "left", site: msg.site });
    if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id).catch(() => {});
    return { ok: true };
  }

  if (msg.type === "synapse:endPass") {
    // They closed their pass early (or the in-page timer hit zero first).
    await expirePass(msg.site);
    return { ok: true };
  }

  if (msg.type === "synapse:capture") {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "jpeg", quality: 70 });
      return { dataUrl };
    } catch (e) { return { error: String(e) }; }
  }

  if (msg.type === "synapse:chat") {
    const today = await todaySummary();
    const gateSummary = `${today.passes} passes (${today.minutes} min), ${today.denials} denied or timed out.` +
      (today.recent.length ? ` Reasons given: ${today.recent.slice(-4).join(" / ")}` : "");
    const r = await post("/api/extension/chat", {
      message: msg.message, history: msg.history || [], goals: settings.goals,
      page: { title: sender.tab?.title, url: sender.tab?.url }, screenshot: msg.screenshot || undefined,
      gateSummary, localTime: localTime(),
    }, 55000);
    if (!r.ok || !r.data?.content) {
      return { content: r.status === 0
        ? `I can't reach the Synapse server at ${settings.serverUrl}. Is it running? (Settings → Server URL)`
        : "Something went wrong on my side. Try again in a moment." };
    }
    for (const ro of r.data.reachouts || []) {
      const name = `reach:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
      const { reachouts } = await chrome.storage.local.get("reachouts");
      await chrome.storage.local.set({ reachouts: { ...(reachouts || {}), [name]: { text: ro.text } } });
      chrome.alarms.create(name, { delayInMinutes: Math.max(1, ro.minutes) });
    }
    return r.data;
  }

  if (msg.type === "synapse:today") {
    return { today: await todaySummary(), passes: await getPasses(), log: await getLog() };
  }

  if (msg.type === "synapse:ping") {
    const { serverUrl } = settings;
    try {
      const res = await fetch(serverUrl.replace(/\/+$/, "") + "/api/ai-status");
      return { ok: res.ok, data: await res.json().catch(() => null) };
    } catch { return { ok: false }; }
  }

  return { error: "unknown message" };
}
