import { CheckCircle2 } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { formatDate, pct } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ScoreTrend, EngineTrend, SovBars, StatTile } from "@/components/charts";
import type { Recommendation, Snapshot } from "@/lib/types";

export const metadata = { title: "Improve" };

export default async function ImprovePage() {
  const { project } = await requireProject();
  const supabase = await createClient();

  const [{ data: snapshots }, { data: doneRecs }] = await Promise.all([
    supabase
      .from("snapshots")
      .select("*")
      .eq("project_id", project.id)
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
        <PageHeader title="Improve" subtitle="Week-over-week progress tracking" />
        <EmptyState
          title="Not enough history yet"
          body="Improve compares scans over time. Run at least two scans (ideally a week apart) to see trends, share-of-voice shifts and before/after impact."
        />
      </>
    );
  }

  const scoreDelta = latest.overall_score - first.overall_score;
  const mentionDelta = latest.mention_rate - first.mention_rate;
  const recDelta = latest.recommendation_rate - first.recommendation_rate;

  return (
    <>
      <PageHeader
        title="Improve"
        subtitle={`Tracking ${history.length} scans since ${formatDate(first.created_at)}`}
      />

      <div className="stagger space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Score change"
            value={`${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`}
            hint="since first scan"
          />
          <StatTile
            label="Mention rate"
            value={`${mentionDelta >= 0 ? "+" : ""}${Math.round(mentionDelta * 100)}pp`}
            hint={`now ${pct(latest.mention_rate)}`}
          />
          <StatTile
            label="Recommendation rate"
            value={`${recDelta >= 0 ? "+" : ""}${Math.round(recDelta * 100)}pp`}
            hint={`now ${pct(latest.recommendation_rate)}`}
          />
          <StatTile label="Actions completed" value={String((doneRecs ?? []).length)} hint="all time" />
        </div>

        <Card>
          <CardHeader title="Visibility Score over time" />
          <div className="px-3 pb-4">
            <ScoreTrend snapshots={history} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Engine trends" hint="Which engines are improving" />
          <div className="px-3 pb-4">
            <EngineTrend snapshots={history} />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Share of voice — then" hint={formatDate(first.created_at)} />
            <div className="px-5 pb-5 pt-1">
              <SovBars shareOfVoice={first.share_of_voice} brand={project.name} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Share of voice — now" hint={formatDate(latest.created_at)} />
            <div className="px-5 pb-5 pt-1">
              <SovBars shareOfVoice={latest.share_of_voice} brand={project.name} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Completed actions" hint="What you shipped" />
          <div className="divide-y divide-line px-5 pb-3">
            {(doneRecs ?? []).length === 0 && (
              <p className="py-4 text-sm text-ink-faint">
                Nothing completed yet — mark actions done on Optimize as you ship them.
              </p>
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
