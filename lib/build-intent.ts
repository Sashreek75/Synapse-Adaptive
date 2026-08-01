/**
 * BUILD INTENT — recognizing "reshape the product for me".
 *
 * A companion that can adapt the software needs to notice when the user is asking for a new
 * tool or space ("build me an SAT mistake tracker", "make a mock interview", "I want a page
 * where we analyze my writing", "turn this into a habit tracker"). Deterministic and cheap —
 * no model call, no engine involvement. When it fires, the app composes a Workspace.
 */

const BUILD = /\b(build|make|create|set up|put together|design|generate|spin up|whip up)\b/i;
const ARTIFACT = /\b(tracker|dashboard|board|planner|workspace|space|page|tool|checklist|log|journal|template|system|tracker|mock interview|interview prep|study plan|habit tracker|planning board)\b/i;
const WANT_A = /\b(i want|i'?d like|i would like|can you|could you|help me (build|make|create|set up)|give me)\b.*\b(a|an|my|me a|me an)\b/i;
const TURN_INTO = /\bturn (this|it|that) into\b/i;

export function detectBuildIntent(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (TURN_INTO.test(t)) return true;
  if (BUILD.test(t) && ARTIFACT.test(t)) return true;
  // "I want a page where we analyze my writing" / "can you make me a ... "
  if (WANT_A.test(t) && ARTIFACT.test(t)) return true;
  return false;
}

/** Strip the request down to the thing being asked for, for a title/first message. */
export function buildRequestSummary(text: string): string {
  return (text || "").trim().replace(/\s+/g, " ").slice(0, 160);
}
