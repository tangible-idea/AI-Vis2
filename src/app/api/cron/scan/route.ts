import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runScan } from "@/lib/scan/runner";
import { planLimits } from "@/lib/plans";
import type { Plan } from "@/lib/types";

export const maxDuration = 300;

// leave headroom inside maxDuration so a started scan can finish cleanly
const DEADLINE_MS = 240_000;

/**
 * Scheduled monitoring — invoked by Vercel cron (see vercel.json), before
 * the weekly digest so it reports fresh data. Scans every active
 * (non-archived, non-demo) project with monitoring enabled whose owner is
 * on a plan with monthly scans, within that plan's monthly quota. Free
 * plans have a lifetime scan cap and are never auto-scanned.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const startedAt = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: profiles } = await db.from("profiles").select("id, plan");

  let scanned = 0;
  let skipped = 0;
  let deferred = 0;

  for (const profile of profiles ?? []) {
    const limits = planLimits(profile.plan as Plan);
    // scheduled monitoring is a paid feature — free plans have a lifetime cap
    if (limits.totalScans != null) continue;

    const { data: projects } = await db
      .from("projects")
      .select("id, user_id")
      .eq("user_id", profile.id)
      .eq("is_demo", false)
      .eq("auto_scan_enabled", true)
      .is("archived_at", null);

    for (const project of projects ?? []) {
      if (Date.now() - startedAt > DEADLINE_MS) {
        deferred++;
        continue;
      }

      // stay inside the plan's monthly quota, leaving room for manual scans
      const { count } = await db
        .from("scans")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .neq("trigger", "demo")
        .gte("created_at", monthStart.toISOString());
      if ((count ?? 0) >= limits.scansPerMonth) {
        skipped++;
        continue;
      }

      const { data: scan } = await db
        .from("scans")
        .insert({ user_id: project.user_id, project_id: project.id, trigger: "scheduled" })
        .select()
        .single();
      if (!scan) {
        skipped++;
        continue;
      }

      // sequential on purpose: runScan parallelizes internally, and serial
      // projects keep provider load and function memory predictable
      try {
        await runScan(scan.id);
        scanned++;
      } catch {
        skipped++; // runScan marks the scan failed; keep sweeping
      }
    }
  }

  return NextResponse.json({ ok: true, scanned, skipped, deferred });
}
