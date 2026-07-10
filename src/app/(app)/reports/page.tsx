import { Download, Printer } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { pct } from "@/lib/utils";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ShareManager } from "./share-manager";
import { PrintButton } from "./print-button";
import { SocialShare } from "./social-share";
import { ExecSummary } from "./exec-summary";
import type { ShareLink, Snapshot } from "@/lib/types";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);

  const [{ data: links }, { data: snapshots }] = await Promise.all([
    supabase
      .from("share_links")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("snapshots")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const latest = (snapshots?.[0] ?? null) as Snapshot | null;
  const previous = (snapshots?.[1] ?? null) as Snapshot | null;
  const delta = latest && previous ? latest.overall_score - previous.overall_score : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const activeLinks = ((links ?? []) as ShareLink[]).filter(
    (l) => !l.expires_at || new Date(l.expires_at) > new Date()
  );
  const shareUrl = activeLinks[0] ? `${appUrl}/share/${activeLinks[0].token}` : null;

  const metrics = latest
    ? [
        `AI Visibility Score: ${latest.overall_score}/100${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta} vs previous scan)` : ""}`,
        `Mention rate: ${pct(latest.mention_rate)}`,
        `Recommendation rate: ${pct(latest.recommendation_rate)}`,
        `Average position: ${latest.avg_position?.toFixed(1) ?? "—"}`,
        `Platform coverage: ${pct(latest.coverage)}`,
        ...Object.entries(latest.engine_scores).map(([e, s]) => `${e} score: ${s}`),
      ].join("\n")
    : "No scan data yet.";

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Export, share and present your AI visibility"
      />

      <div className="stagger space-y-4">
        <Card>
          <CardHeader
            title="Share links"
            hint="Read-only report pages for clients and execs — no login required"
          />
          <div className="px-5 pb-5">
            <ShareManager
              projectId={project.id}
              links={(links ?? []) as ShareLink[]}
              locked={!limits.shareLinks}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Share your progress"
            hint="Auto-generated social copy — edit it, then post anywhere"
          />
          <div className="px-5 pb-5">
            <SocialShare
              brand={project.name}
              score={latest?.overall_score ?? 0}
              delta={delta}
              shareUrl={shareUrl}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Executive summary"
            hint="A one-page briefing on your AI visibility, written for stakeholders"
          />
          <div className="px-5 pb-5">
            <ExecSummary projectId={project.id} metrics={metrics} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Export" hint="Latest scan, ready to send — exports carry no platform branding" />
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <a
              href={`/api/reports/export?projectId=${project.id}&format=md`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-hover"
            >
              <Download className="h-3.5 w-3.5" /> Markdown
            </a>
            <a
              href={`/api/reports/export?projectId=${project.id}&format=csv`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-hover"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </a>
            <PrintButton>
              <Printer className="h-3.5 w-3.5" /> PDF / Print
            </PrintButton>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Weekly email digest"
            hint={
              limits.weeklyReports
                ? "Enabled — sent every Monday morning with your score, trends and top actions"
                : "Available on Starter and Pro — a Monday-morning summary of score changes, competitor moves and new recommendations"
            }
          />
          <div className="px-5 pb-5">
            <p className="text-xs text-ink-faint">
              Sent to {profile.email ?? "your account email"} via Resend.
              {!limits.weeklyReports && " Upgrade on the Billing page to enable."}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
