import Link from "next/link";
import {
  Activity,
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
            Clarity between healthcare appointments
          </div>

          <h1 className="animate-fade-up mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl xl:text-7xl">
            Understand your health.
            <span className="block sa-gradient-text">Not just track it.</span>
          </h1>

          <p className="animate-fade-up mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
            Between appointments, you&apos;re on your own with the numbers. Synapse learns
            your baseline, notices what changed, and explains what it might mean — calmly,
            with its reasoning shown.
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
            <span className="inline-flex items-center gap-1.5"><Timer className="h-4 w-4 text-navy-400" /> 5 minutes a week</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-navy-400" /> Shows its evidence</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-navy-400" /> Private by design</span>
          </div>

          <p className="animate-fade-up mt-6 text-xs text-muted">
            General wellness &amp; education — never diagnosis or treatment.
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
                &ldquo;Your attention has been stronger in the weeks your sleep was more
                consistent. Worth keeping a gentle eye on.&rdquo;
              </p>
              <p className="mt-2 text-[11px] text-muted">From 6 weeks of your check-ins · moderate confidence</p>
            </div>
          </div>

          <div className="absolute -left-4 bottom-16 w-60 sa-float-slow">
            <div className="rounded-2xl border bg-surface/85 p-4 text-left shadow-lift glass">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Weekly report</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Ready</span>
              </div>
              <p className="mt-2 text-sm text-ink">Two positive trends, one thing to watch, one question for your provider.</p>
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
              Synapse is connecting this week&apos;s dots…
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const qs = [
    "Am I actually improving?",
    "What changed this week?",
    "Which habits seem to help me?",
    "What should I ask my provider?",
  ];
  return (
    <Section>
      <Eyebrow>The gap</Eyebrow>
      <H2>Health happens between appointments — where you&apos;re mostly on your own.</H2>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Other apps collect data and draw charts, then stop. You&apos;re left to
        interpret raw numbers and answer the questions that actually matter:
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
          <H2 className="text-white">From a dashboard of numbers to an intelligence that explains.</H2>
          <p className="mt-4 max-w-2xl text-lg text-navy-100/80">
            We don&apos;t hand you another chart to interpret. We give you a clear read of
            your own health — what moved, the most likely reason, and a calm next step —
            with the reasoning shown and uncertainty stated honestly.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: Compass, t: "Understanding, not numbers", d: "Every screen leads with what it means for you." },
              { icon: ShieldCheck, t: "Shows its work", d: "Observation, reasoning, focus, and an honest confidence level." },
              { icon: HeartPulse, t: "Calm by design", d: "Built to reduce uncertainty, never to create anxiety." },
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
    { icon: CalendarCheck, t: "Short adaptive assessments", d: "Synapse composes a few quick, game-like assessments from your goals and history — usually under five minutes — then tells you what they mean." },
    { icon: Brain, t: "Synapse notices what matters", d: "It compares this week to your history, finds the meaningful changes, and — this is the magic — tells you before you ask." },
    { icon: MessageCircleQuestion, t: "You walk in prepared", d: "A calm report plus a ready list of questions for your provider, so your next appointment counts." },
  ];
  return (
    <Section id="how">
      <Eyebrow>How it works</Eyebrow>
      <H2>Assess. Notice. Understand.</H2>
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
            Synapse reasons like a health analyst who knows you, not a
            chatbot. It watches for meaningful patterns across weeks and brings the
            important ones to you, calmly and in plain language.
          </p>
          <ul className="mt-7 space-y-3.5 text-ink">
            {[
              "Reads longitudinal trends, not single readings",
              "Separates observation, education, and what to ask your provider",
              "States its confidence — and lowers it honestly when data is thin",
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
              “We&apos;ve noticed your fatigue has steadily increased over the past
              four weeks, even though your reaction time has held steady. It may be
              worth keeping an eye on, and mentioning to your provider if it
              continues.”
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
    { icon: Activity, t: "Adaptive assessments", d: "Synapse picks short, relevant tasks each week — never a fixed, tiring battery." },
    { icon: Sparkles, t: "Proactive notices", d: "Important patterns surface on their own, rate-limited so it never nags." },
    { icon: LineChart, t: "Health timeline", d: "A narrative of milestones, with charts as supporting evidence." },
    { icon: MessageCircleQuestion, t: "Ask anything", d: "“Why did my attention dip?” — answered from your own data, honestly." },
    { icon: CalendarCheck, t: "Provider prep", d: "A ready one-pager and question list for your next appointment." },
    { icon: ShieldCheck, t: "Privacy first", d: "Your data is isolated per-user, never sold, and yours to export or delete." },
  ];
  return (
    <Section id="features">
      <Eyebrow>Features</Eyebrow>
      <H2>Everything in service of one question.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Does this help you make a better-informed health decision between
        appointments? If not, it isn&apos;t here.
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
    { phase: "Now", t: "The weekly loop", d: "Adaptive assessments, proactive notices, weekly reports, and chat." },
    { phase: "Next", t: "Deeper context", d: "Optional wearable & sleep imports to enrich the picture." },
    { phase: "Later", t: "Care collaboration", d: "Shareable provider summaries and, eventually, clinician tools." },
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
    { q: "Is this a medical device or a replacement for my care team?", a: "No. Synapse Adaptive is a general wellness and education tool. It never diagnoses, prescribes, or replaces your healthcare provider — it helps you understand your own data and prepare for your appointments." },
    { q: "How does it handle uncertainty?", a: "Honestly. Synapse states a confidence level on every insight and lowers it when data is thin or noisy. We'd rather say 'worth keeping an eye on' than overclaim." },
    { q: "What data do I need?", a: "Just a few minutes a week for short assessments. Insights get sharper the more consistently you check in." },
    { q: "Who can see my data?", a: "Only you. Data is isolated per user, never sold, and you can export or delete it at any time." },
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
            Make the weeks between appointments count.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-100/80">
            Meet the health companion built to explain, not just track — and the longer
            you use it, the better it understands you.
          </p>
          <Link href="/login" className="mt-9 inline-block">
            <Button size="lg" className="sa-shine">Open the demo <ArrowRight className="h-4 w-4" /></Button>
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
              AI health intelligence between healthcare appointments.
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
          Synapse Adaptive provides general wellness insights and education. It does
          not diagnose, treat, or provide medical advice, and is not a substitute for
          professional care. If you may be experiencing a medical emergency, contact
          your local emergency services.
        </p>
        <p className="mt-4 text-xs text-muted">© {new Date().getFullYear()} Synapse Adaptive.</p>
      </div>
    </footer>
  );
}

function AppleHealth() {
  const rows = [
    ["When you open it", "A wall of numbers and charts", "A plain-language read of how you're doing"],
    ["A change in your data", "“Here's the graph.”", "“Here's what moved, and the most likely reason.”"],
    ["Its core job", "Store and display metrics", "Interpret metrics into understanding"],
    ["What you leave with", "More data", "A focus for the week and a question for your provider"],
  ];
  return (
    <Section>
      <Eyebrow>The difference</Eyebrow>
      <H2>Apple Health tells you what happened. Synapse tells you what it means.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">Trackers are repositories. Synapse Adaptive is a reasoning layer on top of your health.</p>
      <div className="mt-12 overflow-hidden rounded-2xl border bg-surface shadow-soft">
        <div className="grid grid-cols-3 border-b bg-surface-2 text-sm font-semibold text-ink">
          <div className="p-4" />
          <div className="p-4 text-muted">Typical health app</div>
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
      <H2>Everyone gets the insights. Pro &amp; Max get them every day.</H2>
      <p className="mt-3 max-w-2xl text-lg text-muted">Free is genuinely useful — no card needed.</p>

      {/* The real value axis, stated plainly: weekly insight is free; daily is the upgrade. */}
      <div className="mt-6 max-w-3xl rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-surface p-6 shadow-soft dark:border-orange-500/20 dark:from-orange-500/5 dark:to-surface">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
          <Sparkles className="h-3.5 w-3.5" /> What you actually get
        </div>
        <p className="mt-3 text-lg leading-relaxed text-ink">
          <b>Every plan — free included — gets a full weekly report:</b> Synapse&apos;s proactive
          insights and its suggestions for what to focus on next week. That value is never paywalled.
        </p>
        <p className="mt-2 text-lg leading-relaxed text-muted">
          The real difference with <b className="text-ink">Pro</b> and <b className="text-ink">Max</b>?
          You get that same &ldquo;here&apos;s what I noticed, here&apos;s what I&apos;d do&rdquo; guidance
          <b className="text-ink"> every single day</b> — proactively, on your dashboard — plus the ability
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
      <p className="mt-5 text-center text-xs text-muted">Prices in USD. Cancel anytime. General wellness &amp; education — not medical care.</p>
    </Section>
  );
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
