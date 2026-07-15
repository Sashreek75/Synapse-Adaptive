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
import { Home, HeartPulse, Activity, CreditCard, Settings, FileText, BookOpen, Menu, X, LogOut, LogIn, Sun, LineChart, Target, Sparkles, MessageCircle } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";

type Ask = { label: string; icon: typeof Home; blurb: string; prompt: string };
type Room = { href: string; label: string; icon: typeof Home; blurb: string };

// Items that START A CONVERSATION — they inject a detailed prompt and send it.
const asks: Ask[] = [
  { label: "What should I focus on?", icon: Target, blurb: "The one thing that matters most today",
    prompt: "Based on everything you know about me and my recent check-ins, what is the single most important thing I should focus on right now, and why? Give me one clear next step." },
  { label: "Explain my numbers", icon: LineChart, blurb: "Make sense of my trends, plainly",
    prompt: "Walk me through my latest numbers — what's moving, what it actually means for me, and what I should do about it. Keep it plain and point out anything I might have missed." },
  { label: "My health profile", icon: HeartPulse, blurb: "Everything you understand about me",
    prompt: "Show me my health profile as you understand it right now: my goals, my habits and lifestyle, the patterns you've noticed, my strengths and challenges, and what you're still trying to figure out about me." },
  { label: "My playbook", icon: BookOpen, blurb: "What you've learned about how I work",
    prompt: "Walk me through my playbook — the durable things you've learned about how I work, what tends to help me and what sets me back, with the evidence behind each one." },
  { label: "My weekly session", icon: FileText, blurb: "This week's coaching sit-down",
    prompt: "Give me my weekly coaching session: how you read my week, my biggest win, what concerns you most, the one thing to focus on next, and the small experiment we should run." },
  { label: "Recommend an assessment", icon: Activity, blurb: "Only if it'd actually help",
    prompt: "Do you think I should take an assessment right now? If so, which one and exactly why it would help you understand me better. If not, tell me what you'd want to see first." },
];

// Items that OPEN a real, interactive surface.
const rooms: Room[] = [
  { href: "/dashboard", label: "Conversation", icon: Home, blurb: "Back to talking with Synapse" },
  { href: "/daily", label: "Daily check-in", icon: Sun, blurb: "Tell me about today" },
  { href: "/stats", label: "Your numbers", icon: LineChart, blurb: "The visual dashboard" },
  { href: "/assessments", label: "Assessments", icon: Activity, blurb: "Run a quick cognitive check" },
];

const manage: Room[] = [
  { href: "/billing", label: "Plan & billing", icon: CreditCard, blurb: "How deeply I get to reason" },
  { href: "/settings", label: "Settings", icon: Settings, blurb: "Preferences, data, privacy" },
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

          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted/70">Manage</p>
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
