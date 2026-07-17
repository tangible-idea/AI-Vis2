import { Gauge } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface UsageMeter {
  label: string;
  used: number;
  /** Finite cap → progress bar; null → count only (unlimited / per-project). */
  limit: number | null;
  hint?: string;
}

/**
 * "Current plan" card: the user's tier plus a quick, honest read on usage.
 * Presentational — the billing page computes the numbers and passes
 * translated strings. Mirrors the competitor "Current plan" reference
 * (tier summary + usage meters); intentionally no "buy credits" flow.
 */
export function PlanSummary({
  heading,
  planLabel,
  planPrice,
  planNote,
  note,
  usage,
}: {
  heading: string;
  planLabel: string;
  planPrice: string;
  planNote: string;
  note?: string;
  usage: UsageMeter[];
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{heading}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold">{planLabel}</span>
            <span className="tabular text-sm text-ink-soft">{planPrice}</span>
            <span className="text-xs text-ink-faint">{planNote}</span>
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-hover">
          <Gauge className="h-4.5 w-4.5 text-ink-soft" strokeWidth={1.8} />
        </span>
      </div>

      {note && <p className="mt-2 text-xs leading-relaxed text-ink-soft">{note}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {usage.map((m) => {
          const pctUsed =
            m.limit && m.limit > 0 ? Math.min(Math.round((m.used / m.limit) * 100), 100) : null;
          const near = pctUsed !== null && pctUsed >= 80;
          return (
            <div key={m.label} className="rounded-xl border border-line bg-surface p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{m.label}</p>
              <p className="tabular mt-1 text-lg font-medium text-ink">
                {m.used}
                {m.limit !== null && <span className="text-sm text-ink-faint"> / {m.limit}</span>}
              </p>
              {pctUsed !== null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hover">
                  <div
                    className={cn("h-full rounded-full", near ? "bg-mid" : "bg-accent")}
                    style={{ width: `${Math.max(pctUsed, 2)}%` }}
                  />
                </div>
              ) : (
                m.hint && <p className="mt-1 text-[11px] text-ink-faint">{m.hint}</p>
              )}
              {pctUsed !== null && m.hint && <p className="mt-1 text-[11px] text-ink-faint">{m.hint}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
