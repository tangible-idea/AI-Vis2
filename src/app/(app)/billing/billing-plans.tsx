"use client";

import { useState } from "react";
import { PlanComparison } from "@/components/plan-comparison";
import type { PlanColumn, PlanMatrixRow } from "@/lib/plans";
import type { Plan } from "@/lib/types";

/** Billing-mode plan comparison with inline error display. */
export function BillingPlans({
  currentPlan,
  columns,
  rows,
}: {
  currentPlan: Plan;
  columns: PlanColumn[];
  rows: PlanMatrixRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <p className="mb-3 text-sm text-poor">{error}</p>}
      <PlanComparison
        columns={columns}
        rows={rows}
        currentPlan={currentPlan}
        onError={(m) => setError(m || null)}
      />
    </>
  );
}
