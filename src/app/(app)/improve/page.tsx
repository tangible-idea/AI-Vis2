import { CheckCircle2 } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { historyCutoffIso, planLimits } from "@/lib/plans";
import { formatDate, pct } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ScoreTrend, EngineTrend, SovBars, StatTile } from "@/components/charts";
import { getT } from "@/lib/i18n/server";
import type { Recommendation, Snapshot } from "@/lib/types";

export const metadata = { title: "Improve" };

export default async function ImprovePage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);
  const t = await getT();

  const [{ data: snapshots }, { data: doneRecs }] = await Promise.all([
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
      .eq("status", "done")
      .order("completed_at", { ascending: false }),
  ]);

  const history = (snapshots ?? []) as Snapshot[];
  const latest = history.at(-1);
  const first = history[0];

  if (!latest || history.length < 2) {
    return (
      <>
        <PageHeader title={t("improve.title")} subtitle={t("improve.subtitleEmpty")} />
        <EmptyState title={t("improve.notEnough")} body={t("improve.notEnoughBody")} />
      </>
    );
  }

  const scoreDelta = latest.overall_score - first.overall_score;
  const mentionDelta = latest.mention_rate - first.mention_rate;
  const recDelta = latest.recommendation_rate - first.recommendation_rate;

  return (
    <>
      <PageHeader
        title={t("improve.title")}
        subtitle={t("improve.subtitle", { count: history.length, date: formatDate(first.created_at) })}
      />

      <div className="stagger space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label={t("improve.scoreChange")}
            value={`${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`}
            hint={t("improve.sinceFirstScan")}
          />
          <StatTile
            label={t("improve.mentionRate")}
            value={`${mentionDelta >= 0 ? "+" : ""}${Math.round(mentionDelta * 100)}pp`}
            hint={t("improve.now", { value: pct(latest.mention_rate) })}
          />
          <StatTile
            label={t("improve.recommendationRate")}
            value={`${recDelta >= 0 ? "+" : ""}${Math.round(recDelta * 100)}pp`}
            hint={t("improve.now", { value: pct(latest.recommendation_rate) })}
          />
          <StatTile
            label={t("improve.actionsCompleted")}
            value={String((doneRecs ?? []).length)}
            hint={t("improve.allTime")}
          />
        </div>

        <Card>
          <CardHeader title={t("improve.scoreOverTime")} />
          <div className="px-3 pb-4">
            <ScoreTrend snapshots={history} />
          </div>
        </Card>

        <Card>
          <CardHeader title={t("improve.engineTrends")} hint={t("improve.engineTrendsHint")} />
          <div className="px-3 pb-4">
            <EngineTrend snapshots={history} />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("improve.sovThen")} hint={formatDate(first.created_at)} />
            <div className="px-5 pb-5 pt-1">
              <SovBars shareOfVoice={first.share_of_voice} brand={project.name} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t("improve.sovNow")} hint={formatDate(latest.created_at)} />
            <div className="px-5 pb-5 pt-1">
              <SovBars shareOfVoice={latest.share_of_voice} brand={project.name} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title={t("improve.completedActions")} hint={t("improve.completedHint")} />
          <div className="divide-y divide-line px-5 pb-3">
            {(doneRecs ?? []).length === 0 && (
              <p className="py-4 text-sm text-ink-faint">{t("improve.nothingCompleted")}</p>
            )}
            {((doneRecs ?? []) as Recommendation[]).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-good" />
                <span className="flex-1 text-sm text-ink-soft">{r.title}</span>
                <span className="text-xs text-ink-faint">{formatDate(r.completed_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
