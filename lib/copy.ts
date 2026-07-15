/**
 * THE EMOTIONAL LAYER  (founding doc §20.2)
 * -----------------------------------------
 * Centralized microcopy so tone is consistent, warm, and intentional
 * everywhere. Recovery is emotional; tiny wording differences make a massive
 * product difference. Reviewed with the same care as the safety layer.
 *
 * Rule: never cold, never clinical, never anxiety-inducing. Celebrate effort.
 */

export const copy = {
  reportReady: {
    title: "Nice work completing another check-in.",
    body: "Every assessment helps us understand your recovery a little better over time.",
  },
  assessmentDone: {
    title: "That's done — thank you for taking a few minutes for yourself today.",
    body: "I'll take a look at what changed and have a few thoughts for you shortly.",
  },
  coldStart: {
    title: "We're just getting to know your recovery.",
    body: "A couple more check-ins and patterns will start to come into focus. There's no rush.",
  },
  missedWeek: {
    title: "No worries if this week got away from you.",
    body: "Whenever you're ready, we'll pick up right where we left off.",
  },
  milestone: {
    title: "That's a milestone worth pausing on.",
    body: "Steady, consistent effort is exactly what moves recovery forward.",
  },
  greeting: (name: string, hour = new Date().getHours()) => {
    const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return `${part}, ${name}.`;
  },
  disclaimer:
    "Synapse Adaptive offers general wellness insights and education — it doesn't diagnose, treat, or replace your healthcare provider.",
} as const;
