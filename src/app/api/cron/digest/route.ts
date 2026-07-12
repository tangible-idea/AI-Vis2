import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getEmailSender } from "@/lib/email";
import { buildWeeklyDigest } from "@/lib/email/digest";
import { planLimits } from "@/lib/plans";
import type { Plan } from "@/lib/types";

export const maxDuration = 120;

/**
 * Weekly digest — invoked by Vercel cron (see vercel.json).
 * Sends the latest snapshot summary to every user whose plan includes
 * weekly reports.
 */
export async function GET(request: Request) {
  // Vercel cron sends Authorization: Bearer $CRON_SECRET when configured
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const sender = getEmailSender();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: profiles } = await db
    .from("profiles")
    .select("id, email, plan")
    .not("email", "is", null);

  let sent = 0;
  for (const profile of profiles ?? []) {
    if (!planLimits(profile.plan as Plan).weeklyReports) continue;

    const { data: projects } = await db
      .from("projects")
      .select("*")
      .eq("user_id", profile.id)
      .eq("is_demo", false)
      .is("archived_at", null);

    for (const project of projects ?? []) {
      const { data: snapshots } = await db
        .from("snapshots")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(2);
      if (!snapshots?.length) continue;

      const { data: recs } = await db
        .from("recommendations")
        .select("*")
        .eq("project_id", project.id)
        .eq("status", "todo")
        .order("created_at", { ascending: false })
        .limit(3);

      const digest = buildWeeklyDigest({
        project,
        snapshot: snapshots[0],
        previous: snapshots[1] ?? null,
        recommendations: recs ?? [],
        appUrl,
      });
      const result = await sender.send({ to: profile.email!, ...digest });
      if (result.ok) sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
