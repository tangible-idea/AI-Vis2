import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { planForPolarProduct } from "@/lib/billing/polar";
import type { Plan } from "@/lib/types";

/**
 * Polar.sh webhook → subscription entitlements. Polar signs with the
 * Standard Webhooks scheme (webhook-id/-timestamp/-signature headers,
 * HMAC-SHA256 over "id.timestamp.body"). Set POLAR_WEBHOOK_SECRET from the
 * webhook's settings page.
 *
 * subscription.active|updated (status active)  → plan from product id
 * subscription.canceled|revoked                → free
 */
export async function POST(request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const body = await request.text();
  if (!verifySignature(request.headers, body, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: PolarSubscription };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type = event.type ?? "";
  const sub = event.data;
  if (!type.startsWith("subscription.") || !sub) {
    return NextResponse.json({ received: true }); // event we don't act on
  }

  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.warn("[polar] subscription event without user_id metadata:", type);
    return NextResponse.json({ received: true });
  }

  let plan: Plan | null = null;
  if (type === "subscription.canceled" || type === "subscription.revoked") {
    plan = "free";
  } else if (sub.status === "active") {
    plan = sub.product_id ? planForPolarProduct(sub.product_id) : null;
  }

  if (plan) {
    const db = createAdminClient();
    const { error } = await db.from("profiles").update({ plan }).eq("id", userId);
    if (error) {
      console.error("[polar] plan update failed:", error.message);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

interface PolarSubscription {
  status?: string;
  product_id?: string;
  metadata?: { user_id?: string };
}

function verifySignature(headers: Headers, body: string, secret: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  // reject stale deliveries (5 min tolerance)
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  // header may list several space-separated "v1,<sig>" entries
  return signature.split(" ").some((part) => {
    const candidate = part.split(",")[1] ?? "";
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
