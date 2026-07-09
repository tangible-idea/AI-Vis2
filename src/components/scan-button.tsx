"use client";

import { RefreshCw } from "lucide-react";
import { useScan } from "@/lib/use-scan";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ScanButton({ projectId, label = "Run scan" }: { projectId: string; label?: string }) {
  const { phase, error, start } = useScan(projectId);
  const busy = phase === "starting" || phase === "running";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => start()} disabled={busy} variant="primary" size="sm">
        <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        {busy ? "Scanning…" : label}
      </Button>
      {phase === "error" && <p className="max-w-56 text-right text-[11px] text-poor">{error}</p>}
    </div>
  );
}
