const DEFAULTS = {
  serverUrl: "http://localhost:3000",
  sites: ["youtube.com", "reddit.com", "x.com", "twitter.com", "instagram.com", "tiktok.com", "facebook.com", "netflix.com", "twitch.tv"],
  goals: "", windowSeconds: 15, maxMinutes: 30, orbEverywhere: true, shareScreenDefault: false,
};
const el = (id) => document.getElementById(id);

async function load() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  el("serverUrl").value = s.serverUrl;
  el("sites").value = s.sites.join("\n");
  el("goals").value = s.goals;
  el("windowSeconds").value = s.windowSeconds;
  el("maxMinutes").value = s.maxMinutes;
  el("orbEverywhere").checked = s.orbEverywhere;
  el("shareScreenDefault").checked = s.shareScreenDefault;
  loadToday();
}

function cleanSite(line) {
  let s = line.trim().toLowerCase();
  if (!s) return "";
  try { if (/^https?:\/\//.test(s)) s = new URL(s).hostname; } catch {}
  return s.replace(/^www\./, "").replace(/\/.*$/, "");
}

async function save() {
  const settings = {
    serverUrl: el("serverUrl").value.trim().replace(/\/+$/, "") || DEFAULTS.serverUrl,
    sites: [...new Set(el("sites").value.split(/\n|,/).map(cleanSite).filter(Boolean))],
    goals: el("goals").value.trim(),
    windowSeconds: Math.max(5, Math.min(120, parseInt(el("windowSeconds").value, 10) || 15)),
    maxMinutes: Math.max(1, Math.min(120, parseInt(el("maxMinutes").value, 10) || 30)),
    orbEverywhere: el("orbEverywhere").checked,
    shareScreenDefault: el("shareScreenDefault").checked,
  };
  await chrome.storage.local.set({ settings });
  el("saved").textContent = "Saved. Reload open tabs for site changes to apply.";
  setTimeout(() => (el("saved").textContent = ""), 4000);
}

async function loadToday() {
  const r = await chrome.runtime.sendMessage({ type: "synapse:today" });
  if (!r?.today) return;
  el("sPasses").textContent = r.today.passes;
  el("sMin").textContent = r.today.minutes;
  el("sDeny").textContent = r.today.denials;
  const label = { pass: "Pass", deny: "Denied", timeout: "Timed out", left: "Walked away" };
  el("events").innerHTML = (r.log.events || []).slice(-8).reverse().map((e) => {
    const t = new Date(e.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const detail = e.kind === "pass" ? ` — ${e.minutes} min: “${e.reason}”` : e.reason ? ` — “${e.reason}”` : "";
    return `<li>${t} · <b>${label[e.kind] || e.kind}</b> on ${e.site}${detail.replace(/</g, "&lt;")}</li>`;
  }).join("");
}

el("save").addEventListener("click", save);
el("test").addEventListener("click", async () => {
  await save();
  el("ping").textContent = "Checking…";
  const r = await chrome.runtime.sendMessage({ type: "synapse:ping" });
  el("ping").textContent = !r?.ok ? "Can't reach the server. Is `npm run dev` running?"
    : r.data?.ok ? `Connected — AI is live (${r.data.model}).`
    : "Server reachable, but the AI isn't answering (check GEMINI_API_KEY). The gate will use strict offline rules.";
});
load();
