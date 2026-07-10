import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Trophy } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { QuickShare } from "@/components/quick-share";
import { ScanButton } from "@/components/scan-button";
import { timeAgo, cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

export interface EngineSummary {
  id: string;
  label: string;
  color: string;
  score: number;
  delta: number | null; // vs previous scan
  citations: number;
}

export interface ActivityItem {
  label: string;
  at: string; // ISO
}

const statusOf = (delta: number | null) =>
  delta === null || delta === 0 ? "steady" : delta > 0 ? "improved" : "declined";

const STATUS_DOT = { improved: "bg-good", steady: "bg-mid", declined: "bg-poor" } as const;
const STATUS_LABEL = { improved: "Improved", steady: "No change", declined: "Declined" } as const;

/**
 * Executive briefing card: where you stand, what changed, what to do next —
 * readable in under ten seconds.
 */
export function LastScanSummary({
  projectId,
  brand,
  score,
  delta,
  engines,
  topAction,
  activity,
  lastScanAt,
  nextScanAt,
  shareUrl,
}: {
  projectId: string;
  brand: string;
  score: number;
  delta: number | null;
  engines: EngineSummary[];
  topAction: Recommendation | null;
  activity: ActivityItem[];
  lastScanAt: string | null;
  nextScanAt: Date | null;
  shareUrl: string | null;
}) {
  const best = engines.reduce<EngineSummary | null>(
    (a, e) => (e.delta !== null && e.delta > 0 && (!a || e.delta > (a.delta ?? 0)) ? e : a),
    null
  );
  const daysToNext = nextScanAt
    ? Math.max(0, Math.ceil((nextScanAt.getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <Card className="p-5">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
        {/* where you stand */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Last scan summary
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="tabular text-2xl font-medium text-ink">{score}</span>
            <span className="text-xs text-ink-faint">/100</span>
            {delta !== null && delta !== 0 && (
              <span className={cn("tabular text-xs font-medium", delta > 0 ? "text-good" : "text-poor")}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} since last scan
              </span>
            )}
          </div>

          {/* platform status chips with hover detail */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {engines.map((e) => {
              const status = statusOf(e.delta);
              return (
                <span key={e.id} className="group relative">
                  <span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
                    {e.label}
                  </span>
                  <span className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-44 rounded-lg border border-line bg-surface p-3 shadow-pop group-hover:block">
                    <span className="block text-xs font-semibold" style={{ color: e.color }}>
                      {e.label} — {STATUS_LABEL[status]}
                    </span>
                    <span className="mt-1.5 block space-y-0.5 text-[11px] text-ink-soft">
                      <span className="flex justify-between">
                        <span>Visibility score</span>
                        <span className="tabular">{e.score}</span>
                      </span>
                      <span className="flex justify-between">
                        <span>Weekly change</span>
                        <span className={cn("tabular", (e.delta ?? 0) > 0 ? "text-good" : (e.delta ?? 0) < 0 ? "text-poor" : "")}>
                          {e.delta === null ? "—" : `${e.delta > 0 ? "+" : ""}${e.delta}`}
                        </span>
                      </span>
                      <span className="flex justify-between">
                        <span>Citations</span>
                        <span className="tabular">{e.citations}</span>
                      </span>
                      <span className="flex justify-between">
                        <span>Last scan</span>
                        <span>{timeAgo(lastScanAt)}</span>
                      </span>
                    </span>
                  </span>
                </span>
              );
            })}
          </div>

          {best && best.delta !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-good-soft px-3 py-2">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-good" />
              <p className="text-xs text-ink">
                <span className="font-semibold">Biggest improvement:</span> {best.label}{" "}
                <span className="tabular text-good">+{best.delta} points</span>
              </p>
            </div>
          )}
        </div>

        {/* what to do next */}
        <div className="border-line lg:border-l lg:pl-6">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Top recommended action
          </p>
          {topAction ? (
            <div className="mt-2">
              <p className="text-sm font-medium leading-snug text-ink">{topAction.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={topAction.priority === "high" ? "poor" : "mid"}>
                  {topAction.priority} priority
                </Badge>
                <span className="text-[11px] text-ink-faint">{topAction.impact}</span>
                <span className="text-[11px] text-ink-faint">· {topAction.effort}</span>
              </div>
              <Link
                href="/optimize"
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-paper hover:bg-ink/85"
              >
                Generate <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">
              Nothing open — your next scan will refresh recommendations.
            </p>
          )}
        </div>

        {/* rhythm: activity, next scan, share */}
        <div className="border-line lg:border-l lg:pl-6">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Recent activity
          </p>
          <ul className="mt-2 space-y-1.5">
            {activity.slice(0, 4).map((a) => (
              <li key={`${a.label}-${a.at}`} className="flex items-center gap-2 text-xs text-ink-soft">
                <CheckCircle2 className="h-3 w-3 shrink-0 text-good" />
                <span className="flex-1 truncate">{a.label}</span>
                <span className="shrink-0 text-[10px] text-ink-faint">{timeAgo(a.at)}</span>
              </li>
            ))}
            {!activity.length && <li className="text-xs text-ink-faint">No activity yet.</li>}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-faint">Next scan</p>
              <p className="text-xs font-medium text-ink">
                {daysToNext === null ? "Not scheduled" : daysToNext === 0 ? "Due now" : `In ${daysToNext} day${daysToNext > 1 ? "s" : ""}`}
              </p>
            </div>
            <ScanButton projectId={projectId} label="Run scan now" />
          </div>

          <div className="mt-3">
            <QuickShare shareUrl={shareUrl} brand={brand} score={score} delta={delta} />
          </div>
        </div>
      </div>
    </Card>
  );
}
