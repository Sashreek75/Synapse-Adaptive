# Synapse — Navigation Audit ("every entry and exit")

*Goal: walk every screen and overlay and confirm the user always has a forward action and a way out — never a dead-end.*

## How navigation works here (the key fact)

Every route under the signed-in app (`/(app)/...`) is wrapped by one shell (`app/(app)/layout.tsx`) that **always** renders a top bar — the **Synapse logo links to `/dashboard`** — plus the hamburger **menu** (every room) and the **companion orb**. So no in-app page can be a hard trap: there is always a global way home and a global way to any room.

That means the only places a trap can hide are: (a) routes **outside** that shell (landing, login, update-password, admin), and (b) **full-screen overlays** that sit on top of the shell. Those got the closest look.

## Every screen

| Screen | Route | In shell? | Forward / exit | Verdict |
|---|---|:--:|---|---|
| Landing | `/` | — | "Open the app" → `/login`; anchors; nav | ✅ |
| Login | `/login` | — | Success → `/dashboard`; "Continue" when already signed in; sign-out | ✅ |
| Update password | `/update-password` | — | Success → `/dashboard`; **now** "Back to sign in" on error | ✅ **fixed** |
| Admin | `/admin` | — | Unlock → dashboard; **now** "← Back to Synapse" on the gate | ✅ **fixed** |
| Onboarding | `/onboarding` | shell (gated) | Finish → `/goals`; Continue enabled once valid | ✅ |
| Goals list | `/goals` | shell | **now** "Continue to Synapse →"; cards → goal detail; top bar | ✅ **fixed (earlier)** |
| Goal detail | `/goals/[id]` | shell | Back → `/goals`; "I've achieved this"; not-found has two buttons | ✅ |
| Home | `/dashboard` | shell | The conversation + orb + menu; check-in nudge | ✅ |
| Daily snapshot | `/daily` | shell | Both paths end with "Done for today → `/dashboard`" + "Talk this through" | ✅ |
| Weekly review | `/report` | shell | Pre-Sunday gate has "Back to today" + "show draft"; body in shell | ✅ |
| Progress | `/stats` | shell | Verdict + "Talk it through"; empty state → check-in; top bar | ✅ |
| Who You're Becoming | `/playbook` | shell | Empty state → check-in; top bar | ✅ |
| Spaces (list) | `/workspaces` | shell | Cards → detail; "Ask me for one" → conversation; top bar | ✅ |
| Space detail | `/workspaces/[id]` | shell | Back → `/workspaces`; not-found has "All spaces" + "Talk to Synapse" | ✅ |
| Settings | `/settings` | shell | Top bar; delete → reloads to `/dashboard` | ✅ |
| Billing | `/billing` | shell | Top bar / menu | ✅ |
| Retired routes | `/agent` `/profile` `/timeline` `/spaces` `/appointment-prep` `/assessments` `/tools` | — | All redirect to a live page | ✅ |

## Overlays (the other place traps hide)

| Overlay | Exit | Verdict |
|---|---|---|
| First-run tour | Skip + Next; final "Name your first goal" closes it onto `/goals` (which now has its own forward CTA) | ✅ |
| Focus companion | Persistent orb (with countdown ring) always re-opens the panel; panel has **End**, Break, +15, minimize, pop-out | ✅ |
| Companion orb | Toggle open/close on every page; proactive bubble has "Talk about it" + dismiss | ✅ |
| Auth gate | When signed out, redirects to `/` (shows a calm orb, never a stuck state) | ✅ |
| Onboarding gate | Forces `/onboarding` for new users by design; the flow always ends forward | ✅ |

## Traps found and fixed

1. **`/update-password` on an invalid/expired reset link** — outside the shell, it showed the error with no way out (you'd have to edit the URL). **Fixed:** added a "Back to sign in" link.
2. **`/admin` before you know the password (or after 5 lockout)** — outside the shell, no path back to the app. **Fixed:** added a "← Back to Synapse" link on the gate.
3. **`/goals` right after onboarding** *(the one you caught)* — no forward action once you'd added your goals. **Fixed earlier:** a "Continue to Synapse →" button.

## Not traps (verified, so you don't have to wonder)

- **Focus session** felt like the likeliest trap (the global orb hides during focus), but there's a persistent focus orb that always re-opens the panel, and the panel has a clear **End** — so you can always stop.
- **Daily check-in** ends with "Done for today," not a blank completion screen.
- **Every `/(app)` page** inherits the top-bar logo (→ home) and the menu, so even a page with an empty state can't strand you.

## Bottom line

Three real dead-ends existed; all three are fixed. The systemic reason the app is mostly safe is the always-present shell — the lesson is that the risk lives specifically on **out-of-shell routes and full-screen overlays**, so those are the two categories to check whenever a new one is added.
