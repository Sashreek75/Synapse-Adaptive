# Synapse

Synapse is a desktop app for Windows and Mac. Its only interface is a small orb at the edge of your screen. It stays
quiet while you work, stops you when you open a distracting site and makes you give a real reason,
and when you click it, it helps you think using what it can see you're doing.

The website in this repo is **not** Synapse. It explains Synapse and hands out the installer.

```
desktop/          The desktop app (Electron, Windows + Mac): orb window, background agent, tray, installers
core/             The Synapse brain: one state, one context builder, the gate, the conversation
browser-helper/   Chrome/Edge extension with no UI: reports the current tab, veils/closes tabs on command
app/              The website: landing page, privacy, terms, and /api/relay
ai/client.ts      Server-side Gemini client used only by the relay
_archive/web-app/ The old web app, kept for reference. Not built, not deployed.
```

## How it fits together

```
Orb UI ──┐                          ┌── Context  (foreground window, idle time, browser tab)
         ├── core/ Brain (one state)┼── Goals
Agent ───┘                          └── Memory
                 │
            model calls ──► website /api/relay ──► Gemini   (the key lives only on the server)
```

- **One brain.** `core/brain.ts` holds everything: goals, what you're working on, a 24-hour activity
  log, gate history, passes, memory, and conversation. `Brain.context()` is the only place context is
  assembled; the gate and the conversation both use it.
- **The gate.** `core/synapse.ts → judge()`. The model decides allow/deny/ask using the evidence
  (e.g. how long you've actually been working); code caps the minutes. If the model can't be reached,
  strict offline rules apply instead of letting you through.
- **Memory.** The model writes back with hidden tags (`[[goal:…]]`, `[[focus:…]]`, `[[reachout:…]]`…)
  that `Brain.ingest()` applies. Distractions can be added by talking to the orb; removing one only
  happens in the tray settings, on purpose.

## Shipping a version

Installers are built by `.github/workflows/release.yml` on GitHub's Windows and Mac machines and
attached to a GitHub release. The website's `/download` route sends each visitor to the latest one
for their OS (`SynapseSetup.exe` or `Synapse-mac.dmg`). Push a tag like `v0.1.1` to publish.
