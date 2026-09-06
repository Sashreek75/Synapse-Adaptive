import Link from "next/link";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="grid min-h-[80vh] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto w-fit"><SynapseOrb size={56} /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">This page wandered off.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">The link is broken or the page moved. Let&apos;s get you back to something useful.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/"><Button size="lg">Back to home</Button></Link>
          <Link href="/dashboard"><Button size="lg" variant="outline">Open the app</Button></Link>
        </div>
      </div>
    </div>
  );
}
