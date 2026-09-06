"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";

/** Route-level error boundary — a calm, on-brand recovery screen instead of a raw stack trace. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log only in development; in production this would go to your error tracker.
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[80vh] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto w-fit"><SynapseOrb size={56} /></div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Something went wrong.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">That&apos;s on us, not you. Try again in a moment — your data is safe.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => reset()}><RotateCw className="h-4 w-4" /> Try again</Button>
          <Link href="/"><Button size="lg" variant="outline">Back to home</Button></Link>
        </div>
        {error?.digest && <p className="mt-6 text-xs text-muted/70">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
