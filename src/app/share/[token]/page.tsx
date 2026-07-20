import Link from "next/link";
import { industryLabel } from "@/lib/types";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { formatDate, pct } from "@/lib/utils";
import { Card, CardHeader, Badge } from "@/components/ui";
import { LegalLinks } from "@/components/legal-links";
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

  // white-label branding (Pro): otherwise the report carries the Sightline identity
  const { data: ownerProfile } = await db
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .maybeSingle();
  let branding: { name: string; website: string | null; logo_url: string | null } | null = null;
  if (planLimits(ownerProfile?.plan).whiteLabel) {
    const { data: org } = await db
      .from("organizations")
      .select("name, website, logo_url")
      .eq("owner_id", project.user_id)
      .maybeSingle();
    if (org?.name) branding = org;
  }

  const history = (snapshots ?? []) as Snapshot[];
  const latest = history.at(-1);
  const previous = history.at(-2);

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const topRec =
    (recs ?? [])
      .filter((r) => r.status !== "done")
      .sort(
        (a, b) =>
          priorityRank[a.priority as keyof typeof priorityRank] -
          priorityRank[b.priority as keyof typeof priorityRank]
      )[0] ?? null;

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
              {project.website} · {industryLabel(project.industry)} · {formatDate(latest?.created_at)}
            </p>
          </div>
          <span className="flex items-center gap-2 font-display text-lg text-ink-faint">
            {branding?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
            )}
            {branding?.name ?? "Sightline"}
          </span>
        </header>

        {!latest ? (
          <Card className="p-8 text-center text-sm text-ink-faint">No scan data yet.</Card>
        ) : (
          <div className="space-y-4">
            {/* executive summary — readable in under two minutes */}
            <Card className="print-block p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <ScoreHero
                  score={latest.overall_score}
                  delta={previous ? latest.overall_score - previous.overall_score : null}
                  label="AI Visibility Score"
                />
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-right">
                  <ExecStat
                    label="Competitor position"
                    value={competitorPosition(latest.share_of_voice, project.name)}
                  />
                  <ExecStat
                    label="Platforms improved"
                    value={
                      previous
                        ? `${
                            Object.keys(latest.engine_scores).filter(
                              (e) => (latest.engine_scores[e as keyof typeof latest.engine_scores] ?? 0) > (previous.engine_scores?.[e as keyof typeof previous.engine_scores] ?? 0)
                            ).length
                          } of ${Object.keys(latest.engine_scores).length}`
                        : "—"
                    }
                  />
                  <ExecStat label="Mention rate" value={pct(latest.mention_rate)} />
                  <ExecStat label="Recommended" value={pct(latest.recommendation_rate)} />
                </div>
              </div>
              {topRec && (
                <div className="mt-5 rounded-lg bg-accent-soft px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-accent-strong">
                    Top recommendation
                  </p>
                  <p className="mt-0.5 text-sm text-ink">{topRec.title}</p>
                </div>
              )}
              {history.length > 1 && (
                <div className="mt-4">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                    Recent progress
                  </p>
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

        <footer className="mt-10 space-y-2 text-center text-xs text-ink-faint">
          {branding ? (
            <p>
              Prepared by{" "}
              {branding.website ? (
                <a
                  href={branding.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-strong hover:underline"
                >
                  {branding.name}
                </a>
              ) : (
                branding.name
              )}
            </p>
          ) : (
            <p>
              Generated with Sightline ·{" "}
              <Link href="/" className="text-accent-strong hover:underline">
                Run your free AI Visibility Scan
              </Link>
            </p>
          )}
          <LegalLinks className="justify-center" />
        </footer>
      </div>
    </div>
  );
}

function ExecStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

/** "#2 of 4" — the brand's rank by mentions among everyone tracked. */
function competitorPosition(shareOfVoice: Record<string, number>, brand: string): string {
  const sorted = Object.entries(shareOfVoice ?? {}).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return "—";
  const rank = sorted.findIndex(([name]) => name === brand) + 1;
  return rank ? `#${rank} of ${sorted.length}` : "—";
}
