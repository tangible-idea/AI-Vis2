"use client";

import { useTransition } from "react";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { updateRecommendationStatus } from "../actions";
import { Badge } from "@/components/ui";
import { CONTENT_TYPES } from "@/lib/content/templates";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Recommendation, RecommendationStatus } from "@/lib/types";

const NEXT_STATUS: Record<RecommendationStatus, RecommendationStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const STATUS_ICON = {
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
};

export function RecommendationList({
  recommendations,
  onGenerate,
}: {
  recommendations: Recommendation[];
  onGenerate: (rec: Recommendation) => void;
}) {
  const [, startTransition] = useTransition();
  const t = useT();
  const priorityLabel = {
    high: t("common.priorityHigh"),
    medium: t("common.priorityMedium"),
    low: t("common.priorityLow"),
  } as const;

  if (!recommendations.length) {
    return <p className="py-4 text-sm text-ink-faint">{t("generator.noRecommendations")}</p>;
  }

  return (
    <div className="divide-y divide-line">
      {recommendations.map((rec) => {
        const Icon = STATUS_ICON[rec.status];
        const typeLabel = CONTENT_TYPES.find((t) => t.id === rec.type)?.label ?? rec.type;
        return (
          <div key={rec.id} className={cn("py-3.5", rec.status === "done" && "opacity-55")}>
            <div className="flex items-start gap-3">
              <button
                onClick={() =>
                  startTransition(() =>
                    updateRecommendationStatus(rec.id, NEXT_STATUS[rec.status])
                  )
                }
                title={`Mark ${NEXT_STATUS[rec.status].replace("_", " ")}`}
                className={cn(
                  "mt-0.5 shrink-0 cursor-pointer",
                  rec.status === "done" ? "text-good" : "text-ink-faint hover:text-accent"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium text-ink",
                    rec.status === "done" && "line-through"
                  )}
                >
                  {rec.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{rec.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      rec.priority === "high" ? "poor" : rec.priority === "medium" ? "mid" : "neutral"
                    }
                  >
                    {priorityLabel[rec.priority]}
                  </Badge>
                  <span className="text-[11px] text-ink-faint">{rec.impact}</span>
                  <span className="text-[11px] text-ink-faint">·</span>
                  <span className="text-[11px] text-ink-faint">{rec.effort}</span>
                </div>
              </div>
              <button
                onClick={() => onGenerate(rec)}
                className="shrink-0 cursor-pointer rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover"
              >
                {t("generator.generateType", { type: typeLabel })}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
