/* Synapse Orb — content script.
 * Renders the orb (docked at the right edge), the clarity chat panel, and the distraction gate,
 * all inside a closed shadow root so the page can't restyle or read it. Everything that touches
 * the network, tabs, or storage-of-record goes through the background worker. */
(() => {
  if (window.top !== window || window.__synapseOrb) return;
  window.__synapseOrb = true;

  const send = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r || {}); }); }
    catch { res({}); }
  });
  const store = chrome.storage.local;
  const $ = (sel) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const NAMES = { youtube: "YouTube", tiktok: "TikTok", x: "X", twitter: "Twitter", reddit: "Reddit", instagram: "Instagram", facebook: "Facebook", netflix: "Netflix", twitch: "Twitch", discord: "Discord", pinterest: "Pinterest" };
  const siteName = (s) => { const n = s.split(".")[0]; return NAMES[n] || n.charAt(0).toUpperCase() + n.slice(1); };
  function richText(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .split(/\n/).map((l) => /^\s*[-•*]\s+/.test(l) ? `<div class="li">${l.replace(/^\s*[-•*]\s+/, "")}</div>` : l).join("<br>")
      .replace(/<br><div/g, "<div").replace(/<\/div><br>/g, "</div>");
  }

  /* ---------------- shadow host ---------------- */
  const host = document.createElement("synapse-orb");
  host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  const mount = () => { if (!host.isConnected) (document.documentElement || document).appendChild(host); };

  root.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .orb { position: relative; width: var(--s, 48px); height: var(--s, 48px); border-radius: 50%; isolation: isolate; flex: none;
      box-shadow: 0 10px 30px -12px rgba(11,31,58,.55); }
    .orb i { position: absolute; border-radius: 50%; display: block; }
    .orb .core { inset: 0; background:
        radial-gradient(40% 38% at 32% 26%, rgba(255,255,255,.72), rgba(255,255,255,0) 60%),
        radial-gradient(92% 92% at 70% 82%, rgba(255,150,70,.95) 0%, rgba(249,115,22,.7) 24%, rgba(64,120,168,.7) 55%, #1c405c 82%),
        radial-gradient(120% 120% at 50% 40%, #24557d 0%, #0a2033 100%);
      box-shadow: inset 0 2px 4px rgba(255,255,255,.35), inset 0 -12px 30px rgba(2,9,16,.6), 0 0 22px -2px rgba(249,140,60,.5);
      animation: breathe 7.5s ease-in-out infinite; }
    .orb .bloom { inset: -26%; z-index: -1; filter: blur(12px);
      background: radial-gradient(closest-side, rgba(130,170,210,.42), rgba(249,140,60,.18) 54%, transparent 74%);
      animation: bloom 7.5s ease-in-out infinite; }
    .orb .ring { inset: -9%; opacity: 0; border: 1px solid rgba(249,115,22,.5); }
    .orb[data-state="thinking"] .core, .orb[data-state="thinking"] .bloom { animation-duration: 2.4s; }
    .orb[data-state="thinking"] .ring { animation: ping 2s ease-out infinite; }
    .orb[data-state="urgent"] .core { animation: breathe 1s ease-in-out infinite; }
    .orb[data-state="urgent"] .ring { animation: ping 1s ease-out infinite; }
    @keyframes breathe { 0%,100% { transform: scale(.985); } 50% { transform: scale(1.03); } }
    @keyframes bloom { 0%,100% { opacity: .4; } 50% { opacity: .65; } }
    @keyframes ping { 0% { opacity: .6; transform: scale(.92); } 80%,100% { opacity: 0; transform: scale(1.35); } }
    @media (prefers-reduced-motion: reduce) { .orb i { animation: none !important; } }

    /* dock: hides at the edge, slides out on hover */
    .dock { position: fixed; right: 0; top: 62%; transform: translate(34px, -50%); pointer-events: auto; cursor: pointer;
      display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 30px 0 0 30px;
      transition: transform .35s cubic-bezier(.16,1,.3,1), background .3s; }
    .dock:hover, .dock.out { transform: translate(0, -50%); background: rgba(10,22,38,.72); backdrop-filter: blur(8px); }
    .dock.hidden { display: none; }
    .chip { color: #fff; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; display: none; padding-right: 4px; }
    .dock.pass .chip { display: block; }
    .dock.pass { transform: translate(0, -50%); background: rgba(10,22,38,.78); }

    /* chat panel */
    .panel { position: fixed; right: 14px; bottom: 14px; top: 14px; width: min(390px, calc(100vw - 28px)); pointer-events: auto;
      background: #0b1726; color: #e8eef6; border: 1px solid rgba(124,157,191,.22); border-radius: 18px;
      box-shadow: 0 30px 80px -20px rgba(0,0,0,.6); display: flex; flex-direction: column; overflow: hidden;
      transform: translateX(calc(100% + 30px)); visibility: hidden; transition: transform .4s cubic-bezier(.16,1,.3,1), visibility 0s linear .4s; }
    .panel.open { transform: none; visibility: visible; transition: transform .4s cubic-bezier(.16,1,.3,1), visibility 0s; }
    .head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid rgba(124,157,191,.14); }
    .head .t { font-weight: 650; font-size: 15px; flex: 1; letter-spacing: -.01em; }
    .head .sub { font-size: 11.5px; color: #8aa0b8; font-weight: 450; }
    .x { background: none; border: 0; color: #8aa0b8; font-size: 20px; cursor: pointer; line-height: 1; padding: 4px 6px; border-radius: 8px; }
    .x:hover { background: rgba(255,255,255,.06); color: #fff; }
    .banner { margin: 10px 14px 0; padding: 9px 12px; border-radius: 12px; background: rgba(249,115,22,.12); border: 1px solid rgba(249,115,22,.3);
      font-size: 12.5px; display: none; align-items: center; gap: 8px; }
    .banner.on { display: flex; }
    .banner b { font-variant-numeric: tabular-nums; }
    .banner button { margin-left: auto; }
    .msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .m { max-width: 88%; padding: 10px 13px; border-radius: 14px; font-size: 14px; line-height: 1.5; white-space: normal; word-wrap: break-word; }
    .m.user { align-self: flex-end; background: #1f4a70; border-bottom-right-radius: 4px; }
    .m.synapse { align-self: flex-start; background: #13243a; border: 1px solid rgba(124,157,191,.14); border-bottom-left-radius: 4px; }
    .m .li { padding-left: 14px; position: relative; margin: 2px 0; }
    .m .li::before { content: "•"; position: absolute; left: 2px; color: #f59a4a; }
    .m.note { align-self: center; background: none; color: #7189a3; font-size: 11.5px; padding: 0; }
    .empty { color: #8aa0b8; font-size: 13.5px; line-height: 1.55; padding: 8px 4px; }
    .empty b { color: #e8eef6; }
    .compose { border-top: 1px solid rgba(124,157,191,.14); padding: 10px 12px 12px; }
    .row { display: flex; gap: 8px; align-items: flex-end; }
    textarea { flex: 1; resize: none; min-height: 42px; max-height: 140px; border-radius: 12px; border: 1px solid rgba(124,157,191,.25);
      background: #0f2034; color: #e8eef6; padding: 10px 12px; font-size: 14px; line-height: 1.4; outline: none; }
    textarea:focus { border-color: rgba(249,140,60,.6); }
    .btn { border: 0; border-radius: 11px; padding: 10px 14px; font-size: 13.5px; font-weight: 600; cursor: pointer; background: #f97316; color: #fff; }
    .btn:disabled { opacity: .5; cursor: default; }
    .btn.ghost { background: rgba(255,255,255,.07); color: #c8d6e5; }
    .btn.sm { padding: 6px 10px; font-size: 12px; border-radius: 9px; }
    .share { display: flex; align-items: center; gap: 7px; margin-top: 8px; font-size: 12px; color: #8aa0b8; cursor: pointer; user-select: none; }
    .share input { accent-color: #f97316; margin: 0; }

    /* the gate */
    .gate { position: fixed; inset: 0; pointer-events: auto; display: none; align-items: center; justify-content: center;
      background: rgba(4,10,18,.82); backdrop-filter: blur(18px) saturate(.6); color: #e8eef6; }
    .gate.on { display: flex; }
    .card { width: min(520px, calc(100vw - 32px)); text-align: center; }
    .ringwrap { position: relative; width: 132px; height: 132px; margin: 0 auto 18px; display: grid; place-items: center; }
    .ringwrap svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    .ringwrap circle { fill: none; stroke-width: 4; }
    .ringwrap .track { stroke: rgba(124,157,191,.18); }
    .ringwrap .prog { stroke: #f97316; stroke-linecap: round; transition: stroke-dashoffset .1s linear; }
    .count { position: absolute; bottom: -4px; right: -4px; min-width: 38px; height: 38px; border-radius: 19px; background: #0b1726;
      border: 1px solid rgba(249,115,22,.5); display: grid; place-items: center; font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; padding: 0 6px; }
    h1 { font-size: 26px; margin: 0 0 6px; font-weight: 700; letter-spacing: -.02em; }
    .lede { color: #8aa0b8; font-size: 14px; margin: 0 0 18px; }
    .gmsgs { display: flex; flex-direction: column; gap: 8px; text-align: left; margin-bottom: 12px; max-height: 34vh; overflow-y: auto; }
    .gate textarea { width: 100%; min-height: 64px; font-size: 15px; }
    .actions { display: flex; gap: 8px; justify-content: space-between; margin-top: 10px; }
    .tag { font-size: 11px; color: #7189a3; margin-top: 12px; }
    .big { font-size: 34px; font-weight: 750; font-variant-numeric: tabular-nums; margin: 6px 0; }
  </style>

  <div class="dock hidden" title="Synapse (Alt+Shift+S)">
    <div class="orb" style="--s:44px"><i class="bloom"></i><i class="ring"></i><i class="core"></i></div>
    <span class="chip"></span>
  </div>

  <section class="panel" aria-label="Synapse">
    <div class="head">
      <div class="orb" id="panelOrb" style="--s:30px"><i class="bloom"></i><i class="ring"></i><i class="core"></i></div>
      <div class="t">Synapse<div class="sub">Clarity, right where you're working</div></div>
      <button class="x" id="clear" title="Clear conversation" style="font-size:13px">Clear</button>
      <button class="x" id="close" title="Close">×</button>
    </div>
    <div class="banner" id="banner"><span>Pass on <span id="bSite"></span>: <b id="bTime"></b> left</span>
      <button class="btn ghost sm" id="endPass">I'm done</button></div>
    <div class="msgs" id="msgs"></div>
    <div class="compose">
      <div class="row"><textarea id="input" rows="1" placeholder="Ask Synapse anything…"></textarea><button class="btn" id="sendBtn">Send</button></div>
      <label class="share"><input type="checkbox" id="share"> Let Synapse see this tab when I send</label>
    </div>
  </section>

  <div class="gate" id="gate" role="dialog" aria-modal="true">
    <div class="card" id="gateCard"></div>
  </div>`;

  const dock = $(".dock"), chip = $(".chip"), dockOrb = dock.querySelector(".orb");
  const panel = $(".panel"), msgsEl = $("#msgs"), input = $("#input"), sendBtn = $("#sendBtn"), shareBox = $("#share");
  const gateEl = $("#gate"), gateCard = $("#gateCard"), panelOrb = $("#panelOrb");

  /* Keep the page from treating our typing as its own shortcuts (e.g. YouTube's "k", space, "f").
   * We register at document_start, so these capture listeners run before the page's own. Typing
   * still works: inserting characters is the browser's default action, not a listener. */
  let enterHandler = null;
  for (const type of ["keydown", "keyup", "keypress"]) {
    window.addEventListener(type, (e) => {
      if (e.target !== host) return;
      e.stopImmediatePropagation();
      if (type === "keydown" && e.key === "Enter" && !e.shiftKey && enterHandler) {
        const el = root.activeElement;
        if (el && el.tagName === "TEXTAREA") { e.preventDefault(); enterHandler(el); }
      }
    }, true);
  }
  enterHandler = (el) => { if (el === input) sendChat(); else if (el.id === "gateInput") argue(); };

  /* ---------------- state ---------------- */
  let status = {};
  let passTimer = null;
  let history = [];

  async function init() {
    mount();
    setInterval(mount, 2000);
    status = await send({ type: "synapse:status", url: location.href });
    if (status.isSynapseServer) return; // the website has its own orb
    const { chat, shareScreen } = await store.get(["chat", "shareScreen"]);
    history = Array.isArray(chat) ? chat : [];
    shareBox.checked = shareScreen ?? !!status.shareScreenDefault;
    if (status.orbEverywhere || status.site) dock.classList.remove("hidden");
    renderMsgs();
    if (status.site) {
      if (status.pass) startPass(status.pass);
      else openGate();
    }
  }

  /* ---------------- dock + panel ---------------- */
  dock.addEventListener("click", () => togglePanel(true));
  $("#close").addEventListener("click", () => togglePanel(false));
  $("#clear").addEventListener("click", async () => { history = []; await store.set({ chat: [] }); renderMsgs(); });
  sendBtn.addEventListener("click", () => sendChat());
  shareBox.addEventListener("change", () => store.set({ shareScreen: shareBox.checked }));
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(140, input.scrollHeight) + "px"; });
  $("#endPass").addEventListener("click", () => { if (status.site) send({ type: "synapse:endPass", site: status.site }); });

  function togglePanel(open) {
    if (open == null) open = !panel.classList.contains("open");
    panel.classList.toggle("open", open);
    dock.style.visibility = open ? "hidden" : "";
    if (open) { dock.classList.remove("hidden"); setTimeout(() => input.focus(), 250); msgsEl.scrollTop = msgsEl.scrollHeight; }
  }

  function renderMsgs() {
    if (!history.length) {
      msgsEl.innerHTML = `<div class="empty"><b>I'm here when you need to think something through.</b><br><br>
        Ask about what's in front of you — switch on <b>Let Synapse see this tab</b> and I'll look at it with you.
        Try: “I'm doubting whether this idea is worth committing to. Based on my goals, what should I do?”</div>`;
      return;
    }
    msgsEl.innerHTML = history.map((m) =>
      `<div class="m ${m.role}">${m.role === "synapse" ? richText(m.text) : esc(m.text)}${m.saw ? `<div class="m note" style="margin-top:4px;text-align:left">looked at your tab</div>` : ""}</div>`).join("");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.chat && Array.isArray(changes.chat.newValue)) { history = changes.chat.newValue; renderMsgs(); }
    if (changes.passes && status.site) {
      const p = (changes.passes.newValue || {})[status.site];
      if (p && p.expiresAt > Date.now() && gateOpen) { closeGate(); startPass(p); }
      if (!p && passTimer) showExpired();
    }
  });

  let chatBusy = false;
  async function capture() {
    const prev = host.style.visibility;
    host.style.visibility = "hidden";
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));
    const r = await send({ type: "synapse:capture" });
    host.style.visibility = prev;
    return r.dataUrl || null;
  }

  async function sendChat() {
    const text = input.value.trim();
    if (!text || chatBusy) return;
    chatBusy = true; sendBtn.disabled = true; input.value = ""; input.style.height = "";
    const priorHistory = history.slice(-10);
    history = [...history, { role: "user", text }];
    renderMsgs();
    let screenshot = null;
    if (shareBox.checked) screenshot = await capture();
    panelOrb.dataset.state = "thinking";
    msgsEl.insertAdjacentHTML("beforeend", `<div class="m note" id="thinking">thinking…</div>`);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    const r = await send({ type: "synapse:chat", message: text, history: priorHistory, screenshot });
    panelOrb.dataset.state = "";
    history = [...history, { role: "synapse", text: r.content || "I couldn't answer that just now.", saw: !!r.sawScreen }].slice(-40);
    await store.set({ chat: history });
    renderMsgs();
    chatBusy = false; sendBtn.disabled = false; input.focus();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "synapse:toggle") { dock.classList.remove("hidden"); togglePanel(); }
    if (msg.type === "synapse:expired" && msg.site === status.site) showExpired();
  });

  /* ---------------- the gate ---------------- */
  let gateOpen = false, remaining = 0, total = 0, pending = false, transcript = [], lastTick = 0, gateLoop = null, mediaLoop = null, finished = false;
  const blockPlay = (e) => { if (gateOpen && e.target && e.target.pause) e.target.pause(); };

  function pauseMedia() { document.querySelectorAll("video, audio").forEach((m) => { try { if (!m.paused) m.pause(); } catch {} }); }

  function openGate() {
    gateOpen = true; finished = false; pending = false; transcript = [];
    total = remaining = (status.windowSeconds || 15) * 1000;
    togglePanel(false);
    document.documentElement.style.setProperty("overflow", "hidden", "important");
    document.addEventListener("play", blockPlay, true);
    pauseMedia();
    mediaLoop = setInterval(pauseMedia, 250);
    const name = siteName(status.site);
    gateCard.innerHTML = `
      <div class="ringwrap">
        <svg viewBox="0 0 132 132"><circle class="track" cx="66" cy="66" r="62"/><circle class="prog" id="prog" cx="66" cy="66" r="62" stroke-dasharray="389.6" stroke-dashoffset="0"/></svg>
        <div class="orb" id="gateOrb" style="--s:96px"><i class="bloom"></i><i class="ring"></i><i class="core"></i></div>
        <div class="count" id="count">${Math.ceil(remaining / 1000)}</div>
      </div>
      <h1>${esc(name)}? Make your case.</h1>
      <p class="lede">You've got ${status.windowSeconds || 15} seconds to convince me. The clock stops while I think.</p>
      <div class="gmsgs" id="gmsgs"></div>
      <textarea id="gateInput" placeholder="Why do you need ${esc(name)} right now, and for how long?"></textarea>
      <div class="actions">
        <button class="btn ghost" id="leave">Never mind, close it</button>
        <button class="btn" id="argueBtn">Convince me</button>
      </div>
      <div class="tag" id="gtag"></div>`;
    gateEl.classList.add("on");
    root.getElementById("argueBtn").addEventListener("click", argue);
    root.getElementById("leave").addEventListener("click", () => { finished = true; send({ type: "synapse:leave", site: status.site }); });
    const gi = root.getElementById("gateInput");
    setTimeout(() => gi.focus(), 50);
    lastTick = performance.now();
    gateLoop = setInterval(tick, 100);
  }

  function tick() {
    const now = performance.now(), dt = now - lastTick; lastTick = now;
    if (!gateOpen || finished) return;
    // Clock only runs while they can actually see the gate and aren't waiting on me.
    if (pending || document.hidden) return;
    remaining -= dt;
    const c = root.getElementById("count"), p = root.getElementById("prog"), o = root.getElementById("gateOrb");
    if (c) c.textContent = Math.max(0, Math.ceil(remaining / 1000));
    if (p) p.setAttribute("stroke-dashoffset", String(389.6 * (1 - Math.max(0, remaining) / total)));
    if (o) o.dataset.state = remaining < 5000 ? "urgent" : "";
    if (remaining <= 0) timeUp();
  }

  function addGateMsg(role, text) {
    const g = root.getElementById("gmsgs");
    if (!g) return;
    g.insertAdjacentHTML("beforeend", `<div class="m ${role}">${esc(text)}</div>`);
    g.scrollTop = g.scrollHeight;
  }

  async function argue() {
    const gi = root.getElementById("gateInput");
    const text = gi?.value.trim();
    if (!text || pending || finished) return;
    gi.value = "";
    addGateMsg("user", text);
    pending = true;
    const btn = root.getElementById("argueBtn"); btn.disabled = true; btn.textContent = "Thinking…";
    const o = root.getElementById("gateOrb"); if (o) o.dataset.state = "thinking";
    const r = await send({ type: "synapse:argue", site: status.site, pageTitle: document.title, argument: text, transcript });
    transcript.push({ role: "user", text }, { role: "synapse", text: r.reply || "" });
    pending = false; btn.disabled = false; btn.textContent = "Convince me";
    if (o) o.dataset.state = "";
    if (r.offline) root.getElementById("gtag").textContent = "Synapse server unreachable — using strict offline rules.";
    if (finished) return;

    if (r.decision === "allow" && r.pass) {
      finished = true;
      gateCard.innerHTML = `
        <div class="orb" style="--s:84px;margin:0 auto 14px"><i class="bloom"></i><i class="ring"></i><i class="core"></i></div>
        <div class="big">${r.minutes}:00</div>
        <p class="lede" style="margin-bottom:0">${esc(r.reply)}</p>`;
      setTimeout(() => { closeGate(); startPass(r.pass); }, 2200);
    } else if (r.decision === "crisis") {
      finished = true;
      gateCard.innerHTML = `<p class="lede" style="color:#e8eef6;font-size:15px;line-height:1.6;white-space:pre-line;text-align:left">${esc(r.reply)}</p>
        <div class="actions"><button class="btn ghost" id="leave2">Close this tab</button><button class="btn" id="cont">Continue</button></div>`;
      root.getElementById("leave2").addEventListener("click", () => send({ type: "synapse:leave", site: status.site }));
      root.getElementById("cont").addEventListener("click", closeGate);
    } else {
      addGateMsg("synapse", r.reply || "Not convinced.");
      gi.focus();
    }
  }

  function timeUp() {
    finished = true;
    gateCard.innerHTML = `
      <div class="orb" style="--s:84px;margin:0 auto 14px"><i class="bloom"></i><i class="core"></i></div>
      <h1>Time's up.</h1><p class="lede">Not convinced. Closing ${esc(siteName(status.site))}.</p>`;
    setTimeout(() => send({ type: "synapse:timeout", site: status.site }), 1300);
  }

  function closeGate() {
    gateOpen = false;
    clearInterval(gateLoop); clearInterval(mediaLoop);
    document.removeEventListener("play", blockPlay, true);
    document.documentElement.style.removeProperty("overflow");
    gateEl.classList.remove("on");
  }

  /* ---------------- timed pass ---------------- */
  function startPass(pass) {
    dock.classList.remove("hidden");
    dock.classList.add("pass");
    const banner = $("#banner");
    banner.classList.add("on");
    $("#bSite").textContent = siteName(status.site);
    const update = () => {
      const left = pass.expiresAt - Date.now();
      chip.textContent = fmt(left);
      $("#bTime").textContent = fmt(left);
      dockOrb.dataset.state = left < 60_000 ? "urgent" : "";
      if (left <= 0) { send({ type: "synapse:endPass", site: status.site }); showExpired(); }
    };
    clearInterval(passTimer);
    passTimer = setInterval(update, 500);
    update();
  }

  function showExpired() {
    if (!passTimer && gateOpen) return;
    clearInterval(passTimer); passTimer = null;
    dock.classList.remove("pass"); $("#banner").classList.remove("on");
    togglePanel(false);
    pauseMedia();
    gateOpen = true; finished = true;
    document.documentElement.style.setProperty("overflow", "hidden", "important");
    gateCard.innerHTML = `
      <div class="orb" style="--s:84px;margin:0 auto 14px"><i class="bloom"></i><i class="core"></i></div>
      <h1>That's your time.</h1><p class="lede">Back to what matters. Closing ${esc(siteName(status.site))}.</p>`;
    gateEl.classList.add("on");
  }

  if (document.documentElement) init();
  else document.addEventListener("readystatechange", init, { once: true });
})();
