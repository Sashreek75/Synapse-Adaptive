/**
 * THE EMOTIONAL LAYER
 * -------------------
 * Centralized microcopy so tone is consistent, warm, and intentional everywhere.
 * Becoming who you want to be is personal; tiny wording differences make a massive
 * product difference. Reviewed with the same care as the safety layer.
 *
 * Rule: never cold, never clinical, never anxiety-inducing. Celebrate effort.
 */

export const copy = {
  reportReady: {
    title: "Nice work completing another check-in.",
    body: "Every check-in helps me understand how you work a little better over time.",
  },
  assessmentDone: {
    title: "That's done — thank you for taking a few minutes for yourself today.",
    body: "I'll take a look at what changed and have a few thoughts for you shortly.",
  },
  coldStart: {
    title: "We're just getting to know you.",
    body: "A few check-ins and I'll start to see how you work — your rhythms, what helps, what doesn't. There's no rush.",
  },
  missedWeek: {
    title: "No worries if this week got away from you.",
    body: "Whenever you're ready, we'll pick up right where we left off.",
  },
  milestone: {
    title: "That's a milestone worth pausing on.",
    body: "Steady, consistent effort is exactly what moves you forward.",
  },
  greeting: (name: string, hour = new Date().getHours()) => {
    const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return `${part}, ${name}.`;
  },
  disclaimer:
    "Synapse reflects patterns from your own data, and it can be wrong — you always make the call.",
} as const;
