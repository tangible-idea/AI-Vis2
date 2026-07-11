"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import { createProject, type OnboardingState } from "../actions";
import { useScan } from "@/lib/use-scan";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { CONTENT_LANGUAGES, COUNTRIES, INDUSTRIES } from "@/lib/types";
import { PREVIEW_STORAGE_KEY, type PreviewInputs } from "@/lib/preview";
import { useT } from "@/lib/i18n";

export default function OnboardingPage() {
  const [state, action, pending] = useActionState<OnboardingState | null, FormData>(
    createProject,
    null
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const { phase, error: scanError, start } = useScan(projectId);
  const [demoLoading, setDemoLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [prefill, setPrefill] = useState<PreviewInputs | null>(null);
  const router = useRouter();
  const t = useT();

  // Carry over what the visitor already typed into the pre-signup preview.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (raw) setPrefill(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (state?.projectId) setProjectId(state.projectId);
  }, [state]);

  useEffect(() => {
    if (projectId && phase === "idle") start("onboarding");
    if (phase === "done") {
      try {
        localStorage.removeItem(PREVIEW_STORAGE_KEY);
      } catch {}
      router.push("/dashboard");
    }
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
        <h1 className="mt-6 text-xl font-semibold">{t("onboarding.scanTitle")}</h1>
        <p className="mt-2 text-sm text-ink-faint">{t("onboarding.scanBody")}</p>
        {phase === "error" && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-poor">{scanError}</p>
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              {t("onboarding.continueDashboard")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-rise">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
        {t("onboarding.step")}
      </p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">{t("onboarding.title")}</h1>
      <p className="mt-1 text-sm text-ink-faint">{t("onboarding.subtitle")}</p>

      <Card className="mt-6 p-6">
        <form action={action} className="space-y-4" key={prefill ? "prefilled" : "blank"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">{t("onboarding.brandName")}</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Acme Bookings"
                defaultValue={prefill?.brand ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="website">{t("onboarding.domain")}</Label>
              <Input
                id="website"
                name="website"
                required
                placeholder="acme.com"
                defaultValue={prefill?.domain ?? ""}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="industry">{t("onboarding.industry")}</Label>
            <Select
              id="industry"
              name="industry"
              required
              defaultValue={prefill?.industry ?? INDUSTRIES[0]}
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="description">
              {t("onboarding.descriptionLabel")}{" "}
              <span className="font-normal text-ink-faint">{t("onboarding.optional")}</span>
            </Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={prefill?.description ?? ""}
              placeholder="e.g. Online reservation software for independent restaurants in Korea and Japan"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t("onboarding.descriptionHint")}</p>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-dashed border-line-strong px-3 py-2 text-left text-xs font-medium text-ink-soft hover:bg-hover"
          >
            <span>
              {t("onboarding.moreDetail")}{" "}
              <span className="font-normal text-ink-faint">{t("onboarding.moreDetailHint")}</span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>

          {moreOpen && (
            <div className="space-y-4 rounded-lg bg-hover/50 p-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="country">{t("common.country")}</Label>
                  <Select id="country" name="country" defaultValue="US">
                    {COUNTRIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="language">{t("common.language")}</Label>
                  <Select id="language" name="language" defaultValue="en">
                    {CONTENT_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target_market">{t("onboarding.targetMarket")}</Label>
                  <Input id="target_market" name="target_market" placeholder="SMBs" />
                </div>
              </div>
              <div>
                <Label>{t("onboarding.competitors")}</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input name="competitor1" placeholder="competitor1.com" />
                  <Input name="competitor2" placeholder="competitor2.com" />
                  <Input name="competitor3" placeholder="competitor3.com" />
                </div>
              </div>
            </div>
          )}

          {state?.error && <p className="text-sm text-poor">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? t("onboarding.creating") : t("onboarding.continue")}
          </Button>
          <p className="text-center text-[11px] text-ink-faint">{t("onboarding.step2Hint")}</p>
        </form>
      </Card>

      <div className="mt-4 text-center">
        <button
          onClick={loadDemo}
          disabled={demoLoading}
          className="cursor-pointer text-sm text-ink-faint underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
        >
          {demoLoading ? t("onboarding.demoLoading") : t("onboarding.demoLink")}
        </button>
      </div>
    </div>
  );
}
