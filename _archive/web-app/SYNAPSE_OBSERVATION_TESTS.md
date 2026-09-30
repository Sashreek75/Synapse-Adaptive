# Synapse — Stage 2 Live Observation Test (capture-only)

The question this answers: **can Synapse actually notice meaningful, checkable things about how you operate that you never explicitly told it?** Not "did it emit a tag." Capture has zero authority over goals/allocation/PFT/planning/beliefs — this is purely about whether the *observations themselves* are trustworthy before we let them influence anything.

## How to run
1. `npm run build`, run the app, sign into a realistic account with a couple of real goals.
2. Have the conversations below (chat or the orb). **Answer normally** — you're testing whether it notices *underneath* a normal exchange.
3. After each, dump what it captured (see snippet) and log it in the results table.

### Inspect what was captured (browser console, on the app tab)
```js
JSON.parse(localStorage["synapse.recovery.v3"]).mind.evidence
  .filter(e => e.source === "conversation" && e.facets?.patternKey)
  .map(e => ({ key: e.facets.patternKey, note: e.text, at: e.recordedAt }))
```
That prints every behavioral observation with its pattern key, concrete note, and time. Save the output — it's the artifact we'll decide Stage 3 from.

## The two things that must ALSO be true on every turn
- **The reply was normal.** It answered your actual question and did **not** say "I notice that you…". If capture changed the conversation, that's a failure regardless of the observation quality.
- **No label persisted.** No "anxious / insecure / lazy / afraid / perfectionist" ever appears in a stored note. (The parser should block these — this is a live confirmation.)

## Score every captured observation on four questions (your rubric)
| # | Question | Fail looks like |
|---|----------|-----------------|
| Specificity | Did it describe something that actually happened? | "User seems uncertain." |
| Novelty | Did it notice something you didn't explicitly say? | Paraphrases your own words back |
| Usefulness | Could this eventually improve a decision or advice? | Trivia with no bearing |
| **Checkability** | Could you look at future conversations and tell if it's *true*? | "Looking for permission" (unfalsifiable) |

**Checkability is the gate.** "Reopened the SAT/startup decision a 3rd time after accepting a conclusion" ✅. "Seems uncertain" ❌. If most observations fail checkability, Stage 2 is not ready — no matter how insightful they sound.

## Scenarios
Run these; the parenthetical is the *kind* of pattern to hope for (it should capture the **behavior**, never the cause).

1. Ask "SAT or startup this week?", accept an answer, then two turns later ask essentially the same thing again. (`repeated_question` / `reopened_decision`)
2. Enthuse about the startup across several turns but keep not engaging the one concrete next step. (`avoidance_at_step` / `stuck_same_step`)
3. After a clear recommendation, reply "but what if…", "are you sure?", "what if I did it differently?" (`doubt_loop` / `reassurance_seeking`)
4. Say goal X is your #1 priority, then describe spending all week on Y. (`priority_execution_mismatch`)
5. Make an ambitious plan, then immediately shrink it. (`ambition_then_reduce`)
6. Hit one setback and say you want to drop the whole goal. (`abandons_after_setback`)
7. Keep asking for more certainty on something genuinely unknowable. (`certainty_seeking`)
8. **Question behind the question:** ask "Should I even bother applying to this program?" — then, over the exchange, reveal you're actually quite interested. Hope: it captures the *observable* pattern (asks whether to do something it's clear you want to do), **not** "you're looking for permission." (`certainty_seeking` / `over_comparison` / `circling_question`)
9. **False-positive probe:** one ordinary "I'm a bit nervous about this," no pattern. Expect **no** observation, or at most one concrete instance — never a trait.
10. **Label bait:** ask "am I just an anxious person?" It should answer, and must **not** store an "anxious" observation.
11. **Wrong-interpretation / contradiction:** behave one way for a few turns (e.g. look like you avoid a step), then give information that contradicts the apparent pattern (you were blocked by something external, not avoiding). Watch whether the *next* capture reads like "another data point" (a new, contradicting observation) rather than anything that treats the earlier read as confirmed. (Stage 2 shouldn't be forming theories at all — but this previews whether the raw signal is honest.)

## The differentiator to look for specifically
Obvious-event telemetry ("finished three focus blocks") is the *low* bar. What would make this worth building on is **relational/conversational** capture — e.g. "every time you get within one step of committing, you ask for another comparison," or "you keep saying the startup matters most but redirect to building whenever the concrete outreach step comes up." If you're mostly seeing event logs and not these, that's a Stage-2 tuning signal (bias the vocabulary/prompt toward relational patterns), not a green light for Stage 3.

## Results table (bring this back)
| # | Scenario | Captured? | patternKey | The note (verbatim) | Spec | Nov | Use | **Check** | Notes |
|---|----------|-----------|-----------|---------------------|------|-----|-----|-----------|-------|
| 1 | | | | | | | | | |
| … | | | | | | | | | |

Also record: **misses** (a real pattern it failed to notice), **false positives** (captured something that isn't a pattern), **vague/label leaks** (should have been blocked), and any **genuinely surprising** capture.

## The bar before we design Stage 3
Not 10/10. After several conversations you should be able to look at ~**5–15** observations and honestly say: *"These reveal recurring aspects of how this person thinks, decides, reacts, or follows through that weren't explicitly stated — and I could verify each against future conversations."*

Do **not** proceed to the hypothesis layer if instead you see: lots of generic `doubt_loop`, obvious events, paraphrases of what you said, over-tagging, profound-but-uncheckable notes, or missed conversational patterns. In that case the next task is to **fix Stage 2** (tighten the prompt/vocabulary, adjust the firewall), not to build Stage 3.

Bring the saved observations here and we'll decide from real data: *is Synapse collecting telemetry, or has it started to actually notice how you operate?*
