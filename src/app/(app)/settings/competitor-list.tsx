"use client";

import { useEffect, useState, useTransition } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { removeCompetitor, reorderCompetitors } from "./actions";
import { faviconUrl } from "@/lib/competitors";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Competitor } from "@/lib/types";

/** Favicon with letter-placeholder fallback for sites without a public icon. */
export function CompetitorLogo({ name, website, size = 20 }: { name: string; website: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(website);
  if (!src || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded bg-hover text-[10px] font-semibold text-ink-soft"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded"
      onError={() => setFailed(true)}
    />
  );
}

export function CompetitorList({
  projectId,
  competitors,
}: {
  projectId: string;
  competitors: Competitor[];
}) {
  const [items, setItems] = useState(competitors);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [, start] = useTransition();
  const t = useT();

  useEffect(() => setItems(competitors), [competitors]);

  function moveTo(overIndex: number) {
    if (dragIndex === null || dragIndex === overIndex) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(overIndex);
  }

  function commitOrder() {
    setDragIndex(null);
    start(() =>
      reorderCompetitors(
        projectId,
        items.map((c) => c.id)
      )
    );
  }

  if (!items.length) {
    return <p className="text-sm text-ink-faint">{t("settings.noCompetitors")}</p>;
  }

  return (
    <div className="divide-y divide-line">
      {items.map((c, i) => (
        <div
          key={c.id}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => {
            e.preventDefault();
            moveTo(i);
          }}
          onDragEnd={commitOrder}
          onDrop={(e) => e.preventDefault()}
          className={cn(
            "flex items-center gap-3 py-2.5",
            dragIndex === i && "opacity-50"
          )}
        >
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-faint" />
          <CompetitorLogo name={c.name} website={c.website} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{c.name}</p>
            {c.website && (
              <p className="truncate text-[11px] text-ink-faint">
                {c.website.replace(/^https?:\/\//, "")}
              </p>
            )}
          </div>
          <button
            onClick={() => start(() => removeCompetitor(c.id))}
            className="cursor-pointer rounded p-1 text-ink-faint hover:bg-poor-soft hover:text-poor"
            aria-label={`Remove ${c.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
