import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PLANS, PLAN_FEATURES } from "@/lib/plans";
import type { PlanLimits } from "@/lib/plans";
import type { Plan } from "@/lib/types";

export const metadata = { title: "Pricing" };

const ORDER: ("free" | "starter" | "pro")[] = ["free", "starter", "pro"];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-center text-3xl tracking-tight">
        Pricing that scales <span className="font-display italic">with your visibility</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-ink-soft">
        Start free, upgrade when the score starts moving. No credit card required.
      </p>

      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="w-1/3" />
              {ORDER.map((plan) => (
                <th
                  key={plan}
                  className={`rounded-t-xl px-4 pb-4 pt-5 text-center ${plan === "starter" ? "bg-accent-soft" : ""}`}
                >
                  <p className="text-sm font-semibold">{PLANS[plan].label}</p>
                  <p className="mt-1">
                    <span className="tabular text-2xl font-medium">{PLANS[plan].price}</span>
                    <span className="ml-1 text-xs font-normal text-ink-faint">
                      {PLANS[plan].priceNote}
                    </span>
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((row, i) => (
              <tr key={row.label}>
                <td className="border-t border-line py-2.5 pr-4 text-[13px] text-ink-soft">
                  {row.label}
                </td>
                {ORDER.map((plan) => {
                  const content = row.values
                    ? row.values[ORDER.indexOf(plan)]
                    : PLANS[plan][row.key as keyof PlanLimits];
                  return (
                    <td
                      key={plan}
                      className={`border-t border-line px-4 py-2.5 text-center text-[13px] ${plan === "starter" ? "bg-accent-soft" : ""} ${i === PLAN_FEATURES.length - 1 && plan === "starter" ? "rounded-b-none" : ""}`}
                    >
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
            <tr>
              <td className="pt-5" />
              {ORDER.map((plan) => (
                <td key={plan} className={`px-4 pt-5 text-center ${plan === "starter" ? "bg-accent-soft rounded-b-xl pb-5" : ""}`}>
                  <Link
                    href="/signup"
                    className={`inline-flex h-9 w-full max-w-36 items-center justify-center rounded-lg text-sm font-medium ${
                      plan === "starter"
                        ? "bg-ink text-paper hover:bg-ink/85"
                        : "border border-line-strong hover:bg-hover"
                    }`}
                  >
                    Start {plan === "free" ? "free" : `with ${PLANS[plan as Plan].label}`}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-center text-xs text-ink-faint">
        * Fair-use limits apply. Annual billing (2 months free) coming soon.
      </p>
    </main>
  );
}
