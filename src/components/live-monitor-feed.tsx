"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ENGINES } from "@/lib/ai/engines";

/**
 * Ambient "live monitoring" feed for the landing page — a scrolling ticker of
 * synthetic monitoring events that conveys continuous AI analysis without
 * exposing any real data, numbers, customer info or platform scale. Purely
 * decorative and client-side; nothing here comes from the backend.
 */

// generic buyer-question themes (no customer data) — high level on purpose
const TOPICS = [
  "best CRM for startups",
  "top project management tools",
  "cheapest cloud hosting",
  "best hotels in Singapore",
  "AI writing assistants compared",
  "which analytics platform to pick",
  "leading fintech apps",
  "best EHR for small clinics",
  "top e-commerce platforms",
  "recommended VPN services",
  "best online course platforms",
  "enterprise support software",
];

const STATUSES: { label: string; tone: string }[] = [
  { label: "analyzing", tone: "#35d07f" },
  { label: "citation found", tone: "#5b9dff" },
  { label: "response parsed", tone: "#35d07f" },
  { label: "monitoring", tone: "#c0bcae" },
  { label: "sources mapped", tone: "#5b9dff" },
];

interface Row {
  id: number;
  time: string;
  engine: string;
  color: string;
  topic: string;
  status: { label: string; tone: string };
}

function clockOffset(secondsAgo: number): string {
  const d = new Date(Date.now() - secondsAgo * 1000);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

let counter = 0;
function makeRow(secondsAgo = 0): Row {
  const engine = ENGINES[Math.floor(Math.random() * ENGINES.length)];
  return {
    id: counter++,
    time: clockOffset(secondsAgo),
    engine: engine.label,
    color: engine.color,
    topic: TOPICS[Math.floor(Math.random() * TOPICS.length)],
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
  };
}

export function LiveMonitorFeed({ rows = 7 }: { rows?: number }) {
  // seed a full panel (deterministic order not required — visual only)
  const seed = useMemo(
    () => Array.from({ length: rows }, (_, i) => makeRow((rows - i) * 3)),
    [rows]
  );
  const [feed, setFeed] = useState<Row[]>(seed);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce.current) return;
    const iv = setInterval(() => {
      setFeed((prev) => [makeRow(0), ...prev.slice(0, rows - 1)]);
    }, 2200);
    return () => clearInterval(iv);
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-2xl border border-night-line bg-night-soft">
      <div className="flex items-center justify-between border-b border-night-line px-4 py-2.5">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-paper/50">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[#35d07f]" />
          Live analysis feed
        </span>
        <span className="tabular text-[10px] text-paper/30">real-time</span>
      </div>
      <ul className="divide-y divide-night-line/60">
        {feed.map((r, i) => (
          <li
            key={r.id}
            className="flex items-center gap-3 px-4 py-2 text-xs transition-opacity"
            style={{ opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.1) }}
          >
            <span className="tabular shrink-0 text-[10px] text-paper/30">{r.time}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-paper/70">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
              {r.engine}
            </span>
            <span className="min-w-0 flex-1 truncate text-paper/45">&ldquo;{r.topic}&rdquo;</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: `${r.status.tone}1a`, color: r.status.tone }}
            >
              {r.status.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
