import Link from "next/link";
import { ArrowRight, Radar, Wand2, TrendingUp, Check } from "lucide-react";
import { ENGINES } from "@/lib/ai/engines";

export default function HomePage() {
  return (
    <main>
      {/* ── hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-night text-paper">
        <div className="dot-grid-dark absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-20 sm:pt-28">
          <div className="stagger max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-night-line bg-night-soft px-3 py-1 text-xs text-paper/70">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[#35d07f]" />
              Your buyers ask AI now — not Google
            </p>
            <h1 className="mt-6 text-4xl leading-[1.1] tracking-tight sm:text-6xl">
              Does AI <span className="font-display italic text-[#35d07f]">recommend</span> your
              brand?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/65 sm:text-lg">
              When someone asks ChatGPT for the &ldquo;best CRM&rdquo; or the &ldquo;best hotel in
              Seoul&rdquo; and you&apos;re not in the answer, you don&apos;t exist. Sightline shows
              where you stand across every AI engine — and exactly how to fix it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/preview"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#35d07f] px-5 text-sm font-semibold text-night transition-colors hover:bg-[#4adf90]"
              >
                Run a free preview scan <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded-lg border border-night-line px-5 text-sm font-medium text-paper/80 transition-colors hover:bg-night-soft"
              >
                Start free
              </Link>
              <span className="text-xs text-paper/50">
                No signup needed · 5 free scans when you join
              </span>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-paper/50">
              <span className="text-xs uppercase tracking-wider">Scanning</span>
              {ENGINES.map((e) => (
                <span key={e.id} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
                  {e.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 opacity-60">
                <span className="h-1.5 w-1.5 rounded-full bg-paper/40" />
                AI Overviews <em className="text-[10px] not-italic">soon</em>
              </span>
            </div>
          </div>

          {/* mock score card */}
          <div className="pointer-events-none absolute -right-10 top-24 hidden w-80 rotate-2 rounded-2xl border border-night-line bg-night-soft p-5 shadow-pop lg:block">
            <p className="text-[10px] uppercase tracking-wider text-paper/40">Visibility Score</p>
            <p className="tabular mt-1 text-5xl text-[#35d07f]">
              54<span className="text-lg text-paper/40">/100</span>
              <span className="ml-2 text-sm text-[#35d07f]">▲ +7</span>
            </p>
            <div className="mt-4 space-y-2.5">
              {ENGINES.map((e, i) => (
                <div key={e.id}>
                  <div className="flex justify-between text-[11px] text-paper/60">
                    <span>{e.label}</span>
                    <span className="tabular">{[62, 58, 46, 34][i]}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-night">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${[62, 58, 46, 34][i]}%`, background: e.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── problem ──────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl tracking-tight sm:text-3xl">
              SEO tells you about Google.
              <br />
              <span className="font-display italic text-accent-strong">Nobody tells you about AI.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Millions of buying decisions now start with a question to an AI assistant. Each engine
              has its own opinion of your brand, formed from different sources — and it changes every
              week. You can&apos;t improve what you can&apos;t see.
            </p>
          </div>
          <div className="space-y-3">
            {[
              ["Am I visible?", "One score across ChatGPT, Claude, Gemini and Perplexity."],
              ["Why or why not?", "Prompt-by-prompt answers, positions, and competitor gaps."],
              ["How do I improve?", "Generated pages, schema and llms.txt — not generic advice."],
              ["Is it working?", "Week-over-week trends and before/after for every action."],
            ].map(([q, a]) => (
              <div key={q} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <p className="text-sm font-semibold">{q}</p>
                <p className="mt-1 text-[13px] text-ink-soft">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-ink-faint">
            How it works
          </p>
          <h2 className="mt-2 text-center text-2xl tracking-tight sm:text-3xl">
            Monitor <span className="font-display italic">→</span> Optimize{" "}
            <span className="font-display italic">→</span> Improve
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Radar,
                step: "01 · Monitor",
                title: "Scan every engine with real buyer questions",
                body: "We ask each AI the prompts your buyers use — best-of lists, comparisons, local queries — and measure mentions, positions, citations and recommendations.",
              },
              {
                icon: Wand2,
                step: "02 · Optimize",
                title: "Get assets, not advice",
                body: "Every gap becomes a concrete deliverable: FAQ pages, comparison pages, JSON-LD schema, llms.txt, metadata — generated in your voice, in 8 languages.",
              },
              {
                icon: TrendingUp,
                step: "03 · Improve",
                title: "Watch the needle move weekly",
                body: "Track score trends, share of voice, and competitor moves. See before/after impact for every action you ship, in reports your exec team can read.",
              },
            ].map(({ icon: Icon, step, title, body }) => (
              <div key={step} className="group relative rounded-2xl border border-line bg-paper p-6 transition-shadow hover:shadow-pop">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
                  {step}
                </p>
                <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── social proof ─────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "We were invisible on Perplexity and didn't know it. Two weeks after shipping Sightline's llms.txt and comparison page, we showed up in 6 of 9 test prompts.",
              "Head of Growth, B2B SaaS",
            ],
            [
              "Finally a number I can put in the board deck. The weekly digest alone is worth the subscription.",
              "CMO, hospitality group",
            ],
            [
              "We run it for every client now. The generated content is 90% ready to publish — in Korean and English.",
              "Founder, SEO agency",
            ],
          ].map(([quote, who]) => (
            <figure key={who} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <blockquote className="font-display text-[15px] italic leading-relaxed text-ink">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="mt-3 text-xs text-ink-faint">{who}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── pricing teaser ───────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h2 className="text-2xl tracking-tight sm:text-3xl">Simple pricing</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
            Free to start. Starter at $49/mo for weekly scans, trends and content generation. Pro at
            $149/mo for unlimited everything, API and white label.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium hover:bg-hover"
            >
              Compare plans
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/85"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-4 py-20">
        <h2 className="text-center text-2xl tracking-tight">Questions</h2>
        <div className="mt-8 divide-y divide-line">
          {[
            [
              "How is this different from an SEO tool?",
              "SEO tools measure Google rankings. Sightline measures whether AI assistants mention and recommend you when buyers ask — a different index, different sources, and different fixes (llms.txt, Q&A structure, comparison pages).",
            ],
            [
              "Which AI engines do you cover?",
              "ChatGPT, Claude, Gemini and Perplexity today, with Google AI Overviews next. Engines are pluggable, so coverage grows without re-architecture.",
            ],
            [
              "How fast do I see results?",
              "Your first scan completes minutes after signup. Visibility improvements typically show within 2–6 weeks of shipping the recommended content, depending on how often engines refresh.",
            ],
            [
              "Do you support languages besides English?",
              "Yes — content generation supports English, Korean, Japanese, Chinese, Thai, Vietnamese, Indonesian and Malay.",
            ],
            [
              "Can I share reports with clients?",
              "Starter and Pro include read-only share links with expiry dates, plus Markdown/CSV export and a print-clean report layout.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                {q}
                <span className="text-ink-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── final CTA ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-night text-paper">
        <div className="dot-grid-dark absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
          <h2 className="text-3xl tracking-tight sm:text-4xl">
            Find out what AI says about you —{" "}
            <span className="font-display italic text-[#35d07f]">in the next 10 minutes</span>
          </h2>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-paper/60">
            {["Visibility Score", "Competitor comparison", "Action plan", "Generated content"].map(
              (f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#35d07f]" /> {f}
                </li>
              )
            )}
          </ul>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-[#35d07f] px-6 text-sm font-semibold text-night hover:bg-[#4adf90]"
          >
            Start free scan <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
