import { getAppContext } from "@/lib/project";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { profile } = await getAppContext();
  const t = await getT();

  return (
    <>
      <PageHeader
        title={t("billing.title")}
        subtitle={t("billing.subtitle", { plan: profile.plan })}
      />
      <PlanPicker currentPlan={profile.plan} />
    </>
  );
}
