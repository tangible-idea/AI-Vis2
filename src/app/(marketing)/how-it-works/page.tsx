import Link from "next/link";
import {
  ArrowRight,
  MessageSquareText,
  Radar,
  ScanSearch,
  Link2,
  RefreshCw,
  ShieldCheck,
  Eye,
  FileSearch,
  Repeat,
} from "lucide-react";
import { ENGINES } from "@/lib/ai/engines";
import { jsonLd, SITE } from "@/lib/seo";
import { Card } from "@/components/ui";

export const metadata = {
  title: "How Sightline Works — AI Visibility, Explained",
  description:
    "How Sightline measures your brand's visibility across leading AI assistants: prompt evaluation, response collection, analysis, citations and continuous monitoring — and how to read your results.",
  alternates: { canonical: "/how-it-works" },
};

/** Step-by-step of what happens in a scan — what, not how (no proprietary detail). */
const STEPS: { icon: typeof Radar; title: string; body: string }[] = [
  {
    icon: MessageSquareText,
    title: "Prompt evaluation",
    body: "We start from the real questions buyers ask AI assistants about your category — the moments where a recommendation actually happens.",
  },
  {
    icon: Radar,
    title: "AI response collection",
    body: "Each question is put to the leading AI assistants the way a customer would ask it, so results reflect what people genuinely see.",
  },
  {
    icon: ScanSearch,
    title: "Response analysis",
    body: "We read every answer to see whether your brand is mentioned, how it's positioned, and whether it's recommended over the alternatives.",
  },
  {
    icon: Link2,
    title: "Citation identification",
    body: "We identify the sources each assistant drew on, so you can see which pages and publications shape how AI describes you.",
  },
  {
    icon: RefreshCw,
    title: "Continuous monitoring",
    body: "Scans repeat over time, turning a one-off snapshot into a trend you can act on and measure progress against.",
  },
];

/** High-level factors — deliberately no formulas or weighting. */
const FACTORS: string[] = [
  "Brand mentions — how often AI assistants name you when buyers ask.",
  "Recommendation frequency — how often you're actively suggested, not just listed.",
  "Citation coverage — whether assistants point to sources that reference you.",
  "Source quality — the credibility of the places AI learns about you from.",
  "Competitive visibility — how you show up relative to the alternatives.",
  "Consistency across AI assistants — whether you appear reliably, not just on one.",
  "Prompt coverage — how many of your market's questions you show up in.",
];

const CHANGE_REASONS: string[] = [
  "AI models are updated by their providers.",
  "Publicly available web content changes.",
  "Citations and references shift over time.",
  "Competitors publish, launch and change their positioning.",
  "New scans add fresh data points to your trend.",
];

const NOT_MEASURED: string[] = [
  "Guarantee rankings or specific business outcomes.",
  "Influence or change how AI models behave.",
  "Modify AI-generated responses.",
  "Predict future AI outputs.",
];

const PRINCIPLES: { icon: typeof ShieldCheck; title: string; body: string }[] = [
  {
    icon: Repeat,
    title: "Consistent methodology",
    body: "The same repeatable process runs across prompts, AI models, citations, competitors and your selected markets.",
  },
  {
    icon: FileSearch,
    title: "Evidence-based insights",
    body: "Every result is backed by the actual prompts, AI responses and cited sources behind it — not just a number.",
  },
  {
    icon: Eye,
    title: "Transparent reporting",
    body: "You can see why a result was generated, so you never have to take a score on faith.",
  },
  {
    icon: RefreshCw,
    title: "Continuous monitoring",
    body: "Visibility is dynamic. We keep watching so your view stays current as the AI landscape evolves.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "How Sightline Works",
  url: `${SITE.url}/how-it-works`,
  description: metadata.description,
  isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-strong">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function HowItWorksPage() {
  const engineNames = ENGINES.map((e) => e.label).join(", ").replace(/, ([^,]*)$/, " and $1");

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(STRUCTURED_DATA) }}
      />

      {/* Overview */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">How it works</p>
      <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">
        How Sightline measures <span className="font-display italic">AI visibility</span>
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        Sightline evaluates how leading AI assistants discuss and reference brands, using a
        consistent, repeatable methodology across prompts, AI models, citations, competitors and
        your selected markets. This page explains what we measure and how to read your results —
        without the technical machinery behind the scenes.
      </p>

      {/* How Sightline Works */}
      <Section eyebrow="The process" title="How Sightline works">
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="flex items-start gap-4 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                  <step.icon className="h-4.5 w-4.5 text-accent-strong" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    <span className="tabular mr-1.5 text-ink-faint">{i + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-faint">
          Today we cover {engineNames}. Engines are added over time as the AI landscape grows.
        </p>
      </Section>

      {/* What influences your score */}
      <Section eyebrow="Your score" title="What influences your AI Visibility Score">
        <p className="text-sm leading-relaxed text-ink-soft">
          Your AI Visibility Score reflects how frequently your brand is discovered and referenced
          across leading AI platforms. Several high-level factors contribute to it:
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {FACTORS.map((f) => (
            <li key={f} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-[13px] text-ink-soft">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              {f}
            </li>
          ))}
        </ul>
      </Section>

      {/* Understanding your results */}
      <Section eyebrow="Reading your reports" title="Understanding your results">
        <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
          <p>
            Your AI Visibility Score is best read as a <strong className="font-semibold text-ink">directional benchmark</strong>,
            not an absolute ranking. A higher score generally means AI assistants discover and
            recommend you more often across the questions that matter in your market; a lower score
            points to gaps worth closing.
          </p>
          <p>
            Use it to see where you stand, track whether you&apos;re improving, and decide what to work
            on next — rather than as a guarantee of any specific business outcome.
          </p>
        </div>
      </Section>

      {/* Why scores change */}
      <Section eyebrow="Movement" title="Why scores change over time">
        <p className="text-sm leading-relaxed text-ink-soft">
          AI visibility is dynamic and continuously evolving. Your score naturally shifts because:
        </p>
        <ul className="mt-4 space-y-2">
          {CHANGE_REASONS.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[13px] text-ink-soft">
              <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
              {r}
            </li>
          ))}
        </ul>
      </Section>

      {/* What we don't measure */}
      <Section eyebrow="Honest limits" title="What Sightline does not measure">
        <p className="text-sm leading-relaxed text-ink-soft">
          Being clear about what Sightline is not helps you trust what it is. Sightline does not:
        </p>
        <ul className="mt-4 space-y-2">
          {NOT_MEASURED.map((n) => (
            <li key={n} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-[13px] text-ink-soft">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
              {n}
            </li>
          ))}
        </ul>
      </Section>

      {/* Transparency principles */}
      <Section eyebrow="How we work" title="Our transparency principles">
        <div className="grid gap-3 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <Card key={p.title} className="p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hover">
                <p.icon className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
              </span>
              <p className="mt-2.5 text-sm font-semibold">{p.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{p.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Wherever possible, Sightline surfaces the prompts, AI responses and cited sources behind
          its insights — so you can understand <em>why</em> a result was generated instead of relying
          on a score alone.
        </p>
      </Section>

      {/* CTA */}
      <div className="mt-16 rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
        <h2 className="text-lg font-semibold">See how AI talks about your brand</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">
          Run your first scan in minutes and get a clear, evidence-backed view of your AI visibility.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-9.5 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Start free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-9.5 items-center rounded-lg border border-line-strong px-4 text-sm font-medium hover:bg-hover"
          >
            See pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
