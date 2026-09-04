"use client";

/**
 * LANDING HEADER — hidden during the scroll cinematic, slides in once you've flown through and reached
 * the actual landing page. (Scroll-threshold based; the cinematic runway is ~4.6 viewports tall.)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 3.4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-50 border-b glass transition-all duration-500 ease-out",
      show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
    )}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
          <SynapseOrb size={30} />
          Synapse Adaptive
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-ink">How it works</a>
          <a href="#agent" className="transition-colors hover:text-ink">Meet Synapse</a>
          <a href="#features" className="transition-colors hover:text-ink">Features</a>
          <a href="#pricing" className="transition-colors hover:text-ink">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button size="sm">Open the app <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
