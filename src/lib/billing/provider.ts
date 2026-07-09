import type { Plan } from "../types";

/**
 * Billing abstraction. The MVP ships with a stub that flips the plan
 * immediately ("demo checkout"). To integrate a real PG (Stripe, PortOne),
 * implement BillingProvider and return it from getBillingProvider().
 */
export interface BillingProvider {
  name: string;
  /** Start (or simulate) a plan change; return checkout URL if a redirect is needed. */
  changePlan(userId: string, plan: Plan): Promise<{ ok: boolean; checkoutUrl?: string; error?: string }>;
}

class StubBillingProvider implements BillingProvider {
  name = "stub";
  async changePlan() {
    return { ok: true };
  }
}

export function getBillingProvider(): BillingProvider {
  return new StubBillingProvider();
}
