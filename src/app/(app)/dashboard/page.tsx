import Link from "next/link";
import { ArrowRight, Download, TrendingUp } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { ENGINES } from "@/lib/ai/engines";
import { getTrendsSource } from "@/lib/trends";
import { historyCutoffIso, planLimits } from "@/lib/plans";
import { pct, timeAgo, formatDate, cn } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, Badge, ButtonLink } from "@/components/ui";
import { ScoreHero, ScoreTrend, SovBars, StatTile } from "@/components/charts";
import { ScanButton } from "@/components/scan-button";
import { LastScanSummary, type ActivityItem } from "./last-scan-summary";
import { PlatformCards, type PlatformCardData } from "./platform-cards";
import { getT } from "@/lib/i18n/server";
import type { Engine, Prompt, Recommendation, ScanResult, ShareLink, Snapshot } from "@/lib/types";

export const metadata = { title: "Dashboard" };

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export default async function DashboardPage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);
  const t = await getT();

  const [{ data: snapshots }, { data: recs }, { data: scans }, { data: prompts }, { data: links }, { data: contentRows }] =
    await Promise.all([
      supabase
        .from("snapshots")
        .select("*")
        .eq("project_id", project.id)
        .gte("created_at", historyCutoffIso(limits) ?? "1970-01-01")
        .order("created_at", { ascending: true }),
      supabase
        .from("recommendations")
        .select("*")
        .eq("project_id", project.id)
        .eq("status", "todo")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("scans")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("prompts")
        .select("id, text")
        .eq("project_id", project.id)
        .eq("is_active", true),
      supabase
        .from("share_links")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("generated_content")
        .select("id, title, type, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const history = (snapshots ?? []) as Snapshot[];
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;
  const lastScan = (scans ?? [])[0] ?? null;
  const lastDone = (scans ?? []).find((s) => s.status === "done") ?? null;

  if (!latest) {
    return (
      <>
        <PageHeader
          title={project.name}
          subtitle={t("dashboard.firstScanSubtitle")}
          action={<ScanButton projectId={project.id} label={t("common.runFirstScan")} />}
        />
        <EmptyState
          title={
            lastScan?.status === "running" || lastScan?.status === "pending"
              ? t("dashboard.scanInProgress")
              : t("dashboard.noScans")
          }
          body={
            lastScan?.status === "running" || lastScan?.status === "pending"
              ? t("dashboard.scanInProgressBody")
              : t("dashboard.noScansBody")
          }
        />
      </>
    );
  }

  // latest scan results for citations / prompt-level detail
  const { data: resultRows } = lastDone
    ? await supabase.from("scan_results").select("*").eq("scan_id", lastDone.id)
    : { data: [] as ScanResult[] };
  const results = (resultRows ?? []) as ScanResult[];
  const promptList = (prompts ?? []) as Pick<Prompt, "id" | "text">[];
  const promptText = new Map(promptList.map((p) => [p.id, p.text]));

  const delta = previous ? latest.overall_score - previous.overall_score : null;

  // per-platform rollup (only engines present in the latest snapshot get scores;
  // newly added engines show 0 until the next scan)
  const platforms: PlatformCardData[] = ENGINES.map((info) => {
    const score = latest.engine_scores[info.id] ?? 0;
    const prevScore = previous?.engine_scores?.[info.id];
    const engineDelta = prevScore === undefined ? null : score - prevScore;
    const rows = results.filter((r) => r.engine === info.id);
    const mentions = rows.filter((r) => r.brand_mentioned).length;
    const citations = rows.filter((r) => r.cited).length;

    const topPrompts = rows
      .filter((r) => r.brand_mentioned)
      .sort((a, b) => Number(b.recommended) - Number(a.recommended))
      .map((r) => ({
        text: promptText.get(r.prompt_id) ?? "—",
        level: (r.recommended ? "recommended" : "mentioned") as "recommended" | "mentioned",
      }));

    const rivalCounts = new Map<string, number>();
    for (const r of rows) {
      for (const c of r.competitors_mentioned) rivalCounts.set(c, (rivalCounts.get(c) ?? 0) + 1);
    }
    const rivalMentions = [...rivalCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const improvement =
      score === 0
        ? `Invisible here — publish an llms.txt and an AI-friendly FAQ so ${info.label} can discover ${project.name}.`
        : citations === 0
          ? `Mentioned but never cited — add citable assets like comparison pages and original data.`
          : (engineDelta ?? 0) < 0
            ? `Slipping — refresh your highest-value pages and metadata, then rescan.`
            : `Keep the cadence — publish trending content to compound this position.`;

    return {
      id: info.id,
      label: info.label,
      color: info.color,
      score,
      delta: engineDelta,
      citations,
      mentions,
      totalPrompts: rows.length || promptList.length,
      lastScanAt: lastDone?.completed_at ?? latest.created_at,
      topPrompts,
      rivalMentions,
      improvement,
    };
  });

  const engineEntries = Object.entries(latest.engine_scores) as [Engine, number][];
  const best = engineEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const platformInfo = (id: string) => ENGINES.find((e) => e.id === id);

  // top action = highest priority open recommendation
  const openRecs = ((recs ?? []) as Recommendation[]).sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );
  const topAction = openRecs[0] ?? null;

  // recent activity feed
  const activity: ActivityItem[] = [];
  if (lastDone?.completed_at) {
    activity.push({ label: "Scan completed across all platforms", at: lastDone.completed_at });
    activity.push({ label: "Competitor benchmark updated", at: lastDone.completed_at });
  }
  if (openRecs[0]) activity.push({ label: "Recommendations refreshed", at: openRecs[0].created_at });
  for (const c of contentRows ?? []) {
    activity.push({ label: `Generated: ${c.title || c.type}`, at: c.created_at });
  }
  activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // next scheduled scan: weekly cadence from the last completed scan
  const nextScanAt = lastDone?.completed_at
    ? new Date(+new Date(lastDone.completed_at) + 7 * 86_400_000)
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const activeLinks = ((links ?? []) as ShareLink[]).filter(
    (l) => !l.expires_at || new Date(l.expires_at) > new Date()
  );
  const shareUrl = activeLinks[0] ? `${appUrl}/share/${activeLinks[0].token}` : null;

  const trends = limits.trends
    ? await getTrendsSource().trendingSearches({
        industry: project.industry,
        country: project.country,
        language: project.language,
        timeframe: "30d",
      })
    : [];

  // weekly progress deltas
  const pp = (now: number, then: number | undefined) =>
    then === undefined ? undefined : `${now - then >= 0 ? "+" : ""}${Math.round((now - then) * 100)}pp vs last scan`;

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${t("dashboard.lastScan", { time: timeAgo(lastDone?.completed_at ?? latest.created_at) })} · ${project.industry}`}
        action={<ScanButton projectId={project.id} />}
      />

      <div className="stagger space-y-4">
        {/* 1 — AI Visibility Score hero */}
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <ScoreHero score={latest.overall_score} delta={delta} label={t("dashboard.score")} />
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-ink-faint">{t("dashboard.bestPlatform")}</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: platformInfo(best[0])?.color }}>
                {platformInfo(best[0])?.label} · {best[1]}
              </p>
            </div>
          </div>
        </Card>

        {/* 2 — Last Scan Summary (executive briefing) */}
        <LastScanSummary
          projectId={project.id}
          brand={project.name}
          score={latest.overall_score}
          delta={delta}
          engines={platforms.map((p) => ({
            id: p.id,
            label: p.label,
            color: p.color,
            score: p.score,
            delta: p.delta,
            citations: p.citations,
          }))}
          topAction={topAction}
          activity={activity}
          lastScanAt={lastDone?.completed_at ?? latest.created_at}
          nextScanAt={nextScanAt}
          shareUrl={shareUrl}
        />

        {/* 3 — AI Platform Performance */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("dashboard.platformPerformance")}</h2>
            <Link href="/monitor" className="text-xs text-accent-strong hover:underline">
              {t("dashboard.promptDetail")}
            </Link>
          </div>
          <PlatformCards platforms={platforms} />
        </section>

        {/* 4 — Visibility trend */}
        {history.length > 1 && (
          <Card>
            <CardHeader
              title={t("dashboard.visibilityTrend")}
              hint={t("dashboard.visibilityTrendHint")}
              action={
                <Link href="/improve" className="text-xs text-accent-strong hover:underline">
                  {t("dashboard.fullHistory")}
                </Link>
              }
            />
            <div className="px-3 pb-4">
              <ScoreTrend snapshots={history} />
            </div>
          </Card>
        )}

        {/* 5 — Competitor benchmark */}
        <Card>
          <CardHeader
            title={t("dashboard.competitorBenchmark")}
            hint={t("dashboard.competitorBenchmarkHint")}
            action={
              <Link href="/settings" className="text-xs text-accent-strong hover:underline">
                {t("dashboard.manageCompetitors")}
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-2">
            <SovBars shareOfVoice={latest.share_of_voice} brand={project.name} />
          </div>
        </Card>

        {/* 6 — Google Trends */}
        {limits.trends && trends.length > 0 && (
          <Card>
            <CardHeader
              title={t("dashboard.googleTrends")}
              hint={t("dashboard.googleTrendsHint", { country: project.country })}
              action={
                <Link href="/trends" className="text-xs text-accent-strong hover:underline">
                  {t("dashboard.exploreTrends")}
                </Link>
              }
            />
            <div className="divide-y divide-line px-5 pb-3">
              {trends.slice(0, 3).map((t) => (
                <div key={t.keyword} className="flex items-center gap-3 py-2.5">
                  <TrendingUp
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      t.direction === "rising" ? "text-good" : t.direction === "declining" ? "text-poor" : "text-ink-faint"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.keyword}</span>
                  <span className={cn("tabular text-xs", t.growth >= 0 ? "text-good" : "text-poor")}>
                    {t.growth >= 0 ? "+" : ""}
                    {t.growth}%
                  </span>
                  <Link
                    href={`/optimize?type=${t.suggestion.type}&topic=${encodeURIComponent(t.keyword)}`}
                    className="shrink-0 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover"
                  >
                    {t.suggestion.label}
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 7 — Recommended actions */}
        <Card>
          <CardHeader
            title={t("dashboard.recommendedActions")}
            hint={t("dashboard.recommendedActionsHint")}
            action={
              <ButtonLink href="/optimize" variant="secondary" size="sm">
                {t("dashboard.allActions")} <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <div className="divide-y divide-line px-5 pb-3">
            {openRecs.length === 0 && (
              <p className="py-4 text-sm text-ink-faint">{t("dashboard.nothingOpen")}</p>
            )}
            {openRecs.slice(0, 3).map((r) => (
              <Link key={r.id} href="/optimize" className="group flex items-center gap-3 py-3">
                <Badge tone={r.priority === "high" ? "poor" : r.priority === "medium" ? "mid" : "neutral"}>
                  {r.priority}
                </Badge>
                <span className="flex-1 text-sm text-ink group-hover:text-accent-strong">
                  {r.title}
                </span>
                <span className="hidden text-xs text-ink-faint sm:block">{r.effort}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* 8 — Weekly progress */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold">{t("dashboard.weeklyProgress")}</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label={t("dashboard.mentionRate")}
              value={pct(latest.mention_rate)}
              hint={pp(latest.mention_rate, previous?.mention_rate) ?? t("dashboard.ofBuyerPrompts")}
            />
            <StatTile
              label={t("dashboard.recommendedRate")}
              value={pct(latest.recommendation_rate)}
              hint={pp(latest.recommendation_rate, previous?.recommendation_rate) ?? t("dashboard.ofBuyerPrompts")}
            />
            <StatTile
              label={t("dashboard.avgPosition")}
              value={latest.avg_position ? `#${latest.avg_position.toFixed(1)}` : "—"}
              hint={t("dashboard.whenMentioned")}
            />
            <StatTile
              label={t("dashboard.platformCoverage")}
              value={pct(latest.coverage)}
              hint={t("dashboard.ofPlatforms", { count: ENGINES.length })}
            />
          </div>
        </section>

        {/* 9 — Recent reports */}
        <Card>
          <CardHeader
            title={t("dashboard.recentReports")}
            hint={t("dashboard.recentReportsHint")}
            action={
              <Link href="/reports" className="text-xs text-accent-strong hover:underline">
                {t("dashboard.allReports")}
              </Link>
            }
          />
          <div className="divide-y divide-line px-5 pb-3">
            {activeLinks.length === 0 && (
              <p className="py-4 text-sm text-ink-faint">
                <Link href="/reports" className="text-accent-strong underline">
                  {t("nav.reports")}
                </Link>
                {" — "}
                {t("dashboard.noShareLinks")}
              </p>
            )}
            {activeLinks.map((l) => (
              <div key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Badge tone="accent">public</Badge>
                <code className="tabular flex-1 truncate text-xs text-ink-soft">/share/{l.token}</code>
                <span className="hidden text-xs text-ink-faint sm:block">
                  created {formatDate(l.created_at)}
                </span>
              </div>
            ))}
            <div className="flex gap-2 py-3">
              <a
                href={`/api/reports/export?projectId=${project.id}&format=md`}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-hover"
              >
                <Download className="h-3 w-3" /> Markdown
              </a>
              <a
                href={`/api/reports/export?projectId=${project.id}&format=csv`}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-hover"
              >
                <Download className="h-3 w-3" /> CSV
              </a>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
