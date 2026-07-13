import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingProvider } from "@/lib/billing/provider";
import { planLimits } from "@/lib/plans";
import type { Plan } from "@/lib/types";

/**
 * POST { plan } → change plan. With Polar configured this returns a
 * checkoutUrl to redirect to — the plan only flips once Polar's webhook
 * confirms the subscription. The dev stub flips instantly.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = (await request.json()) as { plan: Plan };
  if (!["free", "starter", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // downgrade guard: active projects must fit inside the target plan
  const target = planLimits(plan);
  const { count: activeProjects } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_demo", false)
    .is("archived_at", null);
  if ((activeProjects ?? 0) > target.maxProjects) {
    return NextResponse.json(
      {
        error: `You have ${activeProjects} active projects, but the ${target.label} plan includes ${target.maxProjects}. Archive or delete projects in Settings before switching.`,
      },
      { status: 400 }
    );
  }

  const billing = getBillingProvider();
  const result = await billing.changePlan(user.id, plan);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  // real checkout: redirect, entitlement lands via webhook
  if (result.checkoutUrl) {
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
  }

  // stub path: flip immediately
  const { error } = await supabase.from("profiles").update({ plan }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plan });
}
