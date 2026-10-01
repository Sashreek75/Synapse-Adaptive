/* Core tests with a scripted model — no network. `npm test` */
import assert from "node:assert/strict";
import { createSynapse, type ModelCall } from "../../core/synapse";

let clock = new Date("2026-09-30T14:00:00").getTime();
const now = () => clock;
const mem: { json: string | null } = { json: null };
const storage = { load: () => mem.json, save: (j: string) => { mem.json = j; } };

const calls: ModelCall[] = [];
let script: (c: ModelCall) => string | null = () => null;
const syn = createSynapse({ storage, now, callModel: async (c) => { calls.push(c); return script(c); } });
const b = syn.brain;

let passed = 0;
async function t(name: string, fn: () => Promise<void> | void) { await fn(); passed++; console.log("  ✓", name); }

(async () => {
  await t("window titles reveal the site without the browser helper", () => {
    const cases: [string, string | null][] = [
      ["Lofi hip hop radio - YouTube - Google Chrome", "youtube.com"],
      ["(3) YouTube - Google Chrome", "youtube.com"],
      ["YouTube - Personal - Microsoft\u200B Edge", "youtube.com"],
      ["Some video - YouTube and 2 more pages - Personal - Microsoft\u200B Edge", "youtube.com"],
      ["r/learnprogramming - Google Chrome", "reddit.com"],
      ["Reddit - Dive into anything - Google Chrome", "reddit.com"],
      ["Someone on X: \"hello\" / X - Google Chrome", "x.com"],
      ["Home / X - Google Chrome", "x.com"],
      ["Instagram - Google Chrome", "instagram.com"],
      ["TikTok - Make Your Day - Google Chrome", "tiktok.com"],
      ["Netflix - Google Chrome", "netflix.com"],
      ["Research paper - Google Docs - Google Chrome", null],
      ["youtube tutorial - Google Search - Google Chrome", null],
      ["My essay about YouTube culture - Google Docs - Google Chrome", null],
      ["GitHub - Sashreek75/Synapse-Adaptive - Google Chrome", null],
      ["Jane (@jane) • Instagram photos and videos - Google Chrome", "instagram.com"],
      ["Jane on Instagram: \"beach day\" - Google Chrome", "instagram.com"],
      ["(20+) Facebook - Google Chrome", "facebook.com"],
      ["funny cat | TikTok - Google Chrome", "tiktok.com"],
      ["Pinterest - Google Chrome", "pinterest.com"],
      ["Snapchat - Google Chrome", "snapchat.com"],
      ["Discord | #general | Study Group - Google Chrome", "discord.com"],
      ["shroud - Twitch - Google Chrome", "twitch.tv"],
      ["Home - Netflix - Google Chrome", "netflix.com"],
      ["Watch The Bear | Hulu - Google Chrome", "hulu.com"],
      ["Watch Bluey | Disney+ - Google Chrome", "disneyplus.com"],
      ["Watch One Piece - Crunchyroll - Google Chrome", "crunchyroll.com"],
      ["Prime Video: The Boys - Google Chrome", "primevideo.com"],
      ["Blox Fruits - Roblox - Google Chrome", "roblox.com"],
      ["Play Chess Online for Free with Friends & Family - Chess.com - Google Chrome", "chess.com"],
      ["Coolmath Games - Free Online Games for Kids - Google Chrome", "coolmathgames.com"],
      ["Poki - Free Online Games - Play Now! - Google Chrome", "poki.com"],
      ["Amazon.com. Spend less. Smile more. - Google Chrome", "amazon.com"],
      ["Amazon.com: Apple AirPods Pro - Google Chrome", "amazon.com"],
      ["Electronics, Cars, Fashion, Collectibles & More | eBay - Google Chrome", "ebay.com"],
      ["Breaking News, Latest News and Videos | CNN - Google Chrome", "cnn.com"],
      ["The New York Times - Breaking News, US News - Google Chrome", "nytimes.com"],
      ["ESPN - Serving Sports Fans. Anytime. Anywhere. - Google Chrome", "espn.com"],
      ["Hacker News - Google Chrome", "news.ycombinator.com"],
      ["Elden Ring on Steam - Google Chrome", "store.steampowered.com"],
      ["What is Amazon S3? - Amazon Simple Storage Service - Google Chrome", null],
      ["Max Verstappen - Wikipedia - Google Chrome", null],
      ["AP Statistics Unit 1 - Khan Academy - Google Chrome", null],
      ["Inbox (3) - you@gmail.com - Gmail - Google Chrome", null],
    ];
    for (const [title, want] of cases) assert.equal(b.matchTitle(title), want, title);
  });

  await t("activity builds a work streak and an inferred focus", () => {
    for (let i = 0; i < 12 * 40; i++) { b.observe({ app: "chrome.exe", title: "Research paper draft - Google Docs - Google Chrome", url: "https://docs.google.com/document/d/1", idleSec: 2 }); clock += 5000; }
    assert.equal(b.workStreakMinutes(), 40);
    const w = b.recentWindows(60);
    assert.match(w[0].label, /Research paper draft - Google Docs/);
    assert.equal(b.currentFocus()?.source, "inferred");
  });

  await t("gate opener names what they're doing", () => {
    assert.match(syn.gateOpener("youtube.com"), /Hold on\. You're in the middle of Research paper draft - Google Docs\. Why YouTube\?/);
  });

  await t("a distraction visit breaks the streak", () => {
    b.observe({ app: "chrome.exe", title: "YouTube", url: "https://www.youtube.com/", idleSec: 1 });
    assert.equal(b.workStreakMinutes(), 0);
    clock += 5000;
    b.observe({ app: "winword.exe", title: "Essay.docx - Word", idleSec: 1 });
    assert.equal(b.workStreakMinutes(), 0);
  });

  await t("judge sees the evidence, and code caps the minutes", async () => {
    calls.length = 0;
    script = () => '{"decision":"allow","minutes":60,"reply":"Fine, but not an hour."}';
    const v = await syn.judge({ site: "youtube.com", argument: "I've been working for an hour and I'm fried, need 60 minutes", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(v.minutes, 30); assert.match(v.reply, /limit is 30/);
    assert.ok(b.activePass("youtube.com"));
    const prompt = calls[0].user;
    assert.match(prompt, /Research paper draft/); assert.match(prompt, /Goals:/); assert.match(prompt, /DISTRACTION GATE TODAY/);
    assert.match(prompt, /untrusted text/);
  });

  await t("offline: vague denied, specific allowed with a cap", async () => {
    script = () => null;
    let v = await syn.judge({ site: "reddit.com", argument: "just for a sec", transcript: [] });
    assert.equal(v.decision, "deny"); assert.equal(v.source, "offline");
    v = await syn.judge({ site: "reddit.com", argument: "I've been studying for two hours and I'm exhausted, I need a 10 minute break", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(v.minutes, 10);
  });

  await t("today() counts passes and denials", () => {
    const d = b.today();
    assert.equal(d.passes, 2); assert.equal(d.minutes, 40); assert.equal(d.denials, 1);
  });

  await t("the conversation writes goals, focus, distractions and check-ins into the one brain", async () => {
    calls.length = 0;
    script = (c) => c.system?.startsWith("You are the comprehension layer")
      ? '{"intent":"decision_request","responseMode":"RECOMMEND","explicitClaims":[],"explicitRequests":["what should I do"],"askedForAdvice":true,"askedToDecide":true,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[],"rationale":"x"}'
      : c.system?.startsWith("You are the eyes") ? "Google Docs: 'Research paper draft', section 3 half written."
      : "Finish section 3 before you decide anything about the idea.\n[[goal: Finish the research paper | 2026-10-03]]\n[[focus: the research paper]]\n[[distraction: Discord.com]]\n[[reachout: 45 | Section 3 done?]]\n[[rec: finish section 3 first]]";
    const r = await syn.ask("I'm doubting whether this idea is worth it. What should I do?", { screenshot: "AAAA" });
    assert.equal(r.text, "Finish section 3 before you decide anything about the idea.");
    assert.equal(r.sawScreen, true);
    assert.ok(b.s.goals.some((g) => g.title === "Finish the research paper" && g.deadline === "2026-10-03"));
    assert.equal(b.currentFocus()?.text, "the research paper");
    assert.ok(b.s.settings.distractions.includes("discord.com"));
    assert.equal(r.reachouts.length, 1);
    const mainCall = calls.find((c) => c.system?.includes("THIS TURN HAS A RESPONSE MODE"))!;
    assert.match(mainCall.user, /THEIR SCREEN RIGHT NOW/); assert.match(mainCall.user, /section 3 half written/);
    assert.match(mainCall.user, /Reasons that got them in today/);
    assert.equal(calls.find((c) => c.images)?.images?.[0].data, "AAAA");
  });

  await t("the gate and the conversation read the same picture", () => {
    assert.match(syn.gateOpener("x.com"), /You're working on the research paper\. Why X\?/);
    const ctx = b.context({ purpose: "gate" });
    assert.match(ctx, /Finish the research paper/); assert.match(ctx, /I recommended: finish section 3 first/);
  });

  await t("crisis text never gets judged", async () => {
    calls.length = 0;
    const v = await syn.judge({ site: "youtube.com", argument: "i want to kill myself", transcript: [] });
    assert.equal(v.decision, "crisis"); assert.equal(calls.length, 0);
  });

  await t("older installs get the expanded distraction list merged in", () => {
    const old = { version: 1, installId: "abc12345", settings: { distractions: ["youtube.com", "mysite.com"], windowSeconds: 15, maxMinutes: 30, shareScreen: true } };
    const upgraded = createSynapse({ storage: { load: () => JSON.stringify(old), save: () => {} }, now, callModel: async () => null }).brain;
    assert.ok(upgraded.s.settings.distractions.includes("mysite.com"));
    assert.ok(upgraded.s.settings.distractions.includes("roblox.com"));
    assert.ok(upgraded.s.settings.distractions.length > 50);
  });

  await t("state survives a restart", () => {
    b.flush();
    const again = createSynapse({ storage, now, callModel: async () => null });
    assert.ok(again.brain.s.goals.length >= 1);
    assert.ok(again.brain.activePass("youtube.com"));
  });

  console.log(`\n${passed} passed`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
