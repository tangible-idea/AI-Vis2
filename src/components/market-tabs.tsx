"use client";

import { useState, useTransition } from "react";
import { Globe2 } from "lucide-react";
import { switchProject, addMarket } from "@/app/(app)/actions";
import { COUNTRIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export interface MarketTab {
  id: string;
  country: string;
}

/**
 * Country tabs for the active brand. Each market is a sibling project
 * (same brand, different country) with its own scans, history and reports;
 * switching tabs swaps the active project cookie so every page follows.
 */
export function MarketTabs({ markets, activeId }: { markets: MarketTab[]; activeId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const used = new Set(markets.map((m) => m.country));
  const available = COUNTRIES.filter((c) => !used.has(c));

  function onAdd(country: string) {
    if (!country) return;
    setError(null);
    startTransition(async () => {
      const res = await addMarket(activeId, country);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          <Globe2 className="h-3.5 w-3.5" /> {t("market.label")}
        </span>
        {markets.map((m) => (
          <button
            key={m.id}
            onClick={() => m.id !== activeId && startTransition(() => switchProject(m.id))}
            disabled={pending}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60",
              m.id === activeId
                ? "bg-ink text-paper"
                : "border border-line-strong bg-surface text-ink-soft hover:bg-hover hover:text-ink"
            )}
          >
            {m.country}
          </button>
        ))}
        {available.length > 0 && (
          <select
            value=""
            onChange={(e) => onAdd(e.target.value)}
            disabled={pending}
            aria-label={t("market.add")}
            className="cursor-pointer appearance-none rounded-full border border-dashed border-line-strong bg-surface py-1 pl-3 pr-2 text-xs font-medium text-ink-faint hover:bg-hover hover:text-ink focus:outline-none disabled:opacity-60"
          >
            <option value="">{pending ? t("market.adding") : `+ ${t("market.add")}`}</option>
            {available.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-poor">{error}</p>}
    </div>
  );
}
