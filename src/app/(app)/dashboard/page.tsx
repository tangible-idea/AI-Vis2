import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { engineInfo } from "@/lib/ai/engines";
import { pct, timeAgo } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, Badge, ButtonLink } from "@/components/ui";
import { ScoreHero, ScoreTrend, EngineBars, SovBars, StatTile } from "@/components/charts";
import { ScanButton } from "@/components/scan-button";
import type { Engine, Snapshot } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { project } = await requireProject();
  const supabase = await createClient();

  const [{ data: snapshots }, { data: recs }, { data: lastScan }] = await Promise.all([
    supabase
      .from("snapshots")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("recommendations")
      .select("*")
      .eq("project_id", project.id)
      .eq("status", "todo")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("scans")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const history = (snapshots ?? []) as Snapshot[];
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;

  if (!latest) {
    return (
      <>
        <PageHeader
          title={project.name}
          subtitle="Your first scan will populate this dashboard."
          action={<ScanButton projectId={project.id} label="Run first scan" />}
        />
        <EmptyState
          title={lastScan?.status === "running" || lastScan?.status === "pending" ? "Scan in progress…" : "No scans yet"}
          body={
            lastScan?.status === "running" || lastScan?.status === "pending"
              ? "We're asking ChatGPT, Claude, Gemini and Perplexity about your brand. Refresh in a minute."
              : "Run a scan to see how AI engines answer your buyers' questions."
          }
        />
      </>
    );
  }

  const delta = previous ? latest.overall_score - previous.overall_score : null;
  const engineEntries = Object.entries(latest.engine_scores) as [Engine, number][];
  const best = engineEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const worst = engineEntries.reduce((a, b) => (b[1] < a[1] ? b : a));

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`Last scan ${timeAgo(lastScan?.completed_at ?? latest.created_at)} · ${project.industry}`}
        action={<ScanButton projectId={project.id} />}
      />

      <div className="stagger space-y-4">
        {/* score + trend */}
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <ScoreHero score={latest.overall_score} delta={delta} />
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Best engine</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: engineInfo(best[0]).color }}>
                  {engineInfo(best[0]).label} · {best[1]}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">Weakest engine</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {engineInfo(worst[0]).label} · {worst[1]}
                </p>
              </div>
            </div>
          </div>
          {history.length > 1 && (
            <div className="mt-4">
              <ScoreTrend snapshots={history} />
            </div>
          )}
        </Card>

        {/* stat row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Mention rate" value={pct(latest.mention_rate)} hint="of buyer prompts" />
          <StatTile label="Recommended" value={pct(latest.recommendation_rate)} hint="of buyer prompts" />
          <StatTile
            label="Avg. position"
            value={latest.avg_position ? `#${latest.avg_position.toFixed(1)}` : "—"}
            hint="when mentioned"
          />
          <StatTile label="Engine coverage" value={pct(latest.coverage)} hint="of 4 engines" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* engine breakdown */}
          <Card>
            <CardHeader
              title="Score by engine"
              hint="How visible you are on each AI engine"
              action={
                <Link href="/monitor" className="text-xs text-accent-strong hover:underline">
                  Details
                </Link>
              }
            />
            <div className="px-3 pb-4">
              <EngineBars scores={latest.engine_scores} />
            </div>
          </Card>

          {/* share of voice */}
          <Card>
            <CardHeader
              title="Share of voice"
              hint="Mentions across all engine answers"
              action={
                <Link href="/improve" className="text-xs text-accent-strong hover:underline">
                  Trend
                </Link>
              }
            />
            <div className="px-5 pb-5 pt-2">
              <SovBars shareOfVoice={latest.share_of_voice} brand={project.name} />
            </div>
          </Card>
        </div>

        {/* top actions */}
        <Card>
          <CardHeader
            title="Next best actions"
            hint="Generated from your latest scan"
            action={
              <ButtonLink href="/optimize" variant="secondary" size="sm">
                All actions <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <div className="divide-y divide-line px-5 pb-3">
            {(recs ?? []).length === 0 && (
              <p className="py-4 text-sm text-ink-faint">
                Nothing open — run a scan to refresh recommendations.
              </p>
            )}
            {(recs ?? []).map((r) => (
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
      </div>
    </>
  );
}
