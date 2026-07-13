"use client";

import { useState, useTransition } from "react";
import { setAutoScan } from "./actions";
import { useT } from "@/lib/i18n";

export function MonitoringToggle({
  projectId,
  enabled,
}: {
  projectId: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [, start] = useTransition();
  const t = useT();

  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(() => setAutoScan(projectId, next));
        }}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[#0e7b43]"
      />
      <span>
        <span className="block text-sm text-ink">{t("settings.autoScanLabel")}</span>
        <span className="block text-xs text-ink-faint">{t("settings.autoScanBody")}</span>
      </span>
    </label>
  );
}
