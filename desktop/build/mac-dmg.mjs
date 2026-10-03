// Builds the macOS disk images from the apps that `electron-builder --mac zip` already packaged and signed.
//
// Why a separate step: making a .dmg mounts it, copies the app in, and unmounts it with `hdiutil detach`.
// On GitHub's Mac machines Spotlight / XProtect often grab the freshly mounted volume, the detach fails
// ("resource busy"), and electron-builder gives up — failing the whole Mac build. So:
//   1. the .zip (no mounting at all) is built first and is always there as the download;
//   2. each .dmg is built on its own, from the already-packaged app, with a forced detach and retries;
//   3. if a .dmg still can't be made, we say so and keep going — the website falls back to the .zip.
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { resolve } from "node:path";
const APPS = { arm64: resolve("release/mac-arm64/Synapse.app"), x64: resolve("release/mac/Synapse.app") };
const sh = (cmd) => { try { execSync(cmd, { stdio: "ignore" }); } catch { /* best effort */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failed = [];
for (const [arch, app] of Object.entries(APPS)) {
  if (!existsSync(app)) { console.log(`• dmg ${arch}: no packaged app at ${app}, skipping`); failed.push(arch); continue; }
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    // Anything left mounted by a previous try would make the next one fail too.
    sh(`for v in /Volumes/Synapse*; do [ -d "$v" ] && hdiutil detach -force "$v"; done`);
    console.log(`• dmg ${arch}: attempt ${attempt}`);
    const r = spawnSync("npx", ["electron-builder", "--mac", "dmg", `--${arch}`, "--prepackaged", app, "--publish", "never"], { stdio: "inherit", shell: false });
    ok = r.status === 0 && existsSync(`release/Synapse-mac-${arch}.dmg`);
    if (!ok) await sleep(5000 * attempt);
  }
  if (!ok) failed.push(arch);
}
sh(`for v in /Volumes/Synapse*; do [ -d "$v" ] && hdiutil detach -force "$v"; done`);
if (failed.length) console.log(`::warning::Couldn't build the .dmg for ${failed.join(", ")} — the .zip download is used instead.`);
else console.log("• both disk images built");
