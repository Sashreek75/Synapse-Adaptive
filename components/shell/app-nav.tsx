"use client";

/**
 * ROOMS — not navigation, a quiet drawer.
 *
 * The founding doc is emphatic: the homepage IS the conversation, and the AI
 * should demand attention, not the chrome. So there is no persistent sidebar and
 * no bottom tab bar competing with Synapse. Everything beyond the conversation is
 * a "room" you step into deliberately from this slide-over, then return to the
 * conversation. Each room earns its place by helping a health decision.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, HeartPulse, Activity, CreditCard, Settings, FileText, BookOpen, Menu, X, LogOut, LogIn, Sun, LineChart } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";

type Room = { href: string; label: string; icon: typeof Home; blurb: string };

const rooms: Room[] = [
  { href: "/dashboard", label: "Conversation", icon: Home, blurb: "Where you and Synapse think together" },
  { href: "/daily", label: "Daily check-in", icon: Sun, blurb: "Tell me about today — it's how I learn your patterns" },
  { href: "/stats", label: "Your numbers", icon: LineChart, blurb: "See the trends I'm watching, plainly" },
  { href: "/report", label: "Coaching session", icon: FileText, blurb: "The weekly sit-down — what I learned about you" },
  { href: "/playbook", label: "Playbook", icon: BookOpen, blurb: "What I've come to understand about how you work" },
  { href: "/profile", label: "Health profile", icon: HeartPulse, blurb: "The living picture of who you are" },
  { href: "/assessments", label: "Assessments", icon: Activity, blurb: "Only when I need better evidence" },
];

const manage: Room[] = [
  { href: "/billing", label: "Plan & billing", icon: CreditCard, blurb: "How deeply I get to reason for you" },
  { href: "/settings", label: "Settings", icon: Settings, blurb: "Preferences, data, and privacy" },
];

export function RoomsMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { email, signOut, configured } = useAuth();

  // Close on route change and on Escape — a drawer should never linger.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-navy-950/30 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[min(20rem,88vw)] flex-col border-l bg-surface shadow-lift transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-3">
            <SynapseOrb size={34} />
            <div>
              <p className="text-sm font-semibold text-ink">Synapse</p>
              <p className="inline-flex items-center gap-1 text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> here with you
              </p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {rooms.map((r) => <RoomLink key={r.href} room={r} active={isActive(pathname, r.href)} />)}
          <div className="my-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/70">Manage</div>
          {manage.map((r) => <RoomLink key={r.href} room={r} active={isActive(pathname, r.href)} />)}
        </nav>

        <div className="border-t px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 text-xs text-muted">
              {email ? <>Signed in as<br /><span className="truncate font-medium text-ink">{email}</span></> : "Using Synapse on this device"}
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-3">
            {email ? (
              <button
                onClick={async () => { await signOut(); router.replace("/"); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2"
              >
                <LogOut className="h-4 w-4 text-muted" /> Sign out
              </button>
            ) : (
              <Link href="/login" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2">
                <LogIn className="h-4 w-4 text-muted" /> {configured ? "Sign in" : "Account"}
              </Link>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">{copy.disclaimer}</p>
        </div>
      </aside>
    </>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RoomLink({ room, active }: { room: Room; active: boolean }) {
  const { href, label, icon: Icon, blurb } = room;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors",
        active ? "bg-navy-900 text-white" : "text-ink hover:bg-surface-2",
      )}
    >
      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl", active ? "bg-white/10" : "bg-surface-2 group-hover:bg-surface")}>
        <Icon className={cn("h-4 w-4", active ? "text-orange-400" : "text-navy-500")} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className={cn("block text-[12px] leading-snug", active ? "text-white/60" : "text-muted")}>{blurb}</span>
      </span>
    </Link>
  );
}
