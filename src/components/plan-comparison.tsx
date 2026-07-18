"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { PLANS, PLAN_FEATURES } from "@/lib/plans";
import type { PlanLimits } from "@/lib/plans";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: ("free" | "starter" | "pro")[] = ["free", "starter", "pro"];

const TAGLINES: Record<(typeof ORDER)[number], string> = {
  free: "See where you stand",
  starter: "Measure, improve and report — weekly",
  pro: "Everything in Starter, plus higher limits & white label",
};

/**
 * One pricing/feature matrix, shared by the public pricing page and the
 * in-app billing page so the two never drift.
 *
 * - No `currentPlan` → marketing mode: "Start free / Start with …" links.
 * - `currentPlan` set → billing mode: switch buttons calling /api/billing,
 *   with the active plan highlighted.
 */
export function PlanComparison({
  currentPlan,
  onError,
}: {
  currentPlan?: Plan;
  onError?: (msg: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Plan | null>(null);
  const billingMode = currentPlan !== undefined;

  async function choose(plan: Plan) {
    setBusy(plan);
    onError?.("");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError?.(data.error ?? "Could not change plan. Please try again.");
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // Polar hosted checkout / portal
        return;
      } else {
        router.refresh();
      }
    } catch {
      onError?.("Could not change plan. Please try again.");
    }
    setBusy(null);
  }

  const colClass = (plan: string, extra = "") =>
    cn(plan === "starter" && "bg-accent-soft", extra);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="w-1/3" />
            {ORDER.map((plan) => (
              <th key={plan} className={colClass(plan, "rounded-t-xl px-4 pb-4 pt-5 text-center align-top")}>
                {plan === "starter" && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-accent-strong">
                    Most popular
                  </p>
                )}
                <p className="text-sm font-semibold">{PLANS[plan].label}</p>
                <p className="mt-1">
                  <span className="tabular text-2xl font-medium">{PLANS[plan].price}</span>
                  <span className="ml-1 text-xs font-normal text-ink-faint">{PLANS[plan].priceNote}</span>
                </p>
                {billingMode && plan === currentPlan ? (
                  <p className="mt-1 text-[11px] font-semibold text-accent-strong">Current plan</p>
                ) : (
                  <p className="mt-1 text-[11px] font-normal leading-snug text-ink-faint">{TAGLINES[plan]}</p>
                )}
                {/* surface the Pro value in-table (not only in notes below) */}
                {plan === "pro" && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent-strong">
                    <Check className="h-3 w-3" /> Includes everything in Starter
                  </p>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_FEATURES.map((row) => (
            <tr key={row.label}>
              <td className="border-t border-line py-2.5 pr-4 text-[13px] text-ink-soft">
                {row.group && (
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                    {row.group}
                  </span>
                )}
                {row.label}
                {row.note && (
                  <span className="mt-0.5 block text-[11px] italic leading-snug text-ink-faint">{row.note}</span>
                )}
              </td>
              {ORDER.map((plan) => {
                const content = row.values
                  ? row.values[ORDER.indexOf(plan)]
                  : PLANS[plan][row.key as keyof PlanLimits];
                return (
                  <td key={plan} className={colClass(plan, "border-t border-line px-4 py-2.5 text-center text-[13px]")}>
                    {typeof content === "boolean" ? (
                      content ? (
                        <Check className="mx-auto h-4 w-4 text-accent" />
                      ) : (
                        <Minus className="mx-auto h-3.5 w-3.5 text-line-strong" />
                      )
                    ) : (
                      <span className="tabular">{content}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* CTA row */}
          <tr>
            <td className="pt-5" />
            {ORDER.map((plan) => (
              <td key={plan} className={colClass(plan, "px-4 pb-5 pt-5 text-center align-top rounded-b-xl")}>
                {billingMode ? (
                  <button
                    disabled={plan === currentPlan || busy !== null}
                    onClick={() => choose(plan)}
                    className={cn(
                      "inline-flex h-9 w-full max-w-36 cursor-pointer items-center justify-center rounded-lg text-sm font-medium disabled:cursor-default disabled:opacity-60",
                      plan === currentPlan
                        ? "border border-line-strong text-ink-soft"
                        : plan === "starter"
                          ? "bg-ink text-paper hover:bg-ink/85"
                          : "border border-line-strong hover:bg-hover"
                    )}
                  >
                    {plan === currentPlan
                      ? "Current plan"
                      : busy === plan
                        ? "Switching…"
                        : `Switch to ${PLANS[plan].label}`}
                  </button>
                ) : (
                  <Link
                    href="/signup"
                    className={cn(
                      "inline-flex h-9 w-full max-w-36 items-center justify-center rounded-lg text-sm font-medium",
                      plan === "starter" ? "bg-ink text-paper hover:bg-ink/85" : "border border-line-strong hover:bg-hover"
                    )}
                  >
                    {plan === "free" ? "Start free" : `Start with ${PLANS[plan].label}`}
                  </Link>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
