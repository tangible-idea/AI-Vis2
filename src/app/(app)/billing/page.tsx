import { getAppContext } from "@/lib/project";
import { PageHeader } from "@/components/ui";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { profile } = await getAppContext();

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`You're on the ${profile.plan} plan`}
      />
      <PlanPicker currentPlan={profile.plan} />
    </>
  );
}
