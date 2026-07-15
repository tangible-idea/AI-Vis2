"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Radar, Sparkles } from "lucide-react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { INDUSTRIES } from "@/lib/types";
import { PREVIEW_STORAGE_KEY, type PreviewInputs, type PreviewResult } from "@/lib/preview";

const LOCKED_INSIGHTS = [
  ["Engine-by-engine breakdown", "Scores and answers for ChatGPT, Claude, Gemini & Perplexity"],
  ["Prompt-level answers", "Exactly what each AI says when buyers ask about your category"],
  ["Competitor share of voice", "Who wins the mentions you're missing"],
  ["Action plan & content", "Generated pages, schema and llms.txt that move the score"],
] as const;

export default function PreviewPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [brand, setBrand] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const inputs: PreviewInputs = {
      brand: String(fd.get("brand") ?? "").trim(),
      domain: String(fd.get("domain") ?? "").trim(),
      industry: String(fd.get("industry") ?? ""),
      description: String(fd.get("description") ?? "").trim() || undefined,
    };
    setBrand(inputs.brand);
    setLoading(true);
    setError(null);

    // carry inputs into onboarding after sign-up
    try {
      localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(inputs));
    } catch {}

    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Preview failed — please try again.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      {!result && (
        <>
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft">
              <Radar className="h-3.5 w-3.5 text-accent-strong" />
              Free AEO/GEO preview · no account needed
            </p>
            <h1 className="mt-5 text-3xl tracking-tight sm:text-4xl">
              Does AI <span className="font-display italic text-accent-strong">mention</span> your
              brand?
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              We&apos;ll ask ChatGPT, Claude, Gemini and Perplexity the questions your buyers ask
              and show you where you stand — in about 30 seconds.
            </p>
          </div>

          <Card className="mt-8 p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="brand">Brand name *</Label>
                  <Input id="brand" name="brand" required placeholder="Acme Bookings" />
                </div>
                <div>
                  <Label htmlFor="domain">Domain *</Label>
                  <Input id="domain" name="domain" required placeholder="acme.com" />
                </div>
              </div>
              <div>
                <Label htmlFor="industry">Industry *</Label>
                <Select id="industry" name="industry" required defaultValue={INDUSTRIES[0].id}>
                  {INDUSTRIES.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="description">
                  What does your business do?{" "}
                  <span className="font-normal text-ink-faint">(optional)</span>
                </Label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  maxLength={500}
                  placeholder="One sentence is enough — more detail sharpens your results"
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                />
              </div>
              {error && <p className="text-sm text-poor">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse-dot" /> Asking 4 AI engines…
                  </>
                ) : (
                  <>
                    Run free preview scan <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-ink-faint">
                Free preview shows your headline score. Sign up free to unlock the full breakdown —
                5 full scans included.
              </p>
            </form>
          </Card>
        </>
      )}

      {result && (
        <div className="animate-rise">
          <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
            Preview result · {result.promptsRun} prompts × {result.enginesScanned} engines
          </p>
          <h1 className="mt-1 text-center text-2xl tracking-tight">
            How AI sees <span className="font-display italic">{brand}</span>
          </h1>

          <Card className="mt-6 p-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">
                  Visibility Score
                </p>
                <p className="tabular mt-1 text-5xl font-semibold text-accent-strong">
                  {result.score}
                  <span className="text-lg text-ink-faint">/100</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Mention rate</p>
                <p className="tabular mt-1 text-5xl font-semibold">
                  {Math.round(result.mentionRate * 100)}
                  <span className="text-lg text-ink-faint">%</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">
                  Strongest engine
                </p>
                <p className="mt-1 text-2xl font-semibold leading-[3rem]">
                  {result.topEngine ? result.topEngine.label : "—"}
                </p>
              </div>
            </div>
            {result.sample && (
              <div className="mt-6 rounded-lg bg-hover/60 p-4">
                <p className="text-xs font-medium text-ink-soft">
                  “{result.sample.prompt}”
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
                  {result.sample.excerpt}
                </p>
                <p className="mt-2 text-xs font-medium">
                  {result.sample.mentioned ? (
                    <span className="text-good">✓ {brand} was mentioned in this answer</span>
                  ) : (
                    <span className="text-poor">✗ {brand} did not appear in this answer</span>
                  )}
                </p>
              </div>
            )}
          </Card>

          {/* gated full insights */}
          <div className="relative mt-4 overflow-hidden rounded-xl border border-line">
            <div className="pointer-events-none select-none space-y-3 p-5 blur-[6px]" aria-hidden>
              {LOCKED_INSIGHTS.map(([title, body]) => (
                <div key={title} className="rounded-lg border border-line bg-surface p-4">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-[13px] text-ink-soft">{body}</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/50 px-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-paper">
                <Lock className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold">
                Your full report is ready — sign up free to see it
              </p>
              <p className="max-w-sm text-xs text-ink-soft">
                Engine-by-engine scores, every AI answer, competitor share of voice and a concrete
                action plan. Free plan includes 5 full scans.
              </p>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink/85"
              >
                Unlock full insights — free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-ink-faint">
            {result.previewsLeft > 0 ? (
              <>
                {result.previewsLeft} free preview{result.previewsLeft === 1 ? "" : "s"} left ·{" "}
                <button
                  onClick={() => setResult(null)}
                  className="cursor-pointer font-medium text-accent-strong underline-offset-4 hover:underline"
                >
                  scan another brand
                </button>
              </>
            ) : (
              <>
                That was your last free preview —{" "}
                <Link href="/signup" className="font-medium text-accent-strong hover:underline">
                  sign up free
                </Link>{" "}
                to keep scanning.
              </>
            )}
          </p>
        </div>
      )}
    </main>
  );
}
