import { BarChart3, Lock, PieChart, Sparkles, Target, TrendingUp } from "lucide-react";
import { requireProject } from "@/lib/project";
import { planLimits } from "@/lib/plans";
import { Card, CardHeader, PageHeader, Badge, ButtonLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Benchmarks" };

/**
 * Market Benchmarks — page structure and reusable placeholder cards only.
 * Calculations arrive once enough anonymous prompt observations exist (see
 * prompt_observations, migration 0006); the layout, gating and copy are
 * final so unlocking is a data change, not a UI project.
 */
export default async function BenchmarksPage() {
  const { project, profile } = await requireProject();
  const limits = planLimits(profile.plan);
  const t = await getT();

  const sections: { key: string; icon: typeof BarChart3 }[] = [
    { key: "shareOfVoice", icon: PieChart },
    { key: "distribution", icon: BarChart3 },
    { key: "promptCoverage", icon: Target },
    { key: "benchmarkTrends", icon: TrendingUp },
    { key: "recommendedActions", icon: Sparkles },
  ];

  if (!limits.benchmarks) {
    // progressive disclosure for free users: name the value, no hard paywall
    return (
      <>
        <PageHeader title={t("benchmarks.title")} subtitle={t("benchmarks.subtitleLocked")} />
        <Card className="p-6">
          <div className="mx-auto max-w-md space-y-3 py-6 text-center">
            <p className="text-sm font-semibold text-ink">{t("benchmarks.lockedTitle")}</p>
            <p className="text-sm text-ink-faint">{t("benchmarks.lockedBody")}</p>
            <ul className="mx-auto max-w-xs space-y-2 pt-2 text-left">
              {(["lockBenchmark", "lockTopPrompts", "lockIndustry", "lockContent"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2 text-sm text-ink-soft">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  {t(`benchmarks.${k}`)}
                </li>
              ))}
            </ul>
            <div className="pt-3">
              <ButtonLink href="/billing" size="sm">
                {t("common.upgrade")}
              </ButtonLink>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("benchmarks.title")}
        subtitle={t("benchmarks.subtitle", { industry: project.industry, country: project.country })}
      />
      <div className="stagger space-y-4">
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-soft shadow-card">
          {t("benchmarks.collectingNote")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map(({ key, icon: Icon }) => (
            <Card key={key} className={key === "recommendedActions" ? "sm:col-span-2" : undefined}>
              <CardHeader
                title={t(`benchmarks.${key}`)}
                hint={t(`benchmarks.${key}Hint`)}
                action={<Badge tone="accent">{t("benchmarks.comingSoon")}</Badge>}
              />
              <div className="px-5 pb-5">
                <div className="dot-grid flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
                  <Icon className="h-5 w-5 text-ink-faint" strokeWidth={1.6} />
                  <p className="mt-2 max-w-sm text-xs text-ink-faint">{t("benchmarks.placeholderBody")}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
