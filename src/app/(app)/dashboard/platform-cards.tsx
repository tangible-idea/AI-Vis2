import { Card, Badge } from "@/components/ui";
import { timeAgo, cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

export interface PlatformCardData {
  id: string;
  label: string;
  color: string;
  score: number;
  delta: number | null;
  citations: number;
  mentions: number;
  totalPrompts: number;
  lastScanAt: string | null;
  /** Prompts where the brand showed up on this engine, best first. */
  topPrompts: { text: string; level: "recommended" | "mentioned" }[];
  /** Competitors mentioned by this engine, with counts. */
  rivalMentions: { name: string; count: number }[];
  improvement: string;
}

function EngineLogo({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
      style={{ background: color }}
      aria-hidden
    >
      {label.charAt(0)}
    </span>
  );
}

function statusBadge(delta: number | null, t: TFunction) {
  if (delta === null || delta === 0) return <Badge tone="mid">{t("summary.steady")}</Badge>;
  return delta > 0 ? (
    <Badge tone="good">{t("summary.improved")}</Badge>
  ) : (
    <Badge tone="poor">{t("summary.declined")}</Badge>
  );
}

/**
 * One card per AI platform: score, weekly change, citations, last scan and
 * status at a glance; expand for prompts, competitor pressure and the next
 * improvement.
 */
export async function PlatformCards({ platforms }: { platforms: PlatformCardData[] }) {
  const t = await getT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {platforms.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          <details className="group">
            <summary className="cursor-pointer list-none p-4 transition-colors hover:bg-hover/50">
              <div className="flex items-center gap-3">
                <EngineLogo label={p.label} color={p.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{p.label}</p>
                  <p className="text-[11px] text-ink-faint">
                    {t("platform.lastScan", { time: timeAgo(p.lastScanAt) })}
                  </p>
                </div>
                {statusBadge(p.delta, t)}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-3xl font-medium text-ink">{p.score}</span>
                  {p.delta !== null && p.delta !== 0 && (
                    <span className={cn("tabular text-xs font-medium", p.delta > 0 ? "text-good" : "text-poor")}>
                      {p.delta > 0 ? "▲" : "▼"} {Math.abs(p.delta)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="tabular text-xs text-ink-soft">
                    {t("platform.citations", { count: p.citations })}
                  </p>
                  <p className="tabular text-[11px] text-ink-faint">
                    {t("platform.prompts", { mentions: p.mentions, total: p.totalPrompts })}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-ink-faint transition-transform group-open:hidden">
                {t("platform.clickForDetails")}
              </p>
            </summary>

            <div className="space-y-3 border-t border-line bg-paper/60 p-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                  {t("platform.whereYouAppear")}
                </p>
                {p.topPrompts.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {p.topPrompts.slice(0, 3).map((tp) => (
                      <li key={tp.text} className="flex items-center gap-2 text-xs text-ink-soft">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            tp.level === "recommended" ? "bg-accent" : "bg-[#9dd4b4]"
                          )}
                        />
                        <span className="truncate">{tp.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-xs text-ink-faint">{t("platform.notMentionedYet")}</p>
                )}
              </div>

              {p.rivalMentions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                    {t("platform.competitorsHere")}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {p.rivalMentions
                      .slice(0, 3)
                      .map((r) => `${r.name} (${r.count})`)
                      .join(" · ")}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                  {t("platform.recommendedImprovement")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{p.improvement}</p>
              </div>
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
