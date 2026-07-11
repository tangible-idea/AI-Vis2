import Link from "next/link";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { getTrendsSource } from "@/lib/trends";
import { planLimits } from "@/lib/plans";
import { engineInfo, ENGINE_IDS } from "@/lib/ai/engines";
import { formatDate, timeAgo, cn } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, Badge, LockedOverlay } from "@/components/ui";
import { VisibilityHeatmap } from "@/components/charts";
import { ScanButton } from "@/components/scan-button";
import { TrendingUp } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { Engine, Prompt, ScanResult } from "@/lib/types";

export const metadata = { title: "Monitor" };

export default async function MonitorPage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);
  const t = await getT();

  const [{ data: scans }, { data: prompts }] = await Promise.all([
    supabase
      .from("scans")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("prompts")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  const lastDone = (scans ?? []).find((s) => s.status === "done");
  const { data: results } = lastDone
    ? await supabase.from("scan_results").select("*").eq("scan_id", lastDone.id)
    : { data: [] as ScanResult[] };

  const promptList = (prompts ?? []) as Prompt[];
  const resultList = (results ?? []) as ScanResult[];

  const heatmapRows = promptList.map((p) => ({
    prompt: p.text,
    cells: ENGINE_IDS.map((engine) => {
      const r = resultList.find((x) => x.prompt_id === p.id && x.engine === engine);
      const level = !r ? null : r.recommended ? 2 : r.brand_mentioned ? 1 : 0;
      return { engine: engine as Engine, level: level as 0 | 1 | 2 | null };
    }),
  }));

  const trends = await getTrendsSource().trendingSearches({
    industry: project.industry,
    country: project.country,
    language: project.language,
    timeframe: "30d",
  });

  return (
    <>
      <PageHeader
        title={t("monitor.title")}
        subtitle={
          lastDone
            ? t("monitor.subtitleScanned", {
                time: timeAgo(lastDone.completed_at),
                prompts: promptList.length,
                engines: ENGINE_IDS.length,
              })
            : t("monitor.subtitleEmpty")
        }
        action={<ScanButton projectId={project.id} />}
      />

      <div className="stagger space-y-4">
        {/* heatmap */}
        <Card>
          <CardHeader title={t("monitor.heatmap")} hint={t("monitor.heatmapHint")} />
          <div className="px-5 pb-5">
            {heatmapRows.length && resultList.length ? (
              <VisibilityHeatmap rows={heatmapRows} />
            ) : (
              <EmptyState title={t("monitor.noResults")} body={t("monitor.noResultsBody")} />
            )}
          </div>
        </Card>

        {/* prompt explorer: what did the AI actually say? */}
        {resultList.length > 0 && (
          <Card>
            <CardHeader
              title={t("monitor.promptExplorer")}
              hint={t("monitor.promptExplorerHint")}
            />
            <div className="divide-y divide-line px-5 pb-4">
              {promptList.map((p) => {
                const rows = resultList.filter((r) => r.prompt_id === p.id);
                if (!rows.length) return null;
                return (
                  <details key={p.id} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <span className="flex-1 text-sm text-ink">{p.text}</span>
                      <span className="flex gap-1">
                        {rows.map((r) => (
                          <span
                            key={r.id}
                            title={`${engineInfo(r.engine).label}: ${r.recommended ? "recommended" : r.brand_mentioned ? "mentioned" : "not mentioned"}`}
                            className={cn(
                              "h-2 w-2 rounded-full",
                              r.recommended
                                ? "bg-accent"
                                : r.brand_mentioned
                                  ? "bg-[#9dd4b4]"
                                  : "bg-line-strong"
                            )}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-ink-faint transition-transform group-open:rotate-90">
                        ›
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {rows.map((r) => (
                        <div key={r.id} className="rounded-lg border border-line bg-paper p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: engineInfo(r.engine).color }}
                            >
                              {engineInfo(r.engine).label}
                            </span>
                            <span className="flex items-center gap-1">
                              {r.recommended && <Badge tone="good">{t("monitor.recommendedBadge")}</Badge>}
                              {r.brand_mentioned && r.brand_position && (
                                <Badge tone="neutral">#{r.brand_position}</Badge>
                              )}
                              {!r.brand_mentioned && <Badge tone="poor">{t("monitor.notMentioned")}</Badge>}
                              <span className="text-[10px] text-ink-faint">{timeAgo(r.created_at)}</span>
                            </span>
                          </div>
                          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                            {r.response_text}
                          </p>
                          {(r.competitors_mentioned.length > 0 || (r.sources ?? []).length > 0) && (
                            <div className="mt-2 space-y-1 border-t border-line pt-2">
                              {r.competitors_mentioned.length > 0 && (
                                <p className="text-[11px] text-ink-faint">
                                  <span className="font-medium text-ink-soft">{t("monitor.competitorsLabel")}</span>{" "}
                                  {r.competitors_mentioned.join(", ")}
                                </p>
                              )}
                              {(r.sources ?? []).length > 0 && (
                                <p className="truncate text-[11px] text-ink-faint">
                                  <span className="font-medium text-ink-soft">{t("monitor.sourcesLabel")}</span>{" "}
                                  {(r.sources ?? []).map((s, i) => (
                                    <span key={s.url}>
                                      {i > 0 && ", "}
                                      <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-accent-strong hover:underline"
                                      >
                                        {s.domain}
                                      </a>
                                    </span>
                                  ))}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>
        )}

        {/* trends */}
        {limits.trends ? (
          <Card>
            <CardHeader
              title={t("monitor.trendingSearches")}
              hint={t("monitor.trendingHint", { industry: project.industry })}
              action={
                <Link href="/trends" className="text-xs text-accent-strong hover:underline">
                  {t("common.explore")}
                </Link>
              }
            />
            <div className="divide-y divide-line px-5 pb-3">
              {trends.slice(0, 5).map((t) => (
                <div key={t.keyword} className="flex items-center gap-3 py-2.5">
                  <TrendingUp
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      t.direction === "rising" ? "text-good" : t.direction === "declining" ? "text-poor" : "text-ink-faint"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{t.keyword}</p>
                    <p className="truncate text-[11px] text-ink-faint">{t.contentAngle}</p>
                  </div>
                  <span className={cn("tabular text-xs", t.growth >= 0 ? "text-good" : "text-poor")}>
                    {t.growth >= 0 ? "+" : ""}
                    {t.growth}%
                  </span>
                  <span className="tabular hidden text-xs text-ink-faint sm:block">{t.volume}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <LockedOverlay message={t("monitor.trendsLocked")}>
            <Card>
              <CardHeader
                title={t("monitor.trendingSearches")}
                hint={t("monitor.trendingHint", { industry: project.industry })}
              />
              <div className="space-y-3 px-5 pb-5">
                {trends.slice(0, 3).map((t) => (
                  <div key={t.keyword} className="h-8 rounded bg-hover" />
                ))}
              </div>
            </Card>
          </LockedOverlay>
        )}

        {/* scan history */}
        <Card>
          <CardHeader title={t("monitor.scanHistory")} />
          <div className="divide-y divide-line px-5 pb-3">
            {(scans ?? []).length === 0 && (
              <p className="py-4 text-sm text-ink-faint">{t("monitor.noScansYet")}</p>
            )}
            {(scans ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Badge
                  tone={s.status === "done" ? "good" : s.status === "failed" ? "poor" : "mid"}
                >
                  {s.status}
                </Badge>
                <span className="flex-1 text-ink-soft">{formatDate(s.created_at)}</span>
                <span className="text-xs capitalize text-ink-faint">{s.trigger}</span>
                {s.error && <span className="max-w-48 truncate text-xs text-poor">{s.error}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
