import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingProvider } from "@/lib/billing/provider";
import type { Plan } from "@/lib/types";

/**
 * POST { plan } → change plan.
 * Currently wired to the stub billing provider (no real charge); swap the
 * provider in lib/billing/provider.ts to integrate Stripe/PortOne later.
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

  const billing = getBillingProvider();
  const result = await billing.changePlan(user.id, plan);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  const { error } = await supabase.from("profiles").update({ plan }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plan });
}
