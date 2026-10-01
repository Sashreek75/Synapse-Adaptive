/* The orb. One small window, three shapes: docked at the edge, peeking on hover, or expanded
 * into a compact card when Synapse has something to say or you click it. Never a chat app. */
const S = window.synapse;
const $ = (id) => document.getElementById(id);
const dock = $("dock"), chip = $("chip"), dockOrb = $("dockOrb");
const card = $("card"), body = $("body"), compose = $("compose"), input = $("input"), actions = $("actions"), hint = $("hint");
const cardOrb = $("cardOrb"), count = $("count"), barFill = $("barFill"), eye = $("eye"), sendBtn = $("send");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function rich(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split("\n")
    .map((l) => /^\s*[-•*]\s+/.test(l) ? `<div class="li">${l.replace(/^\s*[-•*]\s+/, "")}</div>` : l ? `<div>${l}</div>` : "").join("");
}
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

let view = "dock";          // dock | gate | ask | notice
let pass = null;
let share = true;
let busy = false;
let noticeTimer = null;

/* ---------- sizing: the window hugs the card ---------- */
new ResizeObserver(() => { if (!card.hidden) { const r = card.getBoundingClientRect(); S.size(Math.ceil(r.width), Math.ceil(r.height)); } }).observe(card);

/* ---------- dock ---------- */
dock.addEventListener("mouseenter", () => S.peek(true));
dock.addEventListener("mouseleave", () => S.peek(false));
dock.addEventListener("click", () => S.openAsk());

function renderDock(p) {
  pass = p;
  chip.hidden = !p;
  if (p) {
    const left = p.expiresAt - Date.now();
    chip.textContent = `${p.name} ${fmt(left)}`;
    dockOrb.dataset.state = left < 60_000 ? "urgent" : "";
  } else dockOrb.dataset.state = "";
}

function showCard(kind) {
  view = kind;
  clearTimeout(noticeTimer);
  dock.hidden = true;
  card.hidden = false;
  body.innerHTML = "";
  compose.hidden = actions.hidden = hint.hidden = count.hidden = eye.hidden = true;
  barFill.style.width = "0";
  cardOrb.dataset.state = "";
  input.value = ""; input.style.height = "";
}
function hideCard() {
  stopClock();
  view = "dock";
  card.hidden = true;
  dock.hidden = false;
  S.close();
}

function say(html, cls = "say") { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(110, input.scrollHeight) + "px"; input.style.overflowY = input.scrollHeight > 110 ? "auto" : "hidden"; }
input.addEventListener("input", autoGrow);

/* ---------- gate ---------- */
let clock = null, total = 0, remaining = 0, last = 0, started = false, paused = false, startTimer = null;

function startClock() {
  if (started) return;
  started = true; last = performance.now();
  clock = setInterval(() => {
    const t = performance.now(), dt = t - last; last = t;
    if (paused) return;
    remaining -= dt;
    count.textContent = Math.max(0, Math.ceil(remaining / 1000));
    barFill.style.width = `${100 * (1 - Math.max(0, remaining) / total)}%`;
    cardOrb.dataset.state = remaining < 5000 ? "urgent" : cardOrb.dataset.state === "thinking" ? "thinking" : "";
    if (remaining <= 0) { stopClock(); lockGate(); say("Time's up.", "say"); S.timeout(); }
  }, 100);
}
function stopClock() { clearInterval(clock); clearTimeout(startTimer); clock = null; started = false; }
function lockGate() { input.disabled = true; sendBtn.disabled = true; }

function openGate(m) {
  showCard("gate");
  total = remaining = (m.seconds || 15) * 1000;
  paused = false; started = false;
  count.hidden = false; count.textContent = m.seconds || 15;
  say(esc(m.opener));
  compose.hidden = actions.hidden = hint.hidden = false;
  input.disabled = false; sendBtn.disabled = false; sendBtn.textContent = "Make my case";
  input.placeholder = `Why do you need ${m.name}, and for how long?`;
  hint.textContent = "Enter to send · the clock stops while I think";
  setTimeout(() => input.focus(), 30);
  // The clock starts when you start answering — or after a moment regardless.
  startTimer = setTimeout(startClock, 2500);
}
input.addEventListener("focus", () => { if (view === "gate") startClock(); });

function argue() {
  const text = input.value.trim();
  if (!text || busy || view !== "gate" || input.disabled) return;
  busy = true; paused = true;
  say(esc(text), "me");
  input.value = ""; autoGrow();
  sendBtn.disabled = true; sendBtn.textContent = "Thinking…";
  cardOrb.dataset.state = "thinking";
  S.argue(text);
}

function onVerdict(v) {
  busy = false; paused = false;
  cardOrb.dataset.state = "";
  sendBtn.disabled = false; sendBtn.textContent = "Make my case";
  if (v.decision === "allow") {
    stopClock(); lockGate();
    compose.hidden = actions.hidden = hint.hidden = count.hidden = true;
    barFill.style.width = "0";
    say(`${v.minutes}:00`, "big");
    say(esc(v.reply));
  } else if (v.decision === "crisis") {
    stopClock();
    compose.hidden = hint.hidden = count.hidden = true;
    say(rich(v.reply));
    actions.hidden = false; $("leave").hidden = true; sendBtn.textContent = "Okay";
    sendBtn.onclick = () => { sendBtn.onclick = null; $("leave").hidden = false; hideCard(); };
  } else {
    say(esc(v.reply));
    if (v.source === "offline") say("I can't reach my full reasoning right now, so I'm being extra strict.", "muted");
    input.focus();
  }
}

/* ---------- ask ---------- */
function setEye(on) { share = on; eye.classList.toggle("on", on); eye.title = on ? "Synapse will look at your screen when you send (click to turn off)" : "Synapse won't look at your screen (click to turn on)"; }
eye.addEventListener("click", () => { setEye(!share); S.setShare(share); });

function openAsk(m) {
  showCard("ask");
  eye.hidden = false; setEye(m.share);
  if (m.prompt) say(esc(m.prompt));
  compose.hidden = false; hint.hidden = false;
  input.disabled = false;
  input.placeholder = m.onboarding ? "The goals and deadlines on your plate…" : "What's on your mind?";
  hint.textContent = "Enter to send · Esc to close";
  setTimeout(() => input.focus(), 30);
}

async function sendAsk() {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  body.innerHTML = "";
  say(esc(text), "me");
  input.value = ""; autoGrow(); input.disabled = true;
  cardOrb.dataset.state = "thinking";
  hint.textContent = share ? "Looking at your screen…" : "Thinking…";
  await S.ask(text, share);
}
function onReply(m) {
  busy = false;
  cardOrb.dataset.state = "";
  say(rich(m.text));
  if (m.sawScreen) say("looked at your screen", "muted");
  input.disabled = false; input.placeholder = "Reply…"; input.focus();
  hint.textContent = "Enter to send · Esc to close";
}

/* ---------- notice ---------- */
function showNotice(m) {
  showCard("notice");
  say(esc(m.text));
  noticeTimer = setTimeout(hideCard, m.ms || 4000);
}
card.addEventListener("click", () => { if (view === "notice") hideCard(); });

/* ---------- keys + buttons ---------- */
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); view === "gate" ? argue() : sendAsk(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && view !== "gate") hideCard(); });
sendBtn.addEventListener("click", () => { if (!sendBtn.onclick) argue(); });
$("leave").addEventListener("click", () => { stopClock(); lockGate(); S.leave(); });
$("x").addEventListener("click", () => { if (view === "gate") { stopClock(); lockGate(); S.leave(); } else hideCard(); });

/* ---------- messages from the app ---------- */
S.on((m) => {
  if (m.type === "mode") { if (m.mode !== "card" && view !== "dock") { card.hidden = true; dock.hidden = false; view = "dock"; } if (view === "dock") renderDock(m.pass); }
  else if (m.type === "gate") openGate(m);
  else if (m.type === "verdict") onVerdict(m);
  else if (m.type === "timeout") { stopClock(); lockGate(); }
  else if (m.type === "ask") openAsk(m);
  else if (m.type === "reply") onReply(m);
  else if (m.type === "notice") showNotice(m);
  else if (m.type === "blur") { if (view === "ask" && !busy && !input.value.trim()) hideCard(); }
});
