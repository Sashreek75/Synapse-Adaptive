"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The standalone Focus page is gone. Focus is just one of the tools Synapse builds on demand,
 * invoked from any conversation via the orb — it is a capability, not a destination. This route
 * now returns people to the conversation.
 */
export default function ToolsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return <div className="py-12 text-center text-sm text-muted">Taking you to Synapse…</div>;
}
