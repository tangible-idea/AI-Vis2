"use client";

import { RefreshCw } from "lucide-react";
import { useScan } from "@/lib/use-scan";
import { engineInfo } from "@/lib/ai/engines";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function ScanButton({ projectId, label }: { projectId: string; label?: string }) {
  const { phase, error, progress, start } = useScan(projectId);
  const t = useT();
  const busy = phase === "starting" || phase === "running";
  const pctDone = progress?.total ? Math.round((progress.done / progress.total) * 100) : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => start()} disabled={busy} variant="primary" size="sm">
        <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        {busy
          ? pctDone !== null
            ? t("scan.scanningPct", { pct: pctDone })
            : t("scan.scanning")
          : (label ?? t("common.runScan"))}
      </Button>
      {busy && progress && (
        <div className="w-44">
          <div className="h-1 overflow-hidden rounded-full bg-hover">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${pctDone ?? 2}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-ink-faint">
            {progress.engine
              ? t("scan.asking", { engine: engineInfo(progress.engine).label })
              : t("scan.querying")}
            {" · "}
            {progress.done}/{progress.total}
            {progress.etaSeconds !== null &&
              progress.etaSeconds > 2 &&
              ` · ${t("scan.timeLeft", { eta: formatEta(progress.etaSeconds) })}`}
          </p>
        </div>
      )}
      {phase === "error" && <p className="max-w-56 text-right text-[11px] text-poor">{error}</p>}
    </div>
  );
}

function formatEta(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}
