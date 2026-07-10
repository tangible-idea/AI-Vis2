import type { Plan } from "../types";
import type { BillingProvider } from "./provider";

/**
 * Polar.sh billing (https://docs.polar.sh). Checkout-link flow:
 * changePlan() creates a hosted checkout for the target plan's product and
 * returns its URL; the plan itself is only flipped by the webhook
 * (/api/webhooks/polar) once Polar confirms the subscription. Downgrades to
 * free go through the customer portal / subscription cancellation, which
 * also lands as a webhook.
 *
 * Required env: POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID_STARTER,
 * POLAR_PRODUCT_ID_PRO. Optional: POLAR_SERVER=sandbox, POLAR_SUCCESS_URL,
 * POLAR_WEBHOOK_SECRET (webhook route).
 */

function apiBase() {
  return process.env.POLAR_SERVER === "sandbox"
    ? "https://sandbox-api.polar.sh/v1"
    : "https://api.polar.sh/v1";
}

export function polarProductIdFor(plan: Plan): string | null {
  if (plan === "starter") return process.env.POLAR_PRODUCT_ID_STARTER ?? null;
  if (plan === "pro") return process.env.POLAR_PRODUCT_ID_PRO ?? null;
  return null;
}

/** Reverse lookup: which plan a Polar product id entitles. */
export function planForPolarProduct(productId: string): Plan | null {
  if (productId === process.env.POLAR_PRODUCT_ID_STARTER) return "starter";
  if (productId === process.env.POLAR_PRODUCT_ID_PRO) return "pro";
  return null;
}

export function isPolarConfigured(): boolean {
  return Boolean(
    process.env.POLAR_ACCESS_TOKEN &&
      process.env.POLAR_PRODUCT_ID_STARTER &&
      process.env.POLAR_PRODUCT_ID_PRO
  );
}

export class PolarBillingProvider implements BillingProvider {
  name = "polar";

  async changePlan(
    userId: string,
    plan: Plan
  ): Promise<{ ok: boolean; checkoutUrl?: string; error?: string }> {
    // Downgrades / cancellations are confirmed by webhook; from the app's
    // side we send the user to the customer portal when configured.
    if (plan === "free") {
      const portal = process.env.POLAR_CUSTOMER_PORTAL_URL;
      if (portal) return { ok: true, checkoutUrl: portal };
      return { ok: false, error: "Cancel your subscription from the customer portal." };
    }

    const productId = polarProductIdFor(plan);
    if (!productId) return { ok: false, error: `No Polar product configured for ${plan}` };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const res = await fetch(`${apiBase()}/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [productId],
        success_url: process.env.POLAR_SUCCESS_URL ?? `${appUrl}/billing?checkout=success`,
        metadata: { user_id: userId, plan },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[polar] checkout create failed:", res.status, detail);
      return { ok: false, error: "Could not start checkout — please try again." };
    }

    const checkout = (await res.json()) as { url?: string };
    if (!checkout.url) return { ok: false, error: "Polar returned no checkout URL" };
    return { ok: true, checkoutUrl: checkout.url };
  }
}
