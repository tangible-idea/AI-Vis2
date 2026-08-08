import { NextResponse, after } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { runScan } from "@/lib/scan/runner";
import { periodStartIso, planLimits, scanAllowance } from "@/lib/plans";

export const maxDuration = 300;

/** POST { projectId } → creates a scan and runs it after the response. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, trigger = "manual" } = await request.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, archived_at")
    .eq("id", projectId)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.archived_at) {
    return NextResponse.json(
      { error: "This project is archived. Restore it in Settings to run scans." },
      { status: 403 }
    );
  }

  // plan gating uses the workspace owner's plan (members share the quota)
  const admin = createAdminClient();
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();
  const limits = planLimits(ownerProfile?.plan);

  // free plans meter a lifetime total across every project the owner has;
  // paid plans meter this calendar month, per project
  const allowance = scanAllowance(limits);
  const query = admin
    .from("scans")
    .select("id", { count: "exact", head: true })
    .neq("trigger", "demo")
    .gte("created_at", periodStartIso(allowance));
  const { count } = await (allowance.lifetime
    ? query.eq("user_id", project.user_id)
    : query.eq("project_id", projectId));
  if ((count ?? 0) >= allowance.limit) {
    return NextResponse.json(
      {
        error: allowance.lifetime
          ? `Your ${limits.label} plan includes ${allowance.limit} scans total. Upgrade for weekly scans and trends.`
          : `Your ${limits.label} plan includes ${allowance.limit} scans per month. Upgrade to run more.`,
        code: "limit",
      },
      { status: 403 }
    );
  }

  const { data: scan, error } = await supabase
    .from("scans")
    .insert({
      user_id: user.id,
      project_id: projectId,
      trigger: trigger === "onboarding" ? "onboarding" : "manual",
    })
    .select()
    .single();
  if (error || !scan) {
    return NextResponse.json({ error: error?.message ?? "Failed to create scan" }, { status: 500 });
  }

  after(() => runScan(scan.id));

  return NextResponse.json({ scanId: scan.id });
}

/** GET ?id=… → scan status for polling. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: scan } = await supabase
    .from("scans")
    .select("id, status, error, progress, started_at, completed_at")
    .eq("id", id)
    .single();
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(scan);
}
