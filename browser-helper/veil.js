/* Synapse Helper — the veil. While a distracting tab is held, the page is dimmed and its media is
 * paused. There's nothing to click or type here on purpose: the conversation happens in the orb. */
(() => {
  if (window.top !== window) return;
  let el = null, loop = null;
  const stopMedia = () => document.querySelectorAll("video,audio").forEach((m) => { try { if (!m.paused) m.pause(); } catch {} });
  const onPlay = (e) => { if (el && e.target && e.target.pause) e.target.pause(); };

  function hold() {
    if (el) return;
    el = document.createElement("synapse-veil");
    const root = el.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>
      :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; display: block; }
      div { position: fixed; inset: 0; background: rgba(4,10,18,.9); backdrop-filter: blur(22px) saturate(.5);
        display: flex; align-items: center; justify-content: flex-end; padding-right: 140px;
        font: 500 15px/1.4 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #8aa0b8; }
      span { display: flex; align-items: center; gap: 10px; }
      b { color: #e8eef6; font-weight: 600; }
    </style><div><span><b>Synapse</b> is asking you something &rarr;</span></div>`;
    (document.documentElement || document).appendChild(el);
    document.documentElement.style.setProperty("overflow", "hidden", "important");
    document.addEventListener("play", onPlay, true);
    stopMedia(); loop = setInterval(() => { stopMedia(); if (!el.isConnected) document.documentElement.appendChild(el); }, 250);
  }
  function release() {
    if (!el) return;
    clearInterval(loop); document.removeEventListener("play", onPlay, true);
    el.remove(); el = null;
    document.documentElement.style.removeProperty("overflow");
  }
  chrome.runtime.onMessage.addListener((m) => { if (m.synapse === "hold") hold(); if (m.synapse === "release") release(); });
  try { chrome.runtime.sendMessage("synapse:held?", (h) => { void chrome.runtime.lastError; if (h) hold(); }); } catch {}
})();
