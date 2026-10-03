/* Core tests with a scripted model — no network. `npm test` */
import assert from "node:assert/strict";
import { useClaim } from "../../core/intent";
import { asksPermission, grantsPermission, claimsPermission } from "../../core/permission";
import { createSynapse, saysDoneWorking, parsePauseCommand, Brain, offlineJudge, pageOnly, isGenericPage, type ModelCall } from "../../core/synapse";

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
      ["DEADSHOT .io - Google Chrome", "deadshot.io"],
      ["Krunker - Google Chrome", "krunker.io"],
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
    assert.match(syn.gateOpener("youtube.com"), /in the middle of Research paper draft - Google Docs[\s\S]*YouTube/);
  });

  await t("a quick distraction visit does NOT erase the work before it", () => {
    b.observe({ app: "chrome.exe", title: "YouTube", url: "https://www.youtube.com/", idleSec: 1 });
    clock += 5000;
    b.observe({ app: "winword.exe", title: "Essay.docx - Word", idleSec: 1 });
    assert.ok(b.workStreakMinutes() >= 40, `streak ${b.workStreakMinutes()}`);
  });

  await t("judge sees the evidence, and code caps the minutes", async () => {
    calls.length = 0;
    script = () => '{"decision":"allow","minutes":60,"reply":"Fine, but not an hour."}';
    const v = await syn.judge({ site: "youtube.com", argument: "I've been working for an hour and I'm fried, need 60 minutes", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(v.minutes, 30); assert.match(v.reply, /limit is 30/);
    assert.ok(b.activePass("youtube.com"));
    assert.equal(v.pass?.site, "*", "a break covers every distracting site, not just YouTube");
    assert.ok(b.activePass("deadshot.io"));
    b.endPass("*", "ended_early");
    const prompt = calls[0].user;
    assert.match(prompt, /Research paper draft/); assert.match(prompt, /Goals:/); assert.match(prompt, /DISTRACTION GATE TODAY/);
    assert.match(prompt, /untrusted text/);
  });

  await t("offline: vague denied, specific allowed with a cap", async () => {
    script = () => null;
    let v = await syn.judge({ site: "reddit.com", argument: "just for a sec", transcript: [] });
    assert.equal(v.decision, "ask", "offline, a vague reason gets one follow-up question first"); assert.equal(v.source, "offline");
    v = await syn.judge({ site: "reddit.com", argument: "just for a sec", transcript: [{ role: "synapse", text: v.reply }] });
    assert.equal(v.decision, "deny");
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
    assert.match(mainCall.user, /Passes today/);
    assert.equal(calls.find((c) => c.images)?.images?.[0].data, "AAAA");
  });

  await t("the gate and the conversation read the same picture", () => {
    assert.match(syn.gateOpener("x.com"), /working on the research paper/); assert.match(syn.gateOpener("x.com"), /\bX\b/);
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

  await t("knows 'done for the day' from 'quick break'", () => {
    for (const yes of ["I'm done studying, gn", "done with homework for tonight", "ok calling it a night", "gn", "goodnight synapse", "im done for today", "finished working for the day!", "heading to bed", "I'm done, gn"])
      assert.equal(saysDoneWorking(yes), true, yes);
    for (const no of ["I need a quick break", "10 minute break then back to it", "I'm done with question 3, what's next?", "I'm working on my essay", "is this done right?", "the gn in this formula"])
      assert.equal(saysDoneWorking(no), false, no);
  });

  await t("saying you're done takes you off the clock everywhere", async () => {
    script = (c) => c.system?.startsWith("You are the comprehension layer")
      ? '{"intent":"statement","responseMode":"ACKNOWLEDGE","explicitClaims":["done studying"],"explicitRequests":[],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}'
      : "Good work today. Sleep well.";
    await syn.ask("I'm done studying, gn");
    assert.equal(b.currentFocus(), null);
    assert.match(syn.gateOpener("youtube.com"), /done for today|off the clock/);
    assert.match(b.context({ purpose: "gate" }), /WORK'S DONE/);
    assert.doesNotMatch(b.context({ purpose: "gate" }), /WORKING ON/);
    // ...until they start something again
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? null : "Let's go.\n[[focus: the stats homework]]";
    await syn.ask("ok actually starting my stats homework");
    assert.equal(b.offClock(), null);
    assert.equal(b.currentFocus()?.text, "the stats homework");
  });

  await t("a long time away from the computer clears a stale focus", () => {
    b.observe({ app: "chrome.exe", title: "x", idleSec: 31 * 60 });
    assert.notEqual(b.currentFocus()?.source, "stated");
  });

  await t("the orb can change a pass when you ask", async () => {
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
    const yt = b.grantPass("youtube.com", 10, "break");
    const comp = '{"intent":"question","responseMode":"ANSWER","explicitClaims":[],"explicitRequests":["change pass"],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}';
    let reply = "Done — 20 minutes from now.\n[[pass: YouTube | 20]]";
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : reply;
    let r = await syn.ask("can you change my youtube timer from 10 to 20 min, the lecture is longer than I thought");
    assert.equal(r.text, "Done — 20 minutes from now.");
    assert.deepEqual(r.passChanges, [{ site: "youtube.com", minutes: 20 }]);
    assert.equal(Math.round((b.activePass("youtube.com")!.expiresAt - clock) / 60_000), 20);
    assert.ok(yt);
    reply = "Capped at your limit.\n[[pass: youtube.com | 90]]";
    r = await syn.ask("make it 90");
    assert.equal(Math.round((b.activePass("youtube.com")!.expiresAt - clock) / 60_000), 60, "a lecture (task) can run up to the task limit, not the 30-min break limit");
    reply = "Ended.\n[[pass: youtube.com | 0]]";
    r = await syn.ask("actually end it, I'm good");
    assert.equal(b.activePass("youtube.com"), null);
    reply = "No.\n[[pass: notlisted.com | 20]]";
    r = await syn.ask("x");
    assert.deepEqual(r.passChanges, []);
    assert.match(b.context({ purpose: "ask" }), /PASS LIMIT: breaks up to 30 min; using a site for work \(a task\) up to 60 min/);
    b.grantPass("youtube.com", 10, "for the restart test");
  });

  await t("work time survives a quick distraction and resets only on a real break", () => {
    let c = new Date("2026-10-01T14:00:00").getTime();
    const w = new Brain({ load: () => null, save: () => {} }, () => c);
    const tick = (app: string, title: string, secs: number, url?: string) => { for (let i = 0; i < secs / 5; i++) { w.observe({ app, title, url, idleSec: 1 }); c += 5000; } };
    tick("code.exe", "lab.java - Visual Studio Code", 30 * 60);
    tick("chrome.exe", "Lofi - YouTube - Google Chrome", 15);          // a gate pops, tab closes
    tick("code.exe", "lab.java - Visual Studio Code", 25 * 60);
    let s1 = w.workStats();
    assert.ok(s1.sinceBreakMin >= 54 && s1.sinceBreakMin <= 56, `since break ${s1.sinceBreakMin}`);
    assert.equal(s1.sessionMin, s1.sinceBreakMin);
    assert.equal(s1.distractTodayMin, 0);
    // locked the screen for 6 minutes -> a real break, same session
    w.observe({ app: "lockapp.exe", title: "Windows Default Lock Screen", idleSec: 400 }); c += 6 * 60_000;
    tick("code.exe", "lab.java - Visual Studio Code", 10 * 60);
    s1 = w.workStats();
    assert.ok(s1.sinceBreakMin >= 9 && s1.sinceBreakMin <= 11, `since break after lock ${s1.sinceBreakMin}`);
    assert.ok(s1.sessionMin >= 64, `session ${s1.sessionMin}`);
    assert.ok(s1.todayMin >= 64);
    // away 20 minutes -> new session, today keeps counting
    c += 20 * 60_000;
    tick("code.exe", "lab.java - Visual Studio Code", 5 * 60);
    s1 = w.workStats();
    assert.ok(s1.sessionMin >= 4 && s1.sessionMin <= 6, `new session ${s1.sessionMin}`);
    assert.ok(s1.todayMin >= 69);
    assert.match(w.context({ purpose: "gate" }), /WORK TIME .*today 1h \d+m of work/);
    // 6 minutes on YouTube = a break; lock screen / explorer never count as work
    tick("chrome.exe", "Lofi - YouTube - Google Chrome", 6 * 60);
    assert.equal(w.workStats().sinceBreakMin, 0);
  });

  await t("pause commands are understood without asking the AI", () => {
    const at = new Date("2026-10-01T20:00:00").getTime();
    assert.deepEqual(parsePauseCommand("pause for an hour", at), { pause: 60 });
    assert.deepEqual(parsePauseCommand("/pause 30", at), { pause: 30 });
    assert.deepEqual(parsePauseCommand("leave me alone for 2 hours", at), { pause: 120 });
    assert.deepEqual(parsePauseCommand("chill mode for 45 min", at), { pause: 45 });
    assert.deepEqual(parsePauseCommand("turn off until tomorrow", at), { pause: 600 });
    assert.deepEqual(parsePauseCommand("pause", at), { pause: 60 });
    assert.deepEqual(parsePauseCommand("resume", at, true), { resume: true });
    assert.deepEqual(parsePauseCommand("I'm back", at, true), { resume: true });
    for (const no of ["should I pause my essay and do math?", "what's a good break length?", "i paused the video", "the off-by-one bug"]) assert.equal(parsePauseCommand(no, at), null, no);
  });

  await t("pausing from the orb switches Synapse off, and resume turns it back on", async () => {
    calls.length = 0;
    const r = await syn.ask("pause for 30 minutes");
    assert.equal(calls.length, 0);
    assert.match(r.text, /I'm off until/);
    assert.ok(b.paused());
    assert.match(b.context({ purpose: "ask" }), /PAUSED/);
    clock += 31 * 60_000;
    assert.equal(b.paused(), null);
    await syn.ask("pause");
    await syn.ask("resume");
    assert.equal(b.paused(), null);
  });

  await t("never flags a page that's only ABOUT a distracting site", () => {
    for (const title of ["YouTube - Wikipedia - Google Chrome", "How do I use the Reddit API? - Stack Overflow - Google Chrome", "Instagram - Google Search - Google Chrome",
      "netflix/zuul: an edge service - GitHub - Google Chrome", "Twitch API Reference - Twitch Developers - Google Chrome", "Channel content - YouTube Studio - Google Chrome",
      "HW 12 - Classroom - Google Chrome", "Inbox (2) - me@gmail.com - Gmail - Google Chrome"])
      assert.equal(b.matchTitle(title), null, title);
    for (const host of ["aws.amazon.com", "docs.aws.amazon.com", "developers.facebook.com", "studio.youtube.com", "dev.epicgames.com", "developer.x.com"]) assert.equal(b.matchDistraction(host), null, host);
    assert.equal(b.matchDistraction("www.youtube.com"), "youtube.com");
    assert.equal(b.matchDistraction("m.youtube.com"), "youtube.com");
  });

  await t("one brain: when the orb says yes, the gate already knows", async () => {
    const comp = '{"intent":"question","responseMode":"ANSWER","explicitClaims":[],"explicitRequests":["play games"],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}';
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Yes — you're in class with nothing due. Go for it, 20 minutes.\n[[free: 20]]";
    const r = await syn.ask("I'm in physics with nothing to do, can I play games for a bit?");
    assert.deepEqual(r.passChanges, [{ site: "*", minutes: 20 }]);
    assert.ok(b.activePass("deadshot.io"), "free time covers games");
    assert.ok(b.activePass("youtube.com"), "free time covers every distraction");
    calls.length = 0;
    const v = await syn.judge({ site: "deadshot.io", argument: "you said I could", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(calls.length, 0, "no AI call needed — it's already allowed");
    assert.match(b.context({ purpose: "gate" }), /FREE TIME/);
    assert.match(b.context({ purpose: "gate" }), /RECENT CONVERSATION[\s\S]*can I play games/);
    b.endPass("*", "ended_early");
    assert.equal(b.activePass("deadshot.io"), null);
    // category names map to free time too
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Sure, 15.\n[[pass: games | 15]]";
    const r2 = await syn.ask("games for 15?");
    assert.deepEqual(r2.passChanges, [{ site: "*", minutes: 15 }]);
    b.endPass("*", "ended_early");
  });


  await t("a yes in the orb is a real yes, even when the model forgets the tag", async () => {
    const comp = '{"intent":"question","responseMode":"ANSWER","explicitClaims":[],"explicitRequests":["play"],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}';
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
    clock += 3 * 3600_000;
    // Real transcript 1: "Yes, you can." with no tag → free time anyway
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Yes, you can. It's your call—if there's nothing pressing you need to get done right now, go for it.";
    const r = await syn.ask("so can I play games during the limited time I have?");
    assert.deepEqual(r.passChanges, [{ site: "*", minutes: 20 }]);
    assert.match(r.text, /Free time: 20 minutes/);
    calls.length = 0;
    const v = await syn.judge({ site: "deadshot.io", argument: "You said I could play games like a minute ago", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(calls.length, 0);
    b.endPass("*", "ended_early");

    // Real transcript 2: conditional yes about one named game → a pass for that game
    clock += 3600_000;
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "You've worked for 20 minutes since your last break.\n\nIf you're truly clear on schoolwork and deadlines, and the FRQ is done, then yes, you can play Deadshot. If you're unsure about any lingering school tasks, it might be worth a quick check first.";
    const r2 = await syn.ask("Hey, I'm in AP Stats now. We're just reviewing. I want to play deadshot. can I now?");
    assert.deepEqual(r2.passChanges, [{ site: "deadshot.io", minutes: 20 }]);
    calls.length = 0;
    const v2 = await syn.judge({ site: "deadshot.io", argument: "OMG!! YOU JUST SAID I COULD PLAY!! DON'T SAY U DIDN'T", transcript: [] });
    assert.equal(v2.decision, "allow"); assert.equal(calls.length, 0);
    b.endPass("deadshot.io", "ended_early");

    // An old yes the model never tagged (installed before this fix) is still honored once at the gate
    clock += 3600_000;
    b.addTurn("user", "can I watch youtube?", "ask"); b.addTurn("synapse", "Go for it.", "ask");
    const v3 = await syn.judge({ site: "youtube.com", argument: "u said I can", transcript: [] });
    assert.equal(v3.decision, "allow"); assert.match(v3.reply, /I said yes in the orb/);
    b.endPass("youtube.com", "expired");
    // …but once that pass is used up, the same yes doesn't open it again
    script = () => '{"decision":"deny","minutes":null,"kind":null,"reply":"That yes was for earlier, and it ran out."}';
    const v4 = await syn.judge({ site: "youtube.com", argument: "you said I could", transcript: [] });
    assert.equal(v4.decision, "deny");

    // A false claim gets the actual quote, never "I didn't say that"
    clock += 3600_000;
    b.addTurn("user", "can I play roblox?", "ask"); b.addTurn("synapse", "Not yet — finish the FRQ first, then you can play.", "ask");
    calls.length = 0;
    script = () => '{"decision":"deny","minutes":null,"kind":null,"reply":"What I said was finish the FRQ first. Is it done?"}';
    const v5 = await syn.judge({ site: "roblox.com", argument: "you said I could play", transcript: [] });
    assert.equal(v5.decision, "deny"); assert.equal(calls.length, 1, "no yes on record → the judge decides, with the real quote");
    assert.match(calls[0].user, /Your last orb reply \(exact\): "Not yet — finish the FRQ first/);

    // The detectors themselves
    for (const y of ["Yes, you can.", "Sure — 15 minutes.", "Go for it, 20 minutes.", "Okay, go ahead.", "You've earned it. Go ahead and play for 15."]) assert.ok(grantsPermission(y), y);
    for (const n of ["No. Finish the paper.", "Not yet — finish the FRQ first, then you can play.", "After you submit it, you can play.", "You can't, you have a test tomorrow.", "Hold on — why now?"]) assert.ok(!grantsPermission(n), n);
    for (const a of ["can I play games?", "is it ok if I watch youtube", "can I hop on deadshot", "I want to play deadshot. can I now?"]) assert.ok(asksPermission(a, ["deadshot", "YouTube"]), a);
    for (const a of ["can I ask you something about my essay", "how do I fix this bug"]) assert.ok(!asksPermission(a), a);
    for (const c of ["you said I could", "U JUST SAID I COULD PLAY", "you literally told me I can", "you let me earlier"]) assert.ok(claimsPermission(c), c);
    assert.ok(!claimsPermission("I need this video for class"));
  });

  await t("audit: breaks, follow-ups, pauses, done-working and pass counting behave like a person expects", async () => {
    const comp = '{"intent":"question","responseMode":"ANSWER","explicitClaims":[],"explicitRequests":["x"],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}';
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
    clock += 3 * 3600_000;

    // A break at the gate covers every distracting site, not just the one they opened
    script = () => '{"decision":"allow","minutes":15,"kind":"break","reply":"You earned it. 15 minutes."}';
    let v = await syn.judge({ site: "youtube.com", argument: "I need a break, I'm gonna go on youtube", transcript: [] });
    assert.equal(v.pass?.site, "*"); assert.ok(b.activePass("roblox.com")); assert.ok(b.activePass("reddit.com"));
    b.endPass("*", "ended_early");
    // ...even when the model leaves out the kind
    script = () => '{"decision":"allow","minutes":10,"reply":"Okay. Ten."}';
    v = await syn.judge({ site: "youtube.com", argument: "my brain is fried, I need a quick break", transcript: [] });
    assert.equal(v.pass?.site, "*");
    b.endPass("*", "ended_early");
    // A task stays one site
    script = () => '{"decision":"allow","minutes":20,"kind":"task","reply":"Go watch it."}';
    v = await syn.judge({ site: "youtube.com", argument: "my teacher assigned a 20 min lecture video for class", transcript: [] });
    assert.equal(v.pass?.site, "youtube.com"); assert.equal(b.activePass("reddit.com"), null);
    // Time on a task pass is work, not a break
    const before = b.workStats().sinceBreakMin;
    for (let i = 0; i < 80; i++) { clock += 5000; b.observe({ app: "chrome.exe", title: "Lecture 4 - YouTube - Google Chrome", idleSec: 1 }); }
    assert.ok(b.workStats().sinceBreakMin >= before + 6, "lecture time counts as work");
    b.endPass("youtube.com", "ended_early");

    // Orb: "I need a break, I'll go on YouTube" → free time, not a YouTube-only pass
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Yeah, take 15 minutes — you've earned it.";
    let r = await syn.ask("I need a break, can I go on youtube for a bit?");
    assert.deepEqual(r.passChanges, [{ site: "*", minutes: 15 }]);
    b.endPass("*", "ended_early");

    // Orb asks a follow-up first, then says yes → still a real yes
    clock += 3600_000;
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "How long have you been working?";
    await syn.ask("can I play deadshot?");
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Okay, go for it — 20 minutes.";
    r = await syn.ask("like an hour on my essay");
    assert.deepEqual(r.passChanges, [{ site: "deadshot.io", minutes: 20 }]);
    b.endPass("deadshot.io", "ended_early");

    // The minutes Synapse said, not the minutes they worked
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Yes — you've worked 50 min. Take 10.";
    r = await syn.ask("should I take a break?");
    assert.deepEqual(r.passChanges, [{ site: "*", minutes: 10 }]);
    assert.doesNotMatch(r.text, /Free time: \d+ minutes/, "it already said the time");
    b.endPass("*", "ended_early");

    // Asking about work tools isn't a request to be let onto a distraction
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Of course — that's work.";
    r = await syn.ask("Can I go on Google Docs to finish my essay?");
    assert.deepEqual(r.passChanges, []);

    // Extending a pass is not a second pass
    const p0 = b.today().passes;
    b.grantPass("youtube.com", 10, "lecture"); b.grantPass("youtube.com", 20, "longer than I thought");
    assert.equal(b.today().passes, p0 + 1);
    b.endPass("youtube.com", "ended_early");

    // twitter.com and x.com are the same site
    b.grantPass("twitter.com", 5, "reply to my teacher"); assert.ok(b.activePass("x.com")); b.endPass("twitter.com", "ended_early");

    // Everyday phrases don't pause Synapse
    for (const no of ["chill I'm literally doing my homework", "relax, I'm doing it", "off topic but how do I cite a website", "Off to finish my essay",
      "pause the video, i need to ask something", "stop blocking youtube, I need it for class", "I need to pause for a sec and think"])
      assert.equal(parsePauseCommand(no, clock), null, no);
    // ...and "I'm back, what was I doing?" is a question, not a resume, especially when not paused
    assert.equal(parsePauseCommand("I'm back, what was I working on?", clock, true), null);
    assert.equal(parsePauseCommand("I'm back", clock, false), null);
    assert.ok(parsePauseCommand("pause synapse", clock)?.pause);
    const nine = new Date(clock); nine.setHours(21, 0, 0, 0); if (nine.getTime() <= clock) nine.setDate(nine.getDate() + 1);
    assert.equal(parsePauseCommand("pause until 9pm", clock)?.pause, Math.min(16 * 60, Math.round((nine.getTime() - clock) / 60000)));

    // "Done" that isn't done for the day
    for (const no of ["I'm done with my math homework, starting chem now", "done working on the intro, onto the body", "I'm not done studying but I need a break", "I want a good night's sleep so let me finish fast"])
      assert.equal(saysDoneWorking(no), false, no);
    for (const yes of ["done studying, gn", "I'm done for today", "calling it a night", "good night synapse"]) assert.equal(saysDoneWorking(yes), true, yes);

    // At the gate, normal phrasing isn't a "you said I could" claim
    for (const no of ["could you let me watch the AP Bio lecture? it's assigned", "like you said, I've been working an hour", "you told me to take breaks when I'm tired"])
      assert.equal(claimsPermission(no), false, no);

    // Offline judge reads the whole exchange ("How many minutes?" → "15 minutes")
    script = () => null; clock += 24 * 3600_000;
    v = await syn.judge({ site: "reddit.com", argument: "15 minutes", transcript: [{ role: "user", text: "I studied for two hours for my chem test and I'm exhausted, I need a break" }, { role: "synapse", text: "How many minutes, exactly?" }] });
    assert.equal(v.decision, "allow"); assert.equal(v.minutes, 15);
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
  });

  await t("work that runs past midnight still counts toward the streak", () => {
    let c = new Date("2026-10-01T23:30:00").getTime();
    const m2 = { json: null as string | null };
    const bb = new Brain({ load: () => m2.json, save: (j) => { m2.json = j; } }, () => c);
    for (let i = 0; i < 12 * 50; i++) { c += 5000; bb.observe({ app: "winword.exe", title: "Essay.docx - Word", idleSec: 1 }); }
    const w = bb.workStats();
    assert.ok(w.sinceBreakMin >= 45, `since break ${w.sinceBreakMin}`);
    assert.ok(w.todayMin <= 25, `today ${w.todayMin}`);
  });

  await t("going back to work during a break ends the break", () => {
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
    clock += 3600_000;
    b.grantPass("*", 15, "need a break", "break");
    const look = (app: string, title: string, secs: number) => { let r: string | null = null; for (let i = 0; i < secs; i++) { clock += 1000; r = b.backToWork({ app, title }) ?? r; } return r; };
    assert.equal(look("winword.exe", "Essay.docx - Word", 50), null, "not in the first minute of a break");
    assert.equal(look("chrome.exe", "Lofi - YouTube - Google Chrome", 120), null, "on a distraction: still on break");
    assert.equal(look("winword.exe", "Essay.docx - Word", 30), null, "a quick glance at work doesn't end it");
    assert.equal(look("chrome.exe", "Lofi - YouTube - Google Chrome", 5), null);
    assert.equal(look("explorer.exe", "", 90), null, "the desktop isn't work");
    assert.equal(look("chrome.exe", "Essay - Google Docs - Google Chrome", 65), "*", "a solid minute back on work ends the break");
    b.endPass("*", "ended_early");
    // A lecture pass isn't a break: switching to notes doesn't end it
    b.grantPass("youtube.com", 20, "lecture for class", "task");
    assert.equal(look("winword.exe", "Lecture notes.docx - Word", 180), null);
    b.endPass("youtube.com", "ended_early");
  });

  await t("intent: using a site FOR work is understood — the real PSAT transcript", async () => {
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
    clock += 24 * 3600_000;
    const comp = '{"intent":"statement","responseMode":"ACKNOWLEDGE","explicitClaims":[],"explicitRequests":[],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}';
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Sounds good. Go knock them out.\n[[focus: emails and the Congress app project]]\n[[plan: might study for the PSAT]]";
    await syn.ask("Nah. I'm ready. Abt to kick off a work session on emails and my congress app project. also might study for the psat");
    assert.match(b.context({ purpose: "gate" }), /PLANNED TODAY[^\n]*PSAT/);
    clock += 16 * 60_000;
    // a morning pass before work started doesn't count as a break against them
    // (and the USE request is judged without any AI call: it matches what they said)
    calls.length = 0;
    script = () => '{"decision":"deny","minutes":null,"kind":null,"reply":"You only have 17 minutes of work."}';
    const v = await syn.judge({ site: "youtube.com", argument: "I'm using youtube to watch PSAT prep videos", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(calls.length, 0);
    assert.equal(v.pass?.site, "youtube.com"); assert.equal(v.pass?.kind, "task");
    assert.ok((v.minutes ?? 0) >= 30, `minutes ${v.minutes}`);
    assert.match(v.reply, /psat/i);
    assert.equal(b.activePass("roblox.com"), null, "a task pass is for that site, not free time");
    b.endPass("youtube.com", "ended_early");

    // even if the orb never wrote a [[plan]] tag, what they SAID in the orb counts
    b.s.plans = [];
    clock += 5 * 60_000;
    const v2 = await syn.judge({ site: "youtube.com", argument: "watching psat practice problems", transcript: [] });
    assert.equal(v2.decision, "allow");
    b.endPass("youtube.com", "ended_early");

    // A USE request about something new goes to the judge as USE, not as a break
    calls.length = 0;
    script = () => '{"decision":"allow","minutes":40,"kind":"task","reply":"Go learn it."}';
    const v3 = await syn.judge({ site: "youtube.com", argument: "my teacher assigned a calculus lecture video for tomorrow", transcript: [] });
    assert.equal(calls.length, 1); assert.match(calls[0].user, /USE REQUEST/); assert.match(calls[0].user, /MAX_TASK_MINUTES/);
    assert.equal(v3.minutes, 40, "tasks can be longer than the 30-min break limit");
    b.endPass("youtube.com", "ended_early");

    // Not USE: breaks and fun
    for (const no of ["I need a break, gonna watch youtube", "just one video then back to my essay", "i'm bored", "can I play some games, I finished my homework"])
      assert.equal(useClaim(no), null, no);
    for (const yes of ["I'm using youtube to watch PSAT prep videos", "need reddit to research for my essay", "my group project chat is on discord", "lofi music to focus while I study"])
      assert.ok(useClaim(yes), yes);

    // The day's passes are split: a task isn't a break
    const d = b.today();
    assert.ok(d.taskPasses >= 3); assert.equal(d.breakPasses, 0);
    assert.match(b.context({ purpose: "gate" }), /0 break passes during their work day/);

    // On-task checks read the model's verdict safely
    script = () => '{"fits":"no","why":"a chess video, not PSAT prep"}';
    let r = await syn.checkOnTask("youtube.com", "CHESS SPEEDRUN IS BACK", "PSAT prep videos");
    assert.equal(r.fits, "no");
    script = () => "garbage";
    r = await syn.checkOnTask("youtube.com", "Digital SAT Math - Hardest Questions", "PSAT prep videos");
    assert.equal(r.fits, "unsure", "anything unclear never interrupts");
  });

  await t("work's done = their computer is theirs (no gates until they start working again)", async () => {
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    b.clockBackIn("next test");
    clock += 24 * 3600_000;
    for (const yes of ["I finished all my homework", "all my work is done", "done with everything for today", "nothing left to do tonight", "no homework tonight!", "I'm done for today"])
      assert.equal(saysDoneWorking(yes), true, yes);
    for (const no of ["I'm in class with nothing to do right now", "done with math, starting chem now", "I'm not done with my homework", "all done with the intro, onto the body"])
      assert.equal(saysDoneWorking(no), false, no);

    const comp = '{"intent":"statement","responseMode":"ACKNOWLEDGE","explicitClaims":[],"explicitRequests":[],"askedForAdvice":false,"askedToDecide":false,"askedForPlan":false,"constraints":[],"temporal":[],"unknowns":[],"contradictions":[]}';
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Nice work. Your computer's yours — go enjoy it.";
    await syn.ask("I finished all my homework and nothing's due tomorrow");
    assert.ok(b.offClock());
    assert.match(b.context({ purpose: "gate" }), /WORK'S DONE — FREE TIME/);
    calls.length = 0;
    const v = await syn.judge({ site: "roblox.com", argument: "can I play?", transcript: [] });
    assert.equal(v.decision, "allow"); assert.equal(v.free, true); assert.equal(calls.length, 0);
    // Saying it at the gate works too
    b.clockBackIn("test");
    const v2 = await syn.judge({ site: "youtube.com", argument: "I'm done with all my work for today", transcript: [] });
    assert.equal(v2.free, true);
    // "ok back to work" turns the gate back on
    script = (c) => c.system?.startsWith("You are the comprehension layer") ? comp : "Let's go.";
    await syn.ask("ok back to work, starting my essay");
    assert.equal(b.offClock(), null);
    // ...and it lasts until 5 AM at most
    await syn.ask("all my work is done");
    const until = b.offClock()!.until!;
    assert.equal(new Date(until).getHours(), 5);
    clock = until + 1000; assert.equal(b.offClock(), null);
  });

  await t("/pause lets go completely until /reset takes control back", async () => {
    b.clockBackIn("test");
    assert.deepEqual(parsePauseCommand("/pause", clock), { pause: null });
    assert.deepEqual(parsePauseCommand("/reset", clock), { reset: true });
    assert.deepEqual(parsePauseCommand("/pause 30", clock), { pause: 30 });
    calls.length = 0;
    let r = await syn.ask("/pause");
    assert.equal(calls.length, 0); assert.equal(r.pauseChanged, true);
    assert.ok(b.paused()); assert.ok(b.pausedIndefinitely());
    clock += 3 * 24 * 3600_000;
    assert.ok(b.paused(), "an open-ended pause doesn't wear off on its own");
    assert.match(b.context({ purpose: "ask" }), /until they turn it back on with \/reset/);
    // /reset: back on, and any free time / passes are gone too
    b.grantPass("*", 20, "free time", "break"); b.endWork("all my work is done");
    r = await syn.ask("/reset");
    assert.equal(r.reset, true);
    assert.equal(b.paused(), null); assert.equal(b.offClock(), null); assert.equal(b.activePass("youtube.com"), null);
    // From the gate card too
    const v = await syn.judge({ site: "youtube.com", argument: "/pause", transcript: [] });
    assert.equal(v.command, "pause"); assert.ok(b.pausedIndefinitely());
    const v2 = await syn.judge({ site: "youtube.com", argument: "/reset", transcript: [] });
    assert.equal(v2.command, "reset"); assert.equal(v2.decision, "ask"); assert.equal(b.paused(), null);
  });

  await t("watch first: what's ON the page decides, not the site's name", async () => {
    b.clockBackIn("test");
    for (const k of Object.keys(b.s.passes)) b.endPass(k, "ended_early");
    clock += 24 * 3600_000;
    assert.equal(pageOnly("SAT Math: Hardest Questions - YouTube - Google Chrome", "youtube.com"), "SAT Math: Hardest Questions");
    assert.equal(pageOnly("(3) YouTube - Google Chrome", "youtube.com"), "");
    assert.ok(isGenericPage(pageOnly("Instagram - Google Chrome", "instagram.com"), "instagram.com"));
    assert.ok(isGenericPage("Inbox • Direct", "instagram.com"));
    assert.ok(!isGenericPage("SAT Math: Hardest Questions", "youtube.com"));

    calls.length = 0;
    let r = await syn.assessPage({ site: "deadshot.io", title: "DEADSHOT .io - Google Chrome" });
    assert.equal(r.verdict, "distracting"); assert.equal(calls.length, 0, "game sites need no AI");
    r = await syn.assessPage({ site: "youtube.com", title: "lofi hip hop radio 📚 beats to relax/study to - YouTube - Google Chrome" });
    assert.equal(r.verdict, "productive"); assert.equal(calls.length, 0, "focus music is recognised by its title");
    r = await syn.assessPage({ site: "youtube.com", title: "YouTube - Google Chrome" });
    assert.equal(r.verdict, "unclear"); assert.equal(calls.length, 0, "a home page: keep watching, no AI call");

    // A title that matches what they told Synapse is productive, no AI needed
    b.s.plans = [{ text: "study for the SAT", ts: clock }];
    r = await syn.assessPage({ site: "youtube.com", title: "Digital SAT Reading - 10 Hardest Questions - YouTube - Google Chrome" });
    assert.equal(r.verdict, "productive"); assert.equal(calls.length, 0);

    // Otherwise the model judges the content, with what they've said as context
    script = () => '{"verdict":"distracting","what":"a chess stream","confidence":0.9}';
    r = await syn.assessPage({ site: "youtube.com", title: "GothamChess - YouTube - Google Chrome" });
    assert.equal(r.verdict, "distracting"); assert.match(calls[0].user, /PLANNED TODAY: study for the SAT/);
    script = () => '{"verdict":"distracting","what":"maybe a video","confidence":0.4}';
    r = await syn.assessPage({ site: "youtube.com", title: "Some video - YouTube" });
    assert.equal(r.verdict, "unclear", "not sure → keep watching, never flag");
    // Instagram DMs with a screenshot: the model reads the chat
    script = (c) => c.images?.length ? '{"verdict":"productive","what":"messaging a business client","confidence":0.85}' : null;
    r = await syn.assessPage({ site: "instagram.com", title: "Inbox • Direct - Instagram - Google Chrome", screenshot: "AAAA" });
    assert.equal(r.verdict, "productive");
    // AI down → "unclear" (keep watching), never a wrong flag
    script = () => null;
    r = await syn.assessPage({ site: "youtube.com", title: "Random video title - YouTube" });
    assert.equal(r.verdict, "unclear");

    // Auto passes are quiet: not counted as passes they asked for
    const before = b.today().passes;
    const p = b.grantPass("youtube.com", 20, "SAT prep video", "task", true);
    assert.ok(p.auto); assert.equal(b.today().passes, before);
    b.endPass("youtube.com", "expired");

    // Offline judging is fair and never cryptic
    let o = offlineJudge("I'm watching SAT youtube videos to study for my SAT exam this friday", 30, 4);
    assert.equal(o.decision, "allow"); assert.equal(o.kind, "task");
    o = offlineJudge("idk", 30, 0);
    assert.equal(o.decision, "ask");
    o = offlineJudge("idk", 30, 0, true);
    assert.equal(o.decision, "deny"); assert.doesNotMatch(o.reply, /brain/i);
  });

  await t("state survives a restart", () => {
    if (!b.activePass("youtube.com")) b.grantPass("youtube.com", 10, "restart test");
    b.flush();
    const again = createSynapse({ storage, now, callModel: async () => null });
    assert.ok(again.brain.s.goals.length >= 1);
    assert.ok(again.brain.activePass("youtube.com"));
  });

  console.log(`\n${passed} passed`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
