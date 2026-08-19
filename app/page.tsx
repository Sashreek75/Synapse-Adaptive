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
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { Reveal } from "@/components/marketing/reveal";
import { PricingCTA } from "@/components/marketing/pricing-cta";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <StructuredData />
      <SiteHeader />
      <Hero />
      {/* MOBILE gets a short, breathable funnel: hero → the one punchy idea → 3 steps → pricing → CTA.
          Everything heavier is desktop-only so a phone isn't handed a research paper to scroll. */}
      <div className="hidden md:block"><Problem /></div>
      <Solution />
      <SynapseFlow />
      <div className="hidden md:block"><AppleHealth /></div>
      <HowItWorks />
      <div className="hidden md:block"><AgentSpotlight /></div>
      <div className="hidden md:block"><Features /></div>
      <Pricing />
      <div className="hidden md:block"><Testimonials /></div>
      <div className="hidden md:block"><Roadmap /></div>
      <div className="hidden md:block"><FAQ /></div>
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
    <section className="hero-bg relative overflow-hidden">
      {/* Clean, blended navy+white+orange field (see .hero-bg) with a whisper of grid for depth. */}
      <div className="absolute inset-0 sa-grid opacity-30" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-surface-2" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-20 sm:pt-24 lg:grid-cols-[1fr_1.05fr] lg:pb-28 lg:pt-28">
        {/* Copy — sparse and confident. */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-surface/50 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Decision intelligence, for one person — you
          </div>

          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:mt-6 sm:text-5xl sm:leading-[1.04] lg:text-6xl">
            An AI that learns how you <span className="sa-gradient-text">actually operate.</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
            Synapse learns from how you decide, work, and follow through — then helps you put your
            limited attention where it actually counts, and stays with you until intention becomes done.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link href="/login"><Button size="lg">Start with Synapse <ArrowRight className="h-4 w-4" /></Button></Link>
            <a href="#how" className="text-sm font-medium text-muted transition-colors hover:text-ink">See how it works →</a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted sm:mt-9">
            <span className="inline-flex items-center gap-1.5"><Compass className="h-4 w-4 text-navy-400" /> One clear next step</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-navy-400" /> Learns your patterns</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-navy-400" /> Private by design</span>
          </div>

          {/* Mobile/tablet get a clean upright product card so the hero isn't text-only. */}
          <HeroProductVizMobile />
        </div>

        <HeroProductViz />
      </div>
    </section>
  );
}

/** A dark, sophisticated product visualization — a slice of the Synapse interface (a real exchange +
 * the contextual state around it) with thin annotation callouts. Built from markup, no stock art,
 * no robot. Desktop only; the mobile hero leads with the copy. */
function HeroProductViz() {
  return (
    <div className="relative mx-auto hidden w-full max-w-md lg:block [perspective:2000px]">
      {/* A floating, tilted slice of the real Synapse UI — a product shot, not stock art. It eases
          toward flat on hover, so it feels alive without spinning. */}
      <div className="relative overflow-hidden rounded-2xl border bg-surface shadow-lift transition-transform duration-700 ease-out [transform:rotateY(-17deg)_rotateX(7deg)_rotate(1deg)] hover:[transform:rotateY(-7deg)_rotateX(3deg)]">
        <div className="flex">
          {/* slim app rail */}
          <div className="flex w-12 shrink-0 flex-col items-center gap-4 border-r bg-surface-2/60 py-4">
            <SynapseOrb size={22} />
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-line" />
            <span className="h-1.5 w-1.5 rounded-full bg-line" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <span className="text-sm font-semibold text-ink">Talk</span>
              <span className="ml-auto text-[11px] text-muted">Thursday · evening</span>
            </div>
            <div className="space-y-3.5 p-4">
              <div className="flex justify-end">
                <p className="max-w-[82%] rounded-2xl rounded-br-md border bg-surface-2 px-3.5 py-2 text-[13px] leading-relaxed text-ink">
                  Should I focus on the SAT or my startup this week?
                </p>
              </div>
              <p className="text-[13px] leading-relaxed text-ink/90">
                I&apos;d protect the SAT this week — the test is close and you&apos;re a little behind
                target. The startup has real momentum, so it can hold with one small move.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <StateChip label="Protecting" value="SAT · 12 days" accent />
                <StateChip label="Maintaining" value="Startup" />
                <StateChip label="Decision" value="logged · moderate" />
                <StateChip label="Noticed" value="reopened 2×" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thin annotations — a quiet product walkthrough, not colorful labels. */}
      <Annotation className="-left-4 top-14">Understands context</Annotation>
      <Annotation className="-right-4 top-[46%]">Learns from behavior</Annotation>
      <Annotation className="-left-3 bottom-12">Tracks its decisions</Annotation>
    </div>
  );
}

/** Upright, untilted product card for phones/tablets (the tilted one is desktop-only), so the mobile
 * hero still leads with a real product visual rather than text alone. */
function HeroProductVizMobile() {
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border bg-surface shadow-lift lg:hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SynapseOrb size={22} />
        <span className="text-sm font-semibold text-ink">Talk</span>
        <span className="ml-auto text-[11px] text-muted">evening</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-md border bg-surface-2 px-3.5 py-2 text-[13px] leading-relaxed text-ink">
            SAT or my startup this week?
          </p>
        </div>
        <p className="text-[13px] leading-relaxed text-ink/90">
          I&apos;d protect the SAT — the deadline&apos;s close and you&apos;re behind target. The
          startup has momentum, so it can hold with one small move.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StateChip label="Protecting" value="SAT · 12 days" accent />
          <StateChip label="Maintaining" value="Startup" />
        </div>
      </div>
    </div>
  );
}

function StateChip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2", accent ? "border-orange-500/30 bg-orange-500/5" : "bg-surface-2")}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-xs font-medium", accent ? "text-orange-300" : "text-ink")}>{value}</p>
    </div>
  );
}

function Annotation({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("absolute z-10 inline-flex items-center gap-1.5 rounded-full border bg-surface/80 px-2.5 py-1 text-[11px] text-muted shadow-soft backdrop-blur", className)}>
      <span className="h-1 w-1 rounded-full bg-orange-500" />{children}
    </span>
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
      <Eyebrow>The real problem</Eyebrow>
      <H2>You don&apos;t stall because you&apos;re lazy. You stall because you&apos;re not sure.</H2>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        You already know roughly what to do. What stops you is uncertainty — is this the right
        thing? am I making progress? what am I missing? — and uncertainty turns into hesitation,
        hesitation into another lost week. What&apos;s missing isn&apos;t information. It&apos;s
        someone who removes the doubt and keeps you moving. The questions that actually stall you:
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
          <Eyebrow className="text-orange-300">What Synapse gives you</Eyebrow>
          <H2 className="text-white">Everything a great coach gives you — four things, every day.</H2>
          <p className="mt-4 max-w-2xl text-lg text-navy-100/80">
            A generic AI answers a question and forgets you the moment you close it. Synapse stays,
            and it does the four things that actually move you from intention to done.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Compass, t: "Direction", d: "It cuts through the noise to the single highest-leverage thing to work on — so your energy goes where it actually counts, not everywhere at once." },
              { icon: Sparkles, t: "Clarity", d: "It reduces the uncertainty until the next step is obvious: one clear action, and the reason behind it. You always know exactly what to do next." },
              { icon: ShieldCheck, t: "Accountability", d: "It remembers what you committed to, notices when you drift, and follows up — and stays honest with you. Accountability, never nagging." },
              { icon: HeartPulse, t: "Support", d: "When a plan, a tool, or a push would help, it's there — breaking the hard thing down and building what you need to actually get through it." },
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
    { icon: MessageCircleQuestion, t: "Tell it what you're chasing", d: "Name a goal — even the embarrassingly big one. No forms, no surveys. Just say what you want; it learns the rest as you talk." },
    { icon: Compass, t: "It finds the one thing", d: "Synapse cuts your goal down to the single highest-leverage next step, and tells you why that's the move right now — not a to-do list, one clear action." },
    { icon: CalendarCheck, t: "It keeps you moving", d: "It follows up, notices when you drift, and builds what you need to get unstuck — staying with you until it's actually done." },
  ];
  return (
    <Section id="how">
      <Eyebrow>How it works</Eyebrow>
      <H2>Say the goal. See the one thing. Follow through.</H2>
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
      <div className="relative overflow-hidden rounded-3xl border bg-navy-900 px-6 py-14 text-center text-white sm:px-8 sm:py-20">
        <div className="absolute inset-0 mesh opacity-60" />
        <div className="absolute inset-0 sa-grid opacity-50" />
        <div className="relative">
          <div className="mx-auto mb-7 w-fit"><SynapseOrb size={72} /></div>
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet the partner who makes your next step obvious.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-100/80">
            Name the goal you keep putting off. Synapse gives you the direction to know where to
            aim, the clarity to know what&apos;s next, the accountability to keep at it, and the
            support to get through the hard part — and won&apos;t let it quietly disappear.
          </p>
          <Link href="/login" className="mt-9 inline-block">
            <Button size="lg">Start with Synapse <ArrowRight className="h-4 w-4" /></Button>
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
              Your partner in follow-through — clarity, direction, accountability, and support until your goals become who you are.
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
    ["When you open it", "A long list of everything you could do", "The one thing that matters most today"],
    ["When something slips", "Nothing happens — it just waits for you", "It notices, and reaches out before you drift"],
    ["Does it know you?", "No — every user gets the same app", "Yes — it learns what actually moves you"],
    ["What you leave with", "More tasks", "One clear next step, and the reason behind it"],
  ];
  return (
    <Section>
      <Eyebrow>The difference</Eyebrow>
      <H2>A to-do app holds your tasks. Synapse helps you actually do them.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">Lists and trackers are storage. Synapse is a partner: it gives you direction, makes the next step clear, and keeps you accountable to it.</p>
      <div className="mt-12 overflow-hidden rounded-2xl border bg-surface shadow-soft">
        <div className="grid grid-cols-3 border-b bg-surface-2 text-sm font-semibold text-ink">
          <div className="p-4" />
          <div className="p-4 text-muted">A typical to-do app</div>
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
        description: "An AI partner in follow-through that gives people the clarity, direction, accountability, and support to consistently reach the goals that matter most.",
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
          "Synapse is an AI partner in follow-through. It cuts the overwhelm down to the one thing that matters most, makes the next step obvious, keeps you accountable, and gives you the support to get through the hard part — so your intentions become outcomes.",
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

/* THE SYNAPSE IDEA — the narrative spine: how a conversation becomes a better decision. */
function SynapseFlow() {
  const steps: { k: string; d: string }[] = [
    { k: "Conversation", d: "You talk to Synapse the way you'd talk to a sharp friend — about a decision, a goal, or whatever's in the way." },
    { k: "Observation", d: "It quietly notices how you operate: where you hesitate, what you reopen, when you actually follow through." },
    { k: "Understanding", d: "Those observations build into a model of how you really work — held as evidence, never as labels." },
    { k: "Better decisions", d: "So when it says “protect this, let that wait,” it's grounded in you — and it changes its mind when you change." },
  ];
  return (
    <Section className="bg-surface-2">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow className="mx-auto">The idea</Eyebrow>
        <H2 className="mx-auto">Most AI answers the question. Synapse understands the person asking it.</H2>
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.k} className="relative rounded-2xl border bg-surface p-5">
            <span className="text-[11px] font-semibold tracking-wider text-orange-400">0{i + 1}</span>
            <p className="mt-2 text-base font-semibold text-ink">{s.k}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute right-[-10px] top-1/2 hidden h-px w-5 -translate-y-1/2 bg-line lg:block" />
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
