import { Download, Printer } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ShareManager } from "./share-manager";
import { PrintButton } from "./print-button";
import type { ShareLink } from "@/lib/types";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);

  const { data: links } = await supabase
    .from("share_links")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Export, share and present your AI visibility"
      />

      <div className="stagger space-y-4">
        <Card>
          <CardHeader title="Export" hint="Latest scan, ready to send" />
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
