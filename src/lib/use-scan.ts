"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ScanPhase = "idle" | "starting" | "running" | "done" | "error";

export interface ScanProgress {
  done: number;
  total: number;
  /** Engine id currently being queried. */
  engine: string | null;
  /** Rough seconds remaining, from observed pace. */
  etaSeconds: number | null;
}

/** Triggers a scan and polls /api/scan until it finishes, then refreshes. */
export function useScan(projectId: string | null) {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stopPolling, []);

  const poll = useCallback(
    (scanId: string) => {
      timer.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan?id=${scanId}`);
          const data = await res.json();
          if (data.progress?.total) {
            const done = data.progress.done ?? 0;
            const elapsed = data.started_at
              ? (Date.now() - new Date(data.started_at).getTime()) / 1000
              : 0;
            const etaSeconds =
              done > 0 && elapsed > 0
                ? Math.max(0, Math.round((elapsed / done) * (data.progress.total - done)))
                : null;
            setProgress({
              done,
              total: data.progress.total,
              engine: data.progress.engine ?? null,
              etaSeconds,
            });
          }
          if (data.status === "done") {
            stopPolling();
            setPhase("done");
            setProgress(null);
            router.refresh();
          } else if (data.status === "failed") {
            stopPolling();
            setPhase("error");
            setProgress(null);
            setError(data.error ?? "Scan failed");
          }
        } catch {
          // transient network error — keep polling
        }
      }, 2500);
    },
    [router]
  );

  const start = useCallback(
    async (trigger: "manual" | "onboarding" = "manual") => {
      if (!projectId || phase === "starting" || phase === "running") return;
      setPhase("starting");
      setError(null);
      setProgress(null);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, trigger }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPhase("error");
          setError(data.error ?? "Could not start scan");
          return;
        }
        setPhase("running");
        poll(data.scanId);
      } catch {
        setPhase("error");
        setError("Network error");
      }
    },
    [projectId, phase, poll]
  );

  return { phase, error, progress, start };
}
