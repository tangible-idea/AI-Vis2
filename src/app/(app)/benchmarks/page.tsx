import { Lock } from "lucide-react";
import { requireProject } from "@/lib/project";
import { planLimits } from "@/lib/plans";
import { getBenchmarkStats, MIN_SAMPLE, SAMPLE_ENGINE_BENCHMARKS } from "@/lib/benchmarks";
import { ENGINES, engineInfo } from "@/lib/ai/engines";
import { COUNTRIES, INDUSTRIES } from "@/lib/types";
import { pct } from "@/lib/utils";
import { Card, CardHeader, PageHeader, Badge, ButtonLink } from "@/components/ui";
import { StatTile } from "@/components/charts";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Benchmarks" };

/**
 * Market Benchmarks — always useful: platform coverage, corpus size and
 * engine-level mention/citation rates from the anonymous observation layer.
 * Below MIN_SAMPLE the distribution shows clearly-labeled illustrative
 * data; real aggregates take over automatically as coverage grows. Never
 * exposes customer-specific information.
 */
export default async function BenchmarksPage() {
  const { project, profile } = await requireProject();
  const limits = planLimits(profile.plan);
  const t = await getT();

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

  const stats = await getBenchmarkStats();
  const engineRows = stats.belowSample ? SAMPLE_ENGINE_BENCHMARKS : stats.engines;

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

        {/* corpus coverage */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label={t("benchmarks.promptsAnalyzed")}
            value={String(stats.distinctPrompts)}
            hint={t("benchmarks.promptsAnalyzedHint")}
          />
          <StatTile
            label={t("benchmarks.answersAnalyzed")}
            value={String(stats.observations)}
            hint={t("benchmarks.answersAnalyzedHint")}
          />
          <StatTile
            label={t("benchmarks.sourcesAnalyzed")}
            value={String(stats.sourcesAnalyzed)}
            hint={t("benchmarks.sourcesAnalyzedHint")}
          />
          <StatTile
            label={t("benchmarks.platformsCovered")}
            value={String(ENGINES.length)}
            hint={ENGINES.map((e) => e.label).join(" · ")}
          />
        </div>

        {/* engine-level mention & citation rates */}
        <Card>
          <CardHeader
            title={t("benchmarks.engineRates")}
            hint={t("benchmarks.engineRatesHint")}
            action={
              stats.belowSample ? (
                <Badge tone="mid">{t("benchmarks.sampleData")}</Badge>
              ) : (
                <Badge tone="good">{t("benchmarks.liveData")}</Badge>
              )
            }
          />
          <div className="divide-y divide-line px-5 pb-4">
            {engineRows.map((row) => {
              const info = engineInfo(row.engine);
              return (
                <div key={row.engine} className="flex items-center gap-3 py-2.5">
                  <span
                    className="w-32 shrink-0 truncate text-xs font-semibold"
                    style={{ color: info.color }}
                  >
                    {info.label}
                  </span>
                  <div className="h-1.5 min-w-0 flex-1 rounded-full bg-hover">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(Math.round(row.mentionRate * 100), 2)}%`,
                        background: info.color,
                      }}
                    />
                  </div>
                  <span className="tabular w-24 shrink-0 text-right text-xs text-ink-soft">
                    {t("benchmarks.mentionShort", { rate: pct(row.mentionRate) })}
                  </span>
                  <span className="tabular w-24 shrink-0 text-right text-xs text-ink-faint">
                    {t("benchmarks.citationShort", { rate: pct(row.citationRate) })}
                  </span>
                </div>
              );
            })}
          </div>
          {stats.belowSample && (
            <p className="px-5 pb-4 text-[11px] leading-relaxed text-ink-faint">
              {t("benchmarks.sampleNote", { min: MIN_SAMPLE })}
            </p>
          )}
        </Card>

        {/* available coverage */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader
              title={t("benchmarks.industriesTitle")}
              hint={t("benchmarks.industriesHint", {
                count: stats.industries.length || INDUSTRIES.length,
              })}
            />
            <div className="flex flex-wrap gap-1.5 px-5 pb-5">
              {(stats.industries.length ? stats.industries : [...INDUSTRIES]).map((i) => (
                <Badge key={i} tone={i === project.industry ? "accent" : "neutral"}>
                  {i}
                </Badge>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader
              title={t("benchmarks.marketsTitle")}
              hint={t("benchmarks.marketsHint", {
                count: stats.countries.length || COUNTRIES.length,
              })}
            />
            <div className="flex flex-wrap gap-1.5 px-5 pb-5">
              {(stats.countries.length ? stats.countries : [...COUNTRIES]).map((c) => (
                <Badge key={c} tone={c === project.country ? "accent" : "neutral"}>
                  {c}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
