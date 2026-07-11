"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Link2,
  Swords,
  FileText,
  Flame,
  Wand2,
  Radar,
  Share2,
  Users,
  Send,
} from "lucide-react";
import { addComment } from "../actions";
import { engineInfo } from "@/lib/ai/engines";
import { timeAgo, cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { TimelineCategory, TimelineEvent } from "@/lib/timeline";

const CATEGORY_META: Record<TimelineCategory, { labelKey: string; icon: typeof TrendingUp }> = {
  visibility: { labelKey: "timeline.catVisibility", icon: TrendingUp },
  citation: { labelKey: "timeline.catCitations", icon: Link2 },
  competitor: { labelKey: "timeline.catCompetitors", icon: Swords },
  content: { labelKey: "timeline.catContent", icon: FileText },
  trends: { labelKey: "timeline.catTrends", icon: Flame },
  recommendation: { labelKey: "timeline.catRecommendations", icon: Wand2 },
  scan: { labelKey: "timeline.catScans", icon: Radar },
  reports: { labelKey: "timeline.catReports", icon: Share2 },
  team: { labelKey: "timeline.catTeam", icon: Users },
};

export function TimelineFeed({
  projectId,
  events,
  canComment,
}: {
  projectId: string;
  events: TimelineEvent[];
  canComment: boolean;
}) {
  const [filter, setFilter] = useState<TimelineCategory | "all">("all");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const t = useT();

  const present = useMemo(
    () => [...new Set(events.map((e) => e.category))],
    [events]
  );
  const visible = filter === "all" ? events : events.filter((e) => e.category === filter);

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const text = note;
    setNote("");
    start(() => addComment(projectId, text));
  }

  return (
    <div>
      {/* category filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("common.all")}
        </FilterChip>
        {present.map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {t(CATEGORY_META[c].labelKey)}
          </FilterChip>
        ))}
      </div>

      {/* team note */}
      {canComment && (
        <form onSubmit={submitNote} className="mb-4 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("timeline.notePlaceholder")}
            className="h-9 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            aria-label={t("timeline.notePlaceholder")}
          />
          <button
            type="submit"
            disabled={pending || !note.trim()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-paper hover:bg-ink/85 disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> {t("timeline.post")}
          </button>
        </form>
      )}

      {/* feed */}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">{t("timeline.emptyFeed")}</p>
      ) : (
        <ol className="relative space-y-0 border-l border-line pl-5">
          {visible.map((ev) => {
            const Icon = CATEGORY_META[ev.category].icon;
            return (
              <li key={ev.id} className="relative py-3">
                <span
                  className={cn(
                    "absolute -left-[27px] top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 border-paper",
                    ev.tone === "good" ? "bg-good" : ev.tone === "bad" ? "bg-poor" : "bg-line-strong"
                  )}
                />
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {ev.title}
                      {ev.platform && (
                        <span
                          className="ml-2 text-[11px] font-semibold"
                          style={{ color: engineInfo(ev.platform).color }}
                        >
                          {engineInfo(ev.platform).label}
                        </span>
                      )}
                    </p>
                    {ev.summary && (
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{ev.summary}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(ev.at)}</span>
                  {ev.action && (
                    <Link
                      href={ev.action.href}
                      className="shrink-0 rounded-lg border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-hover"
                    >
                      {ev.action.label}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-ink text-paper" : "bg-hover text-ink-soft hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
