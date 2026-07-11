"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeMember } from "./actions";
import { Badge } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ProjectMember } from "@/lib/types";

export function MemberList({ members, canManage }: { members: ProjectMember[]; canManage: boolean }) {
  const [, start] = useTransition();
  const t = useT();

  if (!members.length) {
    return <p className="text-sm text-ink-faint">{t("settings.noMembers")}</p>;
  }

  return (
    <div className="divide-y divide-line">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hover text-[10px] font-semibold uppercase text-ink-soft">
            {m.email.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{m.email}</p>
            <p className="text-[11px] text-ink-faint">
              {m.accepted_at ? t("settings.joined", { time: timeAgo(m.accepted_at) }) : t("settings.invitePending")}
            </p>
          </div>
          <Badge tone={m.role === "member" ? "accent" : "neutral"}>
            {m.role === "member" ? t("common.member") : t("common.viewer")}
          </Badge>
          {canManage && (
            <button
              onClick={() => start(() => removeMember(m.id))}
              className="cursor-pointer rounded p-1 text-ink-faint hover:bg-poor-soft hover:text-poor"
              aria-label={`Remove ${m.email}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
