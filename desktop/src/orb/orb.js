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
const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

let view = "dock";          // dock | gate | ask | notice
let pass = null;
let share = true;
let busy = false;
let noticeTimer = null;
let draft = "";            // what you'd typed to Synapse but not sent — kept when the card closes
let unread = false;        // a reply arrived while the card was closed
let hideTimer = null;

/* ---------- sizing: the window hugs the card ---------- */
// offsetWidth/Height ignore the open/close scale animation, so the window is never sized to a shrunk card.
new ResizeObserver(() => { if (!card.hidden) S.size(card.offsetWidth, card.offsetHeight); }).observe(card);

/* ---------- dock ---------- */
/* The docked orb sits half-tucked past the screen edge and slides out on hover — all in CSS, so
 * it's smooth. The rest of this small window is click-through, so it never blocks what's behind. */
dock.addEventListener("mouseenter", () => S.peek(true));
dock.addEventListener("mouseleave", () => S.peek(false));
dock.addEventListener("click", () => S.openAsk());
function setUnread(on) { unread = on; dockOrb.classList.toggle("unread", on); }

function renderDock(p) {
  pass = p;
  chip.hidden = !p;

  if (p) {
    const left = p.expiresAt - Date.now();
    chip.textContent = p.paused ? `Paused · ${fmt(left)}` : `${p.name} ${fmt(left)}`;
    dockOrb.dataset.state = !p.paused && left < 60_000 ? "urgent" : "";
  } else dockOrb.dataset.state = "";
  dock.classList.toggle("paused", !!(p && p.paused));
}

function showCard(kind) {
  if (view === "ask" && kind !== "ask" && input.value.trim()) draft = input.value;
  view = kind;
  clearTimeout(noticeTimer); clearTimeout(hideTimer);
  card.classList.remove("leaving");
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
  if (view === "ask") draft = input.value;
  view = "dock";
  // Ease out, then shrink the window back to the orb.
  card.classList.add("leaving");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (view !== "dock") return;          // something reopened it meanwhile
    card.hidden = true; card.classList.remove("leaving");
    dock.hidden = false; dock.classList.add("arrive");
    setTimeout(() => dock.classList.remove("arrive"), 400);
    S.close();
  }, 170);
}

function say(html, cls = "say") { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(110, input.scrollHeight) + "px"; input.style.overflowY = input.scrollHeight > 110 ? "auto" : "hidden"; }
input.addEventListener("input", autoGrow);

/* ---------- gate ---------- */
let clock = null, total = 0, remaining = 0, last = 0, started = false, paused = false, startTimer = null;
// Typing holds the clock: while you're actively writing your case (a key in the last 2.5s), the
// countdown waits. It's capped at 45s per gate so "typing" can't become a way to stall forever.
const TYPE_HOLD = 2500, TYPE_CAP = 45_000;
let lastKey = 0, typingUsed = 0, typingHeld = false;
function setTypingHeld(on) { if (on === typingHeld) return; typingHeld = on; count.classList.toggle("held", on); S.gateTyping(on); }

function startClock() {
  if (started) return;
  started = true; last = performance.now();
  clock = setInterval(() => {
    const t = performance.now(), dt = t - last; last = t;
    if (paused) return;
    const typing = view === "gate" && t - lastKey < TYPE_HOLD && typingUsed < TYPE_CAP && input.value.trim().length > 0;
    setTypingHeld(typing);
    if (typing) { typingUsed += dt; return; }
    remaining -= dt;
    count.textContent = Math.max(0, Math.ceil(remaining / 1000));
    barFill.style.width = `${100 * (1 - Math.max(0, remaining) / total)}%`;
    cardOrb.dataset.state = remaining < 5000 ? "urgent" : cardOrb.dataset.state === "thinking" ? "thinking" : "";
    if (remaining <= 0) { stopClock(); lockGate(); say("Time's up.", "say"); S.timeout(); }
  }, 100);
}
function stopClock() { clearInterval(clock); clearTimeout(startTimer); clock = null; started = false; if (typingHeld) setTypingHeld(false); }
function lockGate() { input.disabled = true; sendBtn.disabled = true; }

let gateToken = 0;
function openGate(m) {
  showCard("gate");
  gateToken++;
  total = remaining = (m.seconds || 15) * 1000;
  paused = false; started = false; lastKey = 0; typingUsed = 0; typingHeld = false; count.classList.remove("held");
  count.hidden = false; count.textContent = m.seconds || 15;
  say(esc(m.opener));
  compose.hidden = actions.hidden = hint.hidden = false;
  input.disabled = false; sendBtn.disabled = false; sendBtn.textContent = "Make my case";
  sendBtn.onclick = null; $("leave").hidden = false;     // undo a previous crisis card
  input.placeholder = `Why do you need ${m.name}, and for how long?`;
  hint.textContent = "The clock pauses while you type and while I think · Enter to send";
  setTimeout(() => input.focus(), 30);
  // The clock starts when you start answering — or after a moment regardless.
  startTimer = setTimeout(startClock, 2500);
}
input.addEventListener("focus", () => { if (view === "gate") startClock(); });
input.addEventListener("input", () => { if (view === "gate") { lastKey = performance.now(); startClock(); } });

function argue() {
  const text = input.value.trim();
  if (!text || busy || view !== "gate" || input.disabled) return;
  busy = true; paused = true; lastKey = 0; setTypingHeld(false);
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
    if (v.pass && v.pass.site === "*") { hint.hidden = false; hint.textContent = "Break time: every site is open until it runs out."; }
  } else if (v.decision === "crisis") {
    stopClock();
    compose.hidden = hint.hidden = count.hidden = true;
    say(rich(v.reply));
    actions.hidden = false; $("leave").hidden = true; sendBtn.textContent = "Okay";
    sendBtn.onclick = () => { sendBtn.onclick = null; $("leave").hidden = false; hideCard(); };
  } else if (v.decision === "deny") {
    // Not convinced: the tab is closing now, independent of the clock.
    stopClock(); lockGate();
    compose.hidden = actions.hidden = count.hidden = true;
    barFill.style.width = "100%";
    say(esc(v.reply));
    hint.hidden = false; hint.textContent = "Not convinced — closing the tab.";
  } else {
    say(esc(v.reply));
    if (v.source === "offline") say("I can't reach my full reasoning right now, so I'm being extra strict.", "muted");
    input.focus();
  }
}

/* ---------- ask ---------- */
function setEye(on) { share = on; eye.classList.toggle("on", on); eye.title = on ? "Synapse will look at your screen when you send (click to turn off)" : "Synapse won't look at your screen (click to turn on)"; }
eye.addEventListener("click", () => { setEye(!share); S.setShare(share); });

function renderTurn(t) {
  if (t.role === "user") say(esc(t.text), "me");
  else say(rich(t.text));
}

/** Reopening the orb shows the conversation so far (and a reply that arrived while it was closed). */
function openAsk(m) {
  showCard("ask");
  setUnread(false);
  eye.hidden = false; setEye(m.share);
  const history = m.history || [];
  if (!history.length && m.prompt) say(esc(m.prompt));
  history.forEach(renderTurn);
  busy = !!m.pending;
  if (busy) { say("thinking…", "muted pending"); cardOrb.dataset.state = "thinking"; }
  compose.hidden = false; hint.hidden = false;
  input.disabled = busy;
  input.value = draft; draft = ""; autoGrow();
  input.placeholder = m.onboarding ? "The goals and deadlines on your plate…" : history.length ? "Reply…" : "What's on your mind?";
  hint.textContent = busy ? "Still thinking — you can close this and I'll keep going" : "Enter to send · Esc to close";
  setTimeout(() => { input.focus(); body.scrollTop = body.scrollHeight; }, 30);
}

async function sendAsk() {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  say(esc(text), "me");
  say("thinking…", "muted pending");
  input.value = ""; autoGrow(); input.disabled = true;
  cardOrb.dataset.state = "thinking";
  hint.textContent = (share ? "Looking at your screen… " : "Thinking… ") + "you can close this and check back";
  await S.ask(text, share);
}
function onReply(m) {
  busy = false;
  if (view !== "ask") { setUnread(true); return; }   // shown next time you open the orb
  body.querySelectorAll(".pending").forEach((n) => n.remove());
  cardOrb.dataset.state = "";
  say(rich(m.text));
  if (m.sawScreen) say("looked at your screen", "muted");
  input.disabled = false; input.placeholder = "Reply…"; input.focus();
  hint.textContent = "Enter to send · Esc to close";
}

/* ---------- notice ---------- */
function showNotice(m) {
  // Don't wipe out a conversation (or a gate) you're in the middle of — tuck the notice into it.
  if (view === "ask") { say(esc(m.text), "muted"); return; }
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
  if (m.type === "mode") { if (m.mode !== "card" && view !== "dock") { stopClock(); card.hidden = true; dock.hidden = false; view = "dock"; } if (view === "dock") renderDock(m.pass); }
  else if (m.type === "gate") openGate(m);
  else if (m.type === "verdict") onVerdict(m);
  else if (m.type === "gate-site") { if (view === "gate") { input.placeholder = `Why do you need ${m.name}, and for how long?`; say(esc(`${m.name} now? Same clock.`)); } }
  else if (m.type === "timeout") { stopClock(); lockGate(); }
  else if (m.type === "close-card") { if (view === "gate") hideCard(); }
  else if (m.type === "gate-ended") {
    // The app says there's no gate any more: never leave a stale gate card on screen.
    if (view !== "gate") return;
    const tok = gateToken;
    setTimeout(() => { if (view === "gate" && gateToken === tok) hideCard(); }, 1200);
  }
  else if (m.type === "ask") openAsk(m);
  else if (m.type === "reply") onReply(m);
  else if (m.type === "notice") showNotice(m);
  else if (m.type === "blur") { if (view === "ask") hideCard(); }
});
