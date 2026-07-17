"use client";

import { useState } from "react";
import { PlanComparison } from "@/components/plan-comparison";
import type { Plan } from "@/lib/types";

/** Billing-mode plan comparison with inline error display. */
export function BillingPlans({ currentPlan }: { currentPlan: Plan }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <p className="mb-3 text-sm text-poor">{error}</p>}
      <PlanComparison currentPlan={currentPlan} onError={(m) => setError(m || null)} />
    </>
  );
}
