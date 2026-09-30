/**
 * GAPS — the things Synapse needs to know before it can actually do its job. When a critical one is
 * open, Synapse says so plainly instead of pretending. This is the honesty layer that makes it feel
 * like the app knows what it's missing. Add new gaps here; the surface renders the single most
 * important open one.
 */

export type GapId = "no-goals";

export interface Gap { id: GapId; title: string; body: string; cta: string; to: string }

export function detectTopGap(input: { onboarded: boolean; goalsCount: number }): Gap | null {
  // Can't prioritize, protect, or reason about "what first" with nothing to aim at.
  if (input.onboarded && input.goalsCount === 0) {
    return {
      id: "no-goals",
      title: "I can't prioritize anything for you yet",
      body: "I don't know what you're actually working toward — so I can't tell you what to do first, or protect the right thing when your time gets tight. Name one goal and I'll take it from there.",
      cta: "Name your first goal",
      to: "/goals",
    };
  }
  return null;
}
