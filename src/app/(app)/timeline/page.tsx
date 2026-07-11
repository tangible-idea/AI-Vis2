import { Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { buildTimeline } from "@/lib/timeline";
import { historyCutoffIso, planLimits } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { TimelineFeed } from "./feed";
import { RecapActions } from "./recap-actions";

export const metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const { project, userId, profile } = await requireProject();
  const supabase = await createClient();
  const t = await getT();

  const [{ events, insights, achievements, recap }, { data: membership }] = await Promise.all([
    buildTimeline(supabase, project, { sinceIso: historyCutoffIso(planLimits(profile.plan)) }),
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", project.id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const isOwner = project.user_id === userId;
  const canComment = isOwner || membership?.role === "member";

  const recapSummary = recap
    ? [
        `${project.name} — AI visibility, last 30 days`,
        `Score: ${recap.scoreDelta >= 0 ? "+" : ""}${recap.scoreDelta} points`,
        ...recap.engineDeltas.map((e) => `${e.label}: ${e.delta >= 0 ? "+" : ""}${e.delta}`),
        `New citations: ${recap.newCitations}`,
        `Competitors surpassed: ${recap.competitorsSurpassed}`,
        `Content generated: ${recap.contentGenerated}`,
        `Recommendations completed: ${recap.recommendationsCompleted}`,
      ].join("\n")
    : "";

  return (
    <>
      <PageHeader title={t("timeline.title")} subtitle={t("timeline.subtitle")} />

      <div className="stagger space-y-4">
        {/* key insights */}
        {insights.length > 0 && (
          <Card className="border-accent/30 bg-accent-soft/40">
            <CardHeader title={t("timeline.keyInsights")} hint={t("timeline.keyInsightsHint")} />
            <div className="divide-y divide-line/70 px-5 pb-3">
              {insights.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-2.5">
                  <Sparkles className={cn("h-4 w-4 shrink-0", ev.tone === "bad" ? "text-poor" : "text-accent-strong")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{ev.title}</p>
                    {ev.summary && <p className="truncate text-xs text-ink-soft">{ev.summary}</p>}
                  </div>
                  {ev.action && (
                    <Link
                      href={ev.action.href}
                      className="shrink-0 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-medium text-paper hover:bg-ink/85"
                    >
                      {ev.action.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* feed */}
          <Card className="print-block">
            <CardHeader title={t("timeline.activity")} hint={t("timeline.activityHint")} />
            <div className="px-5 pb-5">
              <TimelineFeed projectId={project.id} events={events} canComment={canComment} />
            </div>
          </Card>

          <div className="space-y-4">
            {/* monthly recap */}
            {recap && (
              <Card className="print-block">
                <CardHeader title={t("timeline.thisMonth")} hint={t("timeline.thisMonthHint")} />
                <div className="px-5 pb-5">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "tabular text-3xl font-medium",
                        recap.scoreDelta > 0 ? "text-good" : recap.scoreDelta < 0 ? "text-poor" : "text-ink"
                      )}
                    >
                      {recap.scoreDelta >= 0 ? "▲ +" : "▼ "}
                      {Math.abs(recap.scoreDelta)}
                    </span>
                    <span className="text-xs text-ink-faint">AI Visibility</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {recap.engineDeltas.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span className="text-ink-soft">{e.label}</span>
                        <span
                          className={cn(
                            "tabular font-medium",
                            e.delta > 0 ? "text-good" : e.delta < 0 ? "text-poor" : "text-ink-faint"
                          )}
                        >
                          {e.delta >= 0 ? "+" : ""}
                          {e.delta}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
                    <RecapStat label="New citations" value={recap.newCitations} />
                    <RecapStat label="Rivals surpassed" value={recap.competitorsSurpassed} />
                    <RecapStat label="Content created" value={recap.contentGenerated} />
                    <RecapStat label="Actions done" value={recap.recommendationsCompleted} />
                  </div>
                  <div className="mt-4">
                    <RecapActions brand={project.name} summary={recapSummary} />
                  </div>
                </div>
              </Card>
            )}

            {/* achievements */}
            <Card>
              <CardHeader title="Achievements" hint="Milestones on your visibility journey" />
              <div className="space-y-2 px-5 pb-5">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2",
                      a.achieved ? "border-good/25 bg-good-soft" : "border-line bg-paper opacity-60"
                    )}
                  >
                    <Trophy className={cn("h-3.5 w-3.5 shrink-0", a.achieved ? "text-good" : "text-ink-faint")} />
                    <span className={cn("text-xs font-medium", a.achieved ? "text-ink" : "text-ink-faint")}>
                      {a.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function RecapStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="tabular text-lg font-medium text-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
    </div>
  );
}
