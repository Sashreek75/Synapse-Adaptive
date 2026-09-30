const S = window.synapse, $ = (id) => document.getElementById(id);
function status(on) { $("hstatus").innerHTML = on ? '<span class="ok">· connected</span>' : '<span class="bad">· not connected</span>'; }
async function load() {
  const s = await S.getSettings();
  $("list").value = s.distractions.join("\n");
  $("secs").value = s.windowSeconds; $("max").value = s.maxMinutes;
  status(s.helperConnected);
  $("goals").textContent = s.goals.length ? s.goals.join(" · ") : "Nothing yet.";
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}
$("save").onclick = async () => {
  await S.setSettings({ distractions: $("list").value.split(/\n|,/), windowSeconds: +$("secs").value, maxMinutes: +$("max").value });
  $("saved").textContent = "Saved."; setTimeout(() => ($("saved").textContent = ""), 2500); load();
};
$("openFolder").onclick = () => S.openHelperFolder();
S.onSettings((m) => { if ("helperConnected" in m) status(m.helperConnected); if (m.section) document.getElementById(m.section)?.scrollIntoView(); });
load();
