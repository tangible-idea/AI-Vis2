import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, pct } from "@/lib/utils";
import { Card, CardHeader, Badge } from "@/components/ui";
import { ScoreHero, ScoreTrend, EngineBars, SovBars, StatTile } from "@/components/charts";
import type { Snapshot } from "@/lib/types";

export const metadata = { title: "Shared report" };

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = createAdminClient();

  const { data: link } = await db
    .from("share_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!link) notFound();
  if (link.expires_at && new Date(link.expires_at) < new Date()) notFound();

  const [{ data: project }, { data: snapshots }, { data: recs }] = await Promise.all([
    db.from("projects").select("*").eq("id", link.project_id).single(),
    db
      .from("snapshots")
      .select("*")
      .eq("project_id", link.project_id)
      .order("created_at", { ascending: true }),
    db
      .from("recommendations")
      .select("*")
      .eq("project_id", link.project_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (!project) notFound();

  const history = (snapshots ?? []) as Snapshot[];
  const latest = history.at(-1);
  const previous = history.at(-2);

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              AI Visibility Report
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-1 text-sm text-ink-faint">
              {project.website} · {project.industry} · {formatDate(latest?.created_at)}
            </p>
          </div>
          <span className="font-display text-lg text-ink-faint">Sightline</span>
        </header>

        {!latest ? (
          <Card className="p-8 text-center text-sm text-ink-faint">No scan data yet.</Card>
        ) : (
          <div className="space-y-4">
            <Card className="print-block p-6">
              <ScoreHero
                score={latest.overall_score}
                delta={previous ? latest.overall_score - previous.overall_score : null}
              />
              {history.length > 1 && (
                <div className="mt-4">
                  <ScoreTrend snapshots={history} />
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Mention rate" value={pct(latest.mention_rate)} />
              <StatTile label="Recommended" value={pct(latest.recommendation_rate)} />
              <StatTile
                label="Avg. position"
                value={latest.avg_position ? `#${latest.avg_position.toFixed(1)}` : "—"}
              />
              <StatTile label="Coverage" value={pct(latest.coverage)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="print-block">
                <CardHeader title="Score by engine" />
                <div className="px-3 pb-4">
                  <EngineBars scores={latest.engine_scores} />
                </div>
              </Card>
              <Card className="print-block">
                <CardHeader title="Share of voice" />
                <div className="px-5 pb-5 pt-2">
                  <SovBars shareOfVoice={latest.share_of_voice} brand={project.name} />
                </div>
              </Card>
            </div>

            {(recs ?? []).length > 0 && (
              <Card className="print-block">
                <CardHeader title="Action plan" />
                <div className="divide-y divide-line px-5 pb-3">
                  {(recs ?? []).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <Badge
                        tone={
                          r.status === "done"
                            ? "good"
                            : r.priority === "high"
                              ? "poor"
                              : r.priority === "medium"
                                ? "mid"
                                : "neutral"
                        }
                      >
                        {r.status === "done" ? "done" : r.priority}
                      </Badge>
                      <span className="flex-1 text-sm text-ink-soft">{r.title}</span>
                      <span className="hidden text-xs text-ink-faint sm:block">{r.effort}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-ink-faint">
          Generated by Sightline — AI Visibility Intelligence
        </footer>
      </div>
    </div>
  );
}
