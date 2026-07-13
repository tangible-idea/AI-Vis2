"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Plan } from "@/lib/types";

const ORDER: Plan[] = ["free", "starter", "pro"];

const HIGHLIGHTS: Partial<Record<Plan, string[]>> = {
  free: ["5 tracked prompts", "5 scans total", "2 competitors", "Partial dashboard"],
  starter: [
    "20 prompts · 30 scans / month",
    "10 competitors · 3 team seats",
    "Content & schema generation, llms.txt",
    "Trends · weekly reports · share links",
  ],
  pro: [
    "Everything in Starter",
    "50 prompts · 100 scans / month",
    "30 competitors · 8 projects & markets · 10 seats",
    "White label reports",
  ],
};

export function PlanPicker({ currentPlan }: { currentPlan: Plan }) {
  const [busy, setBusy] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();

  async function choose(plan: Plan) {
    setBusy(plan);
    setError(null);
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t("billing.planError"));
    } else if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl; // Polar hosted checkout / portal
      return;
    } else {
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <>
      {currentPlan === "lifetime" && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-ink">
          {t("billing.lifetimeNote")}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-poor">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((plan) => {
          const p = PLANS[plan];
          const isCurrent = plan === currentPlan;
          const featured = plan === "starter";
          return (
            <Card
              key={plan}
              className={cn("relative flex flex-col p-5", featured && "border-accent shadow-pop")}
            >
              {featured && (
                <Badge tone="accent" className="absolute -top-2.5 left-4">
                  {t("billing.mostPopular")}
                </Badge>
              )}
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="tabular text-3xl font-medium">{p.price}</span>
                <span className="text-xs text-ink-faint">{p.priceNote}</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {(HIGHLIGHTS[plan] ?? []).map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[13px] text-ink-soft">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    {h}
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? "secondary" : featured ? "primary" : "secondary"}
                className="mt-5 w-full"
                disabled={isCurrent || busy !== null}
                onClick={() => choose(plan)}
              >
                {isCurrent
                  ? t("billing.currentPlan")
                  : busy === plan
                    ? t("billing.switching")
                    : t("billing.switchTo", { plan: p.label })}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">
        Billing runs on Polar.sh once configured (see <code className="tabular">.env.example</code>);
        until then plans switch instantly as a demo.
      </p>
    </>
  );
}
