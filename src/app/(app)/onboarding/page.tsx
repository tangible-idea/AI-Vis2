"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createProject, type OnboardingState } from "../actions";
import { useScan } from "@/lib/use-scan";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { CONTENT_LANGUAGES } from "@/lib/types";

const COUNTRIES = ["US", "KR", "JP", "SG", "GB", "DE", "AU", "CA", "TH", "VN", "ID", "MY"];

export default function OnboardingPage() {
  const [state, action, pending] = useActionState<OnboardingState | null, FormData>(
    createProject,
    null
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const { phase, error: scanError, start } = useScan(projectId);
  const [demoLoading, setDemoLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state?.projectId) setProjectId(state.projectId);
  }, [state]);

  useEffect(() => {
    if (projectId && phase === "idle") start("onboarding");
    if (phase === "done") router.push("/dashboard");
  }, [projectId, phase, start, router]);

  async function loadDemo() {
    setDemoLoading(true);
    const res = await fetch("/api/demo", { method: "POST" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setDemoLoading(false);
    }
  }

  if (projectId) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center pt-20 text-center">
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
          <Sparkles className="h-6 w-6 animate-pulse-dot text-accent-strong" />
        </span>
        <h1 className="mt-6 text-xl font-semibold">Running your first scan</h1>
        <p className="mt-2 text-sm text-ink-faint">
          Asking ChatGPT, Claude, Gemini and Perplexity the questions your buyers ask.
          This usually takes under a minute.
        </p>
        {phase === "error" && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-poor">{scanError}</p>
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Continue to dashboard
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-rise">
      <h1 className="text-xl font-semibold tracking-tight">Set up your project</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Tell us who you are — we&apos;ll generate your buyer prompts and run the first scan
        immediately.
      </p>

      <Card className="mt-6 p-6">
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Company / brand *</Label>
              <Input id="name" name="name" required placeholder="Acme Bookings" />
            </div>
            <div>
              <Label htmlFor="website">Website *</Label>
              <Input id="website" name="website" type="url" required placeholder="https://acme.com" />
            </div>
          </div>
          <div>
            <Label htmlFor="industry">Industry / category *</Label>
            <Input
              id="industry"
              name="industry"
              required
              placeholder="restaurant reservation software"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Phrase it the way a buyer would — it becomes your scan prompts.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="country">Country</Label>
              <Select id="country" name="country" defaultValue="US">
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Select id="language" name="language" defaultValue="en">
                {CONTENT_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="target_market">Target market</Label>
              <Input id="target_market" name="target_market" placeholder="SMBs" />
            </div>
          </div>
          <div>
            <Label>Competitors (up to 3)</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="competitor1" placeholder="Competitor 1" />
              <Input name="competitor2" placeholder="Competitor 2" />
              <Input name="competitor3" placeholder="Competitor 3" />
            </div>
          </div>
          {state?.error && <p className="text-sm text-poor">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating project…" : "Create project & run first scan"}
          </Button>
        </form>
      </Card>

      <div className="mt-4 text-center">
        <button
          onClick={loadDemo}
          disabled={demoLoading}
          className="cursor-pointer text-sm text-ink-faint underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
        >
          {demoLoading ? "Loading demo…" : "Or explore with a demo project first"}
        </button>
      </div>
    </div>
  );
}
