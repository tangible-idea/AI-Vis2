import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";

/**
 * POST { code } → self-service lifetime-plan activation. The code is
 * claimed atomically (single conditional UPDATE — no double redemption)
 * and the profile flips to the plan it maps to. Idempotent for the user
 * who already redeemed the code. Codes live in redemption_codes
 * (service-role only) and are seeded per partner campaign.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code: rawCode } = (await request.json().catch(() => ({}))) as { code?: string };
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!code || code.length > 64) {
    return NextResponse.json({ error: "Please enter your code." }, { status: 400 });
  }

  const admin = createAdminClient();

  // atomic claim: only succeeds while the code is unredeemed
  const { data: claimed } = await admin
    .from("redemption_codes")
    .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
    .eq("code", code)
    .is("redeemed_by", null)
    .select("plan")
    .maybeSingle();

  let plan = claimed?.plan;
  if (!plan) {
    // already redeemed by this same account? treat as success (idempotent)
    const { data: existing } = await admin
      .from("redemption_codes")
      .select("plan, redeemed_by")
      .eq("code", code)
      .maybeSingle();
    if (existing?.redeemed_by === user.id) {
      plan = existing.plan;
    } else {
      return NextResponse.json(
        { error: "This code is invalid or has already been redeemed. Check the code and try again." },
        { status: 400 }
      );
    }
  }

  const { error } = await admin.from("profiles").update({ plan }).eq("id", user.id);
  if (error) {
    console.error("[redeem] plan update failed:", error.message);
    return NextResponse.json({ error: "Activation failed — please try again." }, { status: 500 });
  }

  const limits = planLimits(plan as "lifetime");
  return NextResponse.json({
    ok: true,
    plan,
    summary: {
      projects: limits.maxProjects,
      prompts: limits.maxPrompts,
      scansPerMonth: limits.scansPerMonth,
    },
  });
}
