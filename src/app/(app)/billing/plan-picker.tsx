"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/types";

const ORDER: Plan[] = ["free", "starter", "pro"];

const HIGHLIGHTS: Record<Plan, string[]> = {
  free: ["5 tracked prompts", "5 scans total", "2 competitors", "Partial dashboard"],
  starter: [
    "20 prompts · 8 scans / month",
    "Trending topics",
    "Content & schema generation, llms.txt",
    "Weekly email reports · share links",
  ],
  pro: [
    "100 prompts · unlimited scans",
    "20 competitors, all markets",
    "API access & white label",
    "Team collaboration",
  ],
};

export function PlanPicker({ currentPlan }: { currentPlan: Plan }) {
  const [busy, setBusy] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function choose(plan: Plan) {
    setBusy(plan);
    setError(null);
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not change plan");
    } else {
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <>
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
                  Most popular
                </Badge>
              )}
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="tabular text-3xl font-medium">{p.price}</span>
                <span className="text-xs text-ink-faint">{p.priceNote}</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {HIGHLIGHTS[plan].map((h) => (
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
                {isCurrent ? "Current plan" : busy === plan ? "Switching…" : `Switch to ${p.label}`}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">
        Demo checkout — plans switch instantly without payment. Wire a PG in{" "}
        <code className="tabular">lib/billing/provider.ts</code>.
      </p>
    </>
  );
}
