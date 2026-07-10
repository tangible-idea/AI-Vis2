import type { Plan } from "../types";
import { PolarBillingProvider, isPolarConfigured } from "./polar";

/**
 * Billing abstraction. Polar.sh is the production provider (lib/billing/
 * polar.ts + /api/webhooks/polar); until its env vars are set, the stub
 * flips plans immediately ("demo checkout") so the product stays fully
 * usable in development.
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
  return isPolarConfigured() ? new PolarBillingProvider() : new StubBillingProvider();
}
