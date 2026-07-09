"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
} from "recharts";
import { engineInfo } from "@/lib/ai/engines";
import { formatDateShort, scoreTone, cn } from "@/lib/utils";
import type { Engine, Snapshot } from "@/lib/types";

const INK = "#1c1b16";
const INK_FAINT = "#8d897e";
const LINE = "#e9e6df";
const ACCENT = "#0e7b43";

const tooltipStyle = {
  borderRadius: 10,
  border: `1px solid ${LINE}`,
  background: "#fff",
  boxShadow: "0 4px 24px rgb(28 27 22 / 0.08)",
  fontSize: 12,
  color: INK,
};

/** Overall Visibility Score over time. Single series — no legend needed. */
export function ScoreTrend({ snapshots }: { snapshots: Snapshot[] }) {
  const data = snapshots.map((s) => ({
    date: formatDateShort(s.created_at),
    score: s.overall_score,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={LINE} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: INK_FAINT }}
          axisLine={{ stroke: LINE }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: INK_FAINT }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: INK_FAINT, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="score"
          name="Visibility Score"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Per-engine score trend — one line per engine, direct-labeled legend row. */
export function EngineTrend({ snapshots }: { snapshots: Snapshot[] }) {
  const engines = Object.keys(snapshots.at(-1)?.engine_scores ?? {}) as Engine[];
  const data = snapshots.map((s) => ({
    date: formatDateShort(s.created_at),
    ...s.engine_scores,
  }));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1">
        {engines.map((e) => (
          <span key={e} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: engineInfo(e).color }}
            />
            {engineInfo(e).label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: INK_FAINT }}
            axisLine={{ stroke: LINE }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: INK_FAINT }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: INK_FAINT, strokeWidth: 1 }} />
          {engines.map((e) => (
            <Line
              key={e}
              type="monotone"
              dataKey={e}
              name={engineInfo(e).label}
              stroke={engineInfo(e).color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars: score per engine, entity-colored, value labels at data end. */
export function EngineBars({ scores }: { scores: Record<string, number> }) {
  const data = Object.entries(scores).map(([engine, score]) => ({
    engine,
    label: engineInfo(engine).label,
    score,
    fill: engineInfo(engine).color,
  }));
  return (
    <ResponsiveContainer width="100%" height={data.length * 44 + 8}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 8 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={76}
          tick={{ fontSize: 12, fill: INK }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f1ec" }} />
        <Bar dataKey="score" name="Score" barSize={14} radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.engine} fill={d.fill} />
          ))}
          <LabelList
            dataKey="score"
            position="right"
            style={{ fontSize: 11, fill: INK, fontFamily: "var(--font-plex-mono)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Share of voice: single-hue bars, the user's brand in accent, rivals neutral. */
export function SovBars({
  shareOfVoice,
  brand,
}: {
  shareOfVoice: Record<string, number>;
  brand: string;
}) {
  const total = Object.values(shareOfVoice).reduce((a, b) => a + b, 0) || 1;
  const data = Object.entries(shareOfVoice)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      share: Math.round((count / total) * 100),
      isBrand: name === brand,
    }));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className={cn("truncate", d.isBrand ? "font-semibold text-ink" : "text-ink-soft")}>
              {d.name}
              {d.isBrand && <span className="ml-1.5 text-[10px] text-accent-strong">you</span>}
            </span>
            <span className="tabular text-ink-faint">{d.share}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-hover">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${d.share}%`,
                background: d.isBrand ? ACCENT : "#b8b3a6",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Big score number with tone-colored delta — a stat, not a chart. */
export function ScoreHero({
  score,
  delta,
  label = "Visibility Score",
}: {
  score: number;
  delta: number | null;
  label?: string;
}) {
  const tone = scoreTone(score);
  const toneClass = { good: "text-good", mid: "text-mid", poor: "text-poor" }[tone];
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">{label}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className={cn("tabular text-5xl font-medium", toneClass)}>{score}</span>
        <span className="text-sm text-ink-faint">/100</span>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              "tabular text-sm font-medium",
              delta > 0 ? "text-good" : "text-poor"
            )}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-medium text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

/**
 * Prompt × engine heatmap. Sequential single-hue scale (magnitude of
 * visibility per cell): 0 = not mentioned, 1 = mentioned, 2 = recommended.
 */
export function VisibilityHeatmap({
  rows,
}: {
  rows: { prompt: string; cells: { engine: Engine; level: 0 | 1 | 2 | null }[] }[];
}) {
  if (!rows.length) return null;
  const engines = rows[0].cells.map((c) => c.engine);
  const cellStyle = (level: 0 | 1 | 2 | null) => {
    if (level === null) return { background: "#f3f1ec" };
    return {
      background: ["#f0ede6", "#9dd4b4", "#0e7b43"][level],
    };
  };
  const cellTitle = (level: 0 | 1 | 2 | null) =>
    level === null ? "no data" : ["Not mentioned", "Mentioned", "Recommended"][level];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
        <thead>
          <tr>
            <th className="w-1/2" />
            {engines.map((e) => (
              <th key={e} className="pb-1 text-[11px] font-medium text-ink-soft">
                {engineInfo(e).label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.prompt}>
              <td className="max-w-0 truncate pr-3 text-xs text-ink-soft" title={row.prompt}>
                {row.prompt}
              </td>
              {row.cells.map((cell) => (
                <td
                  key={cell.engine}
                  title={`${engineInfo(cell.engine).label}: ${cellTitle(cell.level)}`}
                  className="h-7 min-w-14 rounded"
                  style={cellStyle(cell.level)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#f0ede6" }} /> Not mentioned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#9dd4b4" }} /> Mentioned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#0e7b43" }} /> Recommended
        </span>
      </div>
    </div>
  );
}
