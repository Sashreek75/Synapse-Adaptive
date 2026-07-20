"use client";

/**
 * THE MENU — a way into the conversation, not a site map.
 *
 * Because the AI IS the product, most menu items don't navigate to a page — they
 * hand Synapse a prompt and start the conversation for you (your health profile,
 * your playbook, an assessment, your weekly session). A short "Go to" section
 * still opens the genuinely separate surfaces (check-in, the numbers dashboard,
 * billing, settings). Clicking a prompt drops you into chat with Synapse already
 * answering.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CreditCard, Settings, FileText, BookOpen, Menu, X, LogOut, LogIn, Target, Sparkles, MessageCircle, Timer, BarChart3 } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";

type Ask = { label: string; icon: typeof Home; blurb: string; prompt: string };
type Room = { href: string; label: string; icon: typeof Home; blurb: string };

// Items that START A CONVERSATION — they inject a detailed prompt and send it.
const asks: Ask[] = [
  { label: "What matters today?", icon: Target, blurb: "The one thing worth your energy",
    prompt: "Based on everything you know about me, what's the single most important thing I should focus on today, and why? Give me one clear next step." },
  { label: "Help me plan today", icon: BookOpen, blurb: "Turn it into a realistic plan",
    prompt: "Help me plan today. Look at what I'm working toward and my recent days, then propose a short, realistic plan — the few things that would actually make today count." },
  { label: "Help me think this through", icon: MessageCircle, blurb: "Reason through a decision",
    prompt: "I have a decision to think through. Ask me what it is, then help me reason it out — the tradeoffs, what fits my patterns, and your honest recommendation. Leave the choice to me." },
  { label: "What have you learned about me?", icon: Sparkles, blurb: "How you understand me",
    prompt: "Show me how you understand me right now: what I'm working toward, the patterns you've noticed, what tends to help me and what sets me back, and what you're still figuring out." },
  { label: "Talk through my week", icon: FileText, blurb: "Reason through your week together",
    prompt: "Give me my weekly review: how you read my week, my biggest win, what concerns you most, the one thing to focus on next, and the small experiment we should run." },
];

// Items that OPEN a real, interactive surface.
const rooms: Room[] = [
  { href: "/dashboard", label: "Talk", icon: Home, blurb: "Think it through with Synapse" },
  { href: "/tools", label: "Focus", icon: Timer, blurb: "Timer, checklist \u2014 get moving" },
  { href: "/playbook", label: "You", icon: Sparkles, blurb: "What Synapse understands about you" },
  { href: "/stats", label: "Your numbers", icon: BarChart3, blurb: "The trends behind what I notice" },
];

const manage: Room[] = [
  { href: "/report", label: "Weekly review", icon: FileText, blurb: "Our coaching sit-down" },
  { href: "/settings", label: "Settings", icon: Settings, blurb: "Preferences, data & privacy" },
  { href: "/billing", label: "Plan & billing", icon: CreditCard, blurb: "How deeply I reason" },
];

export function RoomsMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { email, signOut, configured } = useAuth();

  // The drawer must portal to <body>: the header uses backdrop-filter (glass),
  // which turns it into the containing block for position:fixed children — that
  // was clamping the drawer to the header's height and overlapping the footer.
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  // Hand Synapse a prompt: stash it, go to the conversation, and nudge the console.
  function askSynapse(prompt: string) {
    try { sessionStorage.setItem("synapse.pendingAsk", prompt); } catch {}
    setOpen(false);
    router.push("/dashboard#conversation");
    // If we're already on the conversation, the console won't remount — fire an event.
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent("synapse:ask")); } catch {} }, 80);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu"
        className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink">
        <Menu className="h-5 w-5" />
      </button>

      {mounted && createPortal((
        <>
          <div onClick={() => setOpen(false)}
            className={cn("fixed inset-0 z-[60] bg-navy-950/40 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "pointer-events-none opacity-0")}
            aria-hidden />

          <aside role="dialog" aria-modal="true"
            className={cn(
              "fixed inset-y-0 right-0 z-[70] flex h-[100dvh] w-[min(21rem,90vw)] flex-col border-l bg-surface shadow-lift transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
              open ? "translate-x-0" : "translate-x-full",
            )}>
            <div className="flex shrink-0 items-center justify-between px-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <SynapseOrb size={34} />
            <div>
              <p className="text-sm font-semibold text-ink">Synapse</p>
              <p className="inline-flex items-center gap-1 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> here with you</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70"><Sparkles className="h-3 w-3 text-orange-500" /> Ask Synapse</p>
          {asks.map((a) => <AskButton key={a.label} ask={a} onClick={() => askSynapse(a.prompt)} />)}

          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted/70">Go to</p>
          {rooms.map((r) => <RoomLink key={r.href} room={r} active={isActive(pathname, r.href)} />)}

          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted/70">More</p>
          {manage.map((r) => <RoomLink key={r.href} room={r} active={isActive(pathname, r.href)} />)}
        </nav>

        <div className="shrink-0 border-t px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 text-xs text-muted">
              {email ? <>Signed in as<br /><span className="truncate font-medium text-ink">{email}</span></> : "Using Synapse on this device"}
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-3">
            {email ? (
              <button onClick={async () => { await signOut(); router.replace("/"); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2">
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
      ), document.body)}
    </>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AskButton({ ask, onClick }: { ask: Ask; onClick: () => void }) {
  const { icon: Icon, label, blurb } = ask;
  return (
    <button onClick={onClick} className="group flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left text-ink transition-colors hover:bg-surface-2">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 group-hover:bg-surface">
        <Icon className="h-4 w-4 text-orange-500" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[12px] leading-snug text-muted">{blurb}</span>
      </span>
      <MessageCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function RoomLink({ room, active }: { room: Room; active: boolean }) {
  const { href, label, icon: Icon, blurb } = room;
  return (
    <Link href={href}
      className={cn("group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors", active ? "bg-navy-900 text-white" : "text-ink hover:bg-surface-2")}>
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
