import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  Check,
  Compass,
  HeartPulse,
  LineChart,
  Lock,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SynapseOrb } from "@/components/synapse/orb";
import { NeuralBackground } from "@/components/marketing/neural-background";
import { Reveal } from "@/components/marketing/reveal";
import { PricingCTA } from "@/components/marketing/pricing-cta";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <StructuredData />
      <SiteHeader />
      <Hero />
      <Problem />
      <Solution />
      <AppleHealth />
      <HowItWorks />
      <AgentSpotlight />
      <Features />
      <Pricing />
      <Testimonials />
      <Roadmap />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b glass">
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
          <ThemeToggle />
          <Link href="/login">
            <Button size="sm">Open the app <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered ambient: mesh + grid + the neural brain network. */}
      <div className="absolute inset-0 mesh" />
      <div className="absolute inset-0 sa-grid" />
      <NeuralBackground className="absolute inset-0 h-full w-full" focus={{ x: 0.74, y: 0.42 }} />
      {/* Readability veils — soft on top, solid handoff into the next section. */}
      <div className="absolute inset-0 bg-gradient-to-r from-surface-2/85 via-surface-2/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-surface-2" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-20 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-28">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <div className="animate-fade-up mx-auto inline-flex items-center gap-2 rounded-full border bg-surface/80 px-4 py-1.5 text-sm text-muted shadow-soft backdrop-blur lg:mx-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
            </span>
            Not a chatbot — your partner in follow-through
          </div>

          <h1 className="animate-fade-up mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl xl:text-7xl">
            The support for your
            <span className="block sa-gradient-text">embarrassingly big goals.</span>
          </h1>

          <p className="animate-fade-up mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
            Synapse turns the goals you&apos;re almost afraid to say out loud into missions it
            helps you actually win — breaking each one down, hunting the real bottleneck, building
            the tools you need, and refusing to let it quietly slip.
          </p>

          <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/login">
              <Button size="lg" className="sa-shine">Meet Synapse <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline">How it works</Button>
            </a>
          </div>

          <div className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
            <span className="inline-flex items-center gap-1.5"><Timer className="h-4 w-4 text-navy-400" /> Turns goals into missions</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-navy-400" /> Builds the tools you need</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-navy-400" /> Private by design</span>
          </div>

          <p className="animate-fade-up mt-6 text-xs text-muted">
            Yours alone — private by design, and never sold.
          </p>
        </div>

        {/* Visual — Synapse present over its own neural field. */}
        <div className="relative mx-auto hidden h-[460px] w-full max-w-md lg:block">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <SynapseOrb size={148} />
          </div>

          <div className="absolute -right-2 top-8 w-72 sa-float">
            <div className="rounded-2xl border bg-surface/85 p-4 text-left shadow-lift glass">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                <Sparkles className="h-3 w-3" /> Synapse noticed
              </div>
              <p className="text-sm leading-relaxed text-ink">
                &ldquo;You said finishing the draft mattered this month. You&apos;ve shown up
                four evenings running — that&apos;s real momentum. Let&apos;s protect it.&rdquo;
              </p>
              <p className="mt-2 text-[11px] text-muted">From 6 weeks together · moderate confidence</p>
            </div>
          </div>

          <div className="absolute -left-4 bottom-16 w-60 sa-float-slow">
            <div className="rounded-2xl border bg-surface/85 p-4 text-left shadow-lift glass">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Today&apos;s focus</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">1 step</span>
              </div>
              <p className="mt-2 text-sm text-ink">One small step toward your goal today — the kind that keeps momentum alive.</p>
              <div className="mt-3 flex items-center gap-1.5">
                {[62, 78, 70, 84, 88, 92].map((v, i) => (
                  <span key={i} className="w-6 rounded-full bg-navy-200 dark:bg-navy-700" style={{ height: `${Math.max(8, v / 6)}px` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-surface/85 px-3.5 py-1.5 text-xs text-muted shadow-soft glass">
              <span className="sa-typing"><span /><span /><span /></span>
              Synapse is thinking about where you&apos;re headed…
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const qs = [
    "I know what I should do. Why don't I do it?",
    "I started strong. Where did it go?",
    "Who's actually keeping me accountable?",
    "Am I any closer than I was six months ago?",
  ];
  return (
    <Section>
      <Eyebrow>The gap</Eyebrow>
      <H2>You set out to become someone. Then ordinary life happens — and you&apos;re on your own.</H2>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        The problem was never a lack of information — you already know roughly what to do.
        What&apos;s missing is someone who remembers what you&apos;re working toward, notices
        when you slip, and keeps you honest. The questions that actually keep you up:
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {qs.map((q) => (
          <div key={q} className="rounded-2xl border bg-surface px-6 py-5 text-lg text-ink shadow-soft sa-card-hover">
            <span className="text-orange-500">“</span>{q}<span className="text-orange-500">”</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Solution() {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div className="absolute inset-0 sa-grid opacity-60" />
      <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <Eyebrow className="text-orange-300">The shift</Eyebrow>
          <H2 className="text-white">From a chatbot that forgets to a companion that remembers.</H2>
          <p className="mt-4 max-w-2xl text-lg text-navy-100/80">
            A generic AI answers your question and forgets you the moment you close it.
            Synapse stays. It comes to know you not to impress you with insight, but to help
            you keep moving toward what you actually want — and to notice, honestly, when
            you&apos;re drifting away from it.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: Brain, t: "Remembers what you're working toward", d: "Your goals, your commitments, what's worked and what hasn't — so nothing important quietly slips." },
              { icon: Compass, t: "Keeps you moving", d: "Notices when momentum builds and when it fades, then offers one honest, doable next thing — accountability, not nagging." },
              { icon: ShieldCheck, t: "Honest enough to challenge you", d: "Shows its reasoning, admits what it doesn't know, and pushes back when you're drifting from what you said you wanted." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur transition-colors hover:bg-white/[0.08]">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/15">
                  <Icon className="h-5 w-5 text-orange-300" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-100/70">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: MessageCircleQuestion, t: "Just talk to it", d: "Tell Synapse what you're working toward and what's in the way. No forms, no fixed surveys — an honest conversation with someone who remembers." },
    { icon: Brain, t: "It stays with you", d: "Every conversation deepens what it understands about you — a private picture of what actually moves you, and what pulls you off course." },
    { icon: CalendarCheck, t: "You keep moving", d: "One clear next step, the reason behind it, and a companion who'll notice next time whether you followed through." },
  ];
  return (
    <Section id="how">
      <Eyebrow>How it works</Eyebrow>
      <H2>Talk. Commit. Keep moving.</H2>
      <div className="relative mt-12 grid gap-6 md:grid-cols-3">
        <div className="absolute left-[16%] right-[16%] top-11 hidden border-t border-dashed border-line md:block" />
        {steps.map(({ icon: Icon, t, d }, i) => (
          <div key={t} className="relative rounded-2xl border bg-surface p-7 shadow-soft sa-card-hover">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-ink">{t}</h3>
            <p className="mt-2 leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AgentSpotlight() {
  return (
    <Section id="agent" className="bg-surface">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>The heart of the product</Eyebrow>
          <H2>Synapse notices things — before you ask.</H2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Synapse reasons like a coach who knows you, not a chatbot. It remembers what
            you&apos;ve told it, watches your momentum across weeks, and opens the
            conversation when it matters — to keep you moving, or to gently call it when
            you&apos;re drifting.
          </p>
          <ul className="mt-7 space-y-3.5 text-ink">
            {[
              "Remembers your goals, your commitments, and what's worked before",
              "Protects your momentum — and notices, honestly, when it's slipping",
              "Ends with one clear next step, and holds you to it with care",
            ].map((x) => (
              <li key={x} className="flex gap-3">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orange-100 dark:bg-orange-500/15">
                  <Check className="h-3 w-3 text-orange-600 dark:text-orange-300" />
                </span>
                <span className="text-muted">{x}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sample proactive notice — the product's signature moment */}
        <div className="rounded-3xl border bg-surface-2 p-2 shadow-lift">
          <div className="rounded-2xl border bg-surface p-7">
            <div className="flex items-center gap-3">
              <SynapseOrb size={36} />
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                <Sparkles className="h-3.5 w-3.5" /> Synapse noticed
              </div>
            </div>
            <p className="mt-4 text-lg leading-relaxed text-ink">
              “You told me finishing the book proposal mattered this month. You&apos;ve
              shown up four evenings running — that&apos;s real momentum, not luck.
              Want to make protecting those evenings this week&apos;s
              commitment?”
            </p>
            <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <LineChart className="h-4 w-4" /> Based on 5 weeks of your check-ins
              </span>
              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                Moderate confidence
              </span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Features() {
  const f = [
    { icon: Sparkles, t: "Conversation-first", d: "The whole app is one ongoing conversation with a companion who remembers — ask anything, anytime." },
    { icon: Brain, t: "A relationship that compounds", d: "It remembers your goals, your commitments, and what's actually moved you — so it deepens instead of resetting." },
    { icon: HeartPulse, t: "Guidance that fits your life", d: "Thoughtful, honest advice shaped by who you are and what you're working toward — never a generic tip." },
    { icon: MessageCircleQuestion, t: "Accountability, not nagging", d: "It speaks up when your momentum's at stake and stays quiet when it isn't — the way a good friend would." },
    { icon: LineChart, t: "Protects your momentum", d: "It watches whether you're truly moving toward what you said you wanted, and helps you course-correct early." },
    { icon: ShieldCheck, t: "Private, synced, yours", d: "Follows you across devices in your account, never sold, and yours to export or delete." },
  ];
  return (
    <Section id="features">
      <Eyebrow>Features</Eyebrow>
      <H2>Everything in service of one question.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Does this help you become who you&apos;re trying to become? If not, it isn&apos;t here.
      </p>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {f.map(({ icon: Icon, t, d }) => (
          <div key={t} className="group rounded-2xl border bg-surface p-7 shadow-soft sa-card-hover">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-100 text-navy-600 transition-colors group-hover:bg-orange-100 group-hover:text-orange-600 dark:bg-navy-800 dark:text-navy-300 dark:group-hover:bg-orange-500/15 dark:group-hover:text-orange-300">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-semibold text-ink">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Testimonials() {
  const t = [
    { t: "It shows its work", d: "Every insight comes with the reasoning behind it and an honest confidence level — never a number with no explanation." },
    { t: "Honest about uncertainty", d: "When the data is thin or noisy, it says so and holds back, rather than sounding more sure than it should." },
    { t: "Your data is yours", d: "Stored privately, never sold. Export or delete everything at any time." },
  ];
  return (
    <Section className="bg-surface">
      <Eyebrow>Why you can trust it</Eyebrow>
      <H2>Built to earn your trust, not just your attention.</H2>
      <p className="mt-3 max-w-2xl text-muted">We&apos;re early, so instead of putting words in users&apos; mouths, here&apos;s what the product actually commits to.</p>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {t.map(({ t, d }) => (
          <div key={t} className="rounded-2xl border bg-surface-2 p-7 sa-card-hover">
            <h3 className="font-semibold text-ink">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Roadmap() {
  const r = [
    { phase: "Now", t: "The companion", d: "Conversation-first coaching, a memory that compounds, proactive accountability, and a relationship that keeps you moving toward what you want." },
    { phase: "Next", t: "Deeper context", d: "Optional imports — calendar, wearables — to enrich the picture." },
    { phase: "Later", t: "Alongside your world", d: "Working with the people and tools you already rely on." },
  ];
  return (
    <Section>
      <Eyebrow>Roadmap</Eyebrow>
      <H2>Where we&apos;re headed.</H2>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {r.map(({ phase, t, d }) => (
          <div key={t} className="rounded-2xl border bg-surface p-7 shadow-soft sa-card-hover">
            <span className="rounded-full bg-navy-900 px-3 py-1 text-xs font-semibold text-white dark:bg-navy-100 dark:text-navy-900">{phase}</span>
            <h3 className="mt-5 text-lg font-semibold text-ink">{t}</h3>
            <p className="mt-2 leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FAQ() {
  const faqs = [
    { q: "How is this different from ChatGPT or Apple Health's AI?", a: "A general AI answers your question and forgets you. A tracker shows you numbers. Synapse is a companion for the long run: it remembers what you're working toward, notices when you drift, and keeps you moving toward it — week after week. The point isn't insight; it's real progress." },
    { q: "How does it handle uncertainty?", a: "Honestly. Synapse states a confidence level, admits when it's unsure, and would rather say 'worth keeping an eye on' than overclaim. When something's beyond it, it says so and points you toward real help." },
    { q: "What do I actually do in the app?", a: "Mostly just talk to it — like texting a coach who remembers everything. Set what you're working toward, check in when you can, and let it keep you honest and moving. The relationship deepens the more you use it." },
    { q: "Who can see my data, and does it follow me across devices?", a: "Only you. Your data syncs privately to your account so it follows you between phone and computer, is never sold, and you can export or delete it anytime." },
  ];
  return (
    <Section id="faq" className="bg-surface">
      <Eyebrow>FAQ</Eyebrow>
      <H2>Good questions.</H2>
      <div className="mt-10 divide-y overflow-hidden rounded-2xl border bg-surface shadow-soft">
        {faqs.map(({ q, a }) => (
          <details key={q} className="group p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ink">
              {q}
              <span className="ml-4 text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function CTA() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl border bg-navy-900 px-8 py-16 text-center text-white sm:py-20">
        <div className="absolute inset-0 mesh opacity-60" />
        <div className="absolute inset-0 sa-grid opacity-50" />
        <div className="relative">
          <div className="mx-auto mb-7 w-fit"><SynapseOrb size={72} /></div>
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet the support for your embarrassingly big goals.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-100/80">
            Name the goal you keep putting off. Synapse turns it into a mission it helps you
            win — the plan, the tools, the accountability — and won&apos;t let it quietly disappear.
          </p>
          <Link href="/login" className="mt-9 inline-block">
            <Button size="lg" className="sa-shine">Meet Synapse <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row">
          <div>
            <div className="flex items-center gap-2.5 font-semibold text-ink">
              <SynapseOrb size={28} />
              Synapse Adaptive
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              The companion that brings accountability, clarity, and support until your goals become reality.
            </p>
          </div>
          <div className="text-sm text-muted">
            <p className="font-medium text-ink">Product</p>
            <ul className="mt-3 space-y-2">
              <li><a href="#how" className="transition-colors hover:text-ink">How it works</a></li>
              <li><a href="#agent" className="transition-colors hover:text-ink">Meet Synapse</a></li>
              <li><Link href="/login" className="transition-colors hover:text-ink">Demo</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-12 max-w-3xl text-xs leading-relaxed text-muted">
          Synapse Adaptive is a companion for personal progress and reflection. It supports
          your own decisions, reflects your data rather than professional advice, and
          isn&apos;t a substitute for medical, legal, or financial guidance. In an emergency,
          contact your local emergency services.
        </p>
        <p className="mt-4 text-xs text-muted">© {new Date().getFullYear()} Synapse Adaptive.</p>
      </div>
    </footer>
  );
}

function AppleHealth() {
  const rows = [
    ["When you open it", "A wall of numbers and charts", "A companion who remembers what you're working toward"],
    ["When something slips", "You notice — eventually, maybe", "It notices, and gently calls it before you drift"],
    ["Does it know you?", "No — every user sees the same app", "Yes — an evolving relationship, built around your goals"],
    ["What you leave with", "More data", "Real momentum — one honest next step at a time"],
  ];
  return (
    <Section>
      <Eyebrow>The difference</Eyebrow>
      <H2>A tracker tells you what happened. Synapse helps you do something about it.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">Trackers are repositories. Synapse Adaptive is a companion that remembers what you want and keeps you moving toward it.</p>
      <div className="mt-12 overflow-hidden rounded-2xl border bg-surface shadow-soft">
        <div className="grid grid-cols-3 border-b bg-surface-2 text-sm font-semibold text-ink">
          <div className="p-4" />
          <div className="p-4 text-muted">A typical tracker</div>
          <div className="p-4 text-orange-600 dark:text-orange-400">Synapse Adaptive</div>
        </div>
        {rows.map(([k, a, b], i) => (
          <div key={i} className="grid grid-cols-3 border-b text-sm last:border-0">
            <div className="p-4 font-medium text-ink">{k}</div>
            <div className="p-4 text-muted">{a}</div>
            <div className="p-4 text-ink">{b}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Pricing() {
  return (
    <Section id="pricing" className="bg-surface">
      <Eyebrow>Pricing</Eyebrow>
      <H2>Everyone gets the guidance. Pro &amp; Max get it every day.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">Free is genuinely useful — no card needed.</p>

      {/* The real value axis, stated plainly: weekly insight is free; daily is the upgrade. */}
      <div className="mt-6 max-w-3xl rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-surface p-6 shadow-soft dark:border-orange-500/20 dark:from-orange-500/5 dark:to-surface">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
          <Sparkles className="h-3.5 w-3.5" /> What you actually get
        </div>
        <p className="mt-3 text-lg leading-relaxed text-ink">
          <b>Every plan — free included — gets a full weekly read:</b> what Synapse noticed about
          your momentum and where to put your energy next week. That value is never paywalled.
        </p>
        <p className="mt-2 text-lg leading-relaxed text-muted">
          The real difference with <b className="text-ink">Pro</b> and <b className="text-ink">Max</b>?
          You get that same &ldquo;here&apos;s what I noticed, here&apos;s what I&apos;d do&rdquo; guidance
          <b className="text-ink"> every single day</b> — proactively, right in the conversation — plus the ability
          to reason it through with Synapse anytime. Daily guidance is the upgrade.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          return (
            <div key={id} className={`relative flex flex-col rounded-3xl border bg-surface p-7 shadow-soft sa-card-hover ${p.popular ? "ring-2 ring-orange-400 sa-border-glow on" : ""}`}>
              {p.popular && <div className="absolute right-4 top-4 rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">Most popular</div>}
              <h3 className="text-lg font-semibold text-ink">{p.name}</h3>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-ink">{p.priceLabel}<span className="text-base font-normal text-muted">{p.cadence === "monthly" ? "/mo" : ""}</span></p>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.highlights.map((h) => (<li key={h} className="flex items-start gap-2 text-sm text-muted"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {h}</li>))}
              </ul>
              <PricingCTA planId={id} />
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs text-muted">Prices in USD. Cancel anytime. Private by design — your data is yours.</p>
    </Section>
  );
}

/* ── SEO: structured data so search engines understand what Synapse is ──── */
function StructuredData() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app";
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Synapse Adaptive",
        url: base,
        description: "An AI accountability partner and goal operating system that helps people follow through and achieve their goals.",
      },
      {
        "@type": "WebSite",
        name: "Synapse Adaptive",
        url: base,
      },
      {
        "@type": "SoftwareApplication",
        name: "Synapse Adaptive",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web, iOS, Android",
        description:
          "Synapse is an AI accountability partner and goal operating system. It remembers what you're working toward, helps you lock in and follow through, breaks big goals into campaigns, adapts when life changes, and never lets your important goals quietly disappear.",
        url: base,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

/* ── small layout helpers ─────────────────────────────────────────────── */
function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`}>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}
function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 ${className}`}>{children}</p>;
}
function H2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl ${className}`}>{children}</h2>;
}
