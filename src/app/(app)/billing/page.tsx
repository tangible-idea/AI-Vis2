import { getAppContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import {
  contentAllowance,
  periodStartIso,
  planColumns,
  planLimits,
  planMatrix,
  scanAllowance,
} from "@/lib/plans";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { PlanSummary, type UsageMeter } from "./plan-summary";
import { BillingPlans } from "./billing-plans";

export const metadata = { title: "Billing" };

// Pro's "unlimited*" generations map to a fair-use ceiling; above this we
// present usage as a plain count rather than a near-full meter.
const UNLIMITED_THRESHOLD = 1000;

export default async function BillingPage() {
  const { profile, userId } = await getAppContext();
  const limits = planLimits(profile.plan);
  const t = await getT();
  const supabase = await createClient();

  // the same allowances the enforcement paths apply, counted over the same
  // window — so a meter can never read differently from what a scan is told
  const scans = scanAllowance(limits);
  const content = contentAllowance(limits);

  const [{ count: activeProjects }, { count: scansUsed }, { count: contentUsed }] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_demo", false)
      .is("archived_at", null),
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("trigger", "demo")
      .gte("created_at", periodStartIso(scans)),
    supabase
      .from("generated_content")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", periodStartIso(content)),
  ]);

  const contentUnlimited = content.limit >= UNLIMITED_THRESHOLD;
  const usage: UsageMeter[] = [
    {
      label: t("billing.usageProjects"),
      used: activeProjects ?? 0,
      limit: limits.maxProjects,
    },
    scans.lifetime
      ? {
          label: t("billing.usageScans"),
          used: scansUsed ?? 0,
          limit: scans.limit,
          hint: t("billing.usageLifetime"),
        }
      : {
          // paid scans are metered per project, so the owner-wide count here
          // is context rather than a quota to fill
          label: t("billing.usageScans"),
          used: scansUsed ?? 0,
          limit: null,
          hint: t("billing.perProjectHint", { count: scans.limit }),
        },
    {
      label: t("billing.usageContent"),
      used: contentUsed ?? 0,
      limit: contentUnlimited ? null : content.limit,
      hint: contentUnlimited
        ? t("billing.unlimitedNote")
        : content.lifetime
          ? t("billing.usageLifetime")
          : t("billing.usageThisMonth"),
    },
  ];

  return (
    <>
      <PageHeader title={t("billing.title")} subtitle={t("billing.subtitle", { plan: profile.plan })} />

      <div className="stagger space-y-4">
        <PlanSummary
          heading={t("billing.currentPlanHeading")}
          planLabel={limits.label}
          planPrice={limits.price}
          planNote={limits.priceNote}
          note={profile.plan === "lifetime" ? t("billing.lifetimeNote") : undefined}
          usage={usage}
        />

        <Card>
          <CardHeader title={t("billing.comparePlans")} hint={t("billing.comparePlansHint")} />
          <div className="px-5 pb-5">
            {/* resolved here: the client cannot see PLAN_LIMITS_JSON */}
            <BillingPlans currentPlan={profile.plan} columns={planColumns()} rows={planMatrix()} />
          </div>
        </Card>

        <p className="text-center text-xs text-ink-faint">{t("billing.billingNote")}</p>
      </div>
    </>
  );
}
