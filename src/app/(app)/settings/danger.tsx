"use client";

import { useState, useTransition } from "react";
import { archiveProject, deleteProject, restoreProject } from "./actions";
import { Button } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(t("settings.deleteConfirm", { name }))) {
          start(() => deleteProject(projectId));
        }
      }}
    >
      {pending ? t("settings.deleting") : t("settings.deleteProject")}
    </Button>
  );
}

export function ArchiveProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(t("settings.archiveConfirm", { name }))) {
          start(() => archiveProject(projectId));
        }
      }}
    >
      {pending ? t("settings.archiving") : t("settings.archiveProject")}
    </Button>
  );
}

export interface ArchivedProjectItem {
  id: string;
  name: string;
  country: string;
  archived_at: string | null;
}

/** Archived projects with restore (subject to the plan's active-project limit). */
export function ArchivedProjects({ projects }: { projects: ArchivedProjectItem[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  return (
    <div className="divide-y divide-line">
      {projects.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">
              {p.name} <span className="text-xs text-ink-faint">· {p.country}</span>
            </p>
            <p className="text-[11px] text-ink-faint">
              {t("settings.archivedAgo", { time: timeAgo(p.archived_at) })}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await restoreProject(p.id);
                if (res?.error) setError(res.error);
              });
            }}
          >
            {pending ? t("settings.restoring") : t("settings.restore")}
          </Button>
        </div>
      ))}
      {error && <p className="py-2 text-xs text-poor">{error}</p>}
    </div>
  );
}
