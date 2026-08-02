import { engineInfo } from "../ai/engines";
import { brandIdentityLabel, type BrandContext } from "../brand";
import { industryLabel } from "../types";
import { formatDate } from "../utils";
import type { Snapshot, Recommendation } from "../types";

/** White-label identity (Pro) stamped on exported reports. */
export interface ReportBranding {
  name: string;
  website: string | null;
  logo_url: string | null;
}

export interface ReportData {
  /** The reported-on brand, from the shared Brand Context. */
  brand: BrandContext;
  snapshot: Snapshot | null;
  previous: Snapshot | null;
  recommendations: Recommendation[];
  branding?: ReportBranding | null;
}

export function buildMarkdownReport(d: ReportData): string {
  const { brand: subject, snapshot, previous, recommendations, branding } = d;
  const lines: string[] = [
    `# AI Visibility Report — ${subject.brand}`,
    ``,
    `Generated ${formatDate(new Date().toISOString())} · ${brandIdentityLabel(subject)} · ${industryLabel(subject.industry)} · ${subject.market}`,
    ``,
  ];
  // white-label identity (Pro); everyone else gets the default Sightline label
  const brand = branding?.name ? branding : { name: "Sightline", website: null };
  lines.push(
    `Prepared by ${brand.name}${brand.website ? ` · ${brand.website}` : ""}`,
    ``
  );

  if (!snapshot) {
    lines.push(`No scans have completed yet.`);
    return lines.join("\n");
  }

  const delta = previous ? snapshot.overall_score - previous.overall_score : null;
  lines.push(
    `## Visibility Score: ${snapshot.overall_score}/100${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta} vs previous scan)` : ""}`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Mention rate | ${Math.round(snapshot.mention_rate * 100)}% |`,
    `| Recommendation rate | ${Math.round(snapshot.recommendation_rate * 100)}% |`,
    `| Average position | ${snapshot.avg_position?.toFixed(1) ?? "—"} |`,
    `| Engine coverage | ${Math.round(snapshot.coverage * 100)}% |`,
    ``,
    `## Score by engine`,
    ``,
    `| Engine | Score |`,
    `| --- | --- |`,
    ...Object.entries(snapshot.engine_scores).map(
      ([e, s]) => `| ${engineInfo(e).label} | ${s} |`
    ),
    ``
  );

  const sov = Object.entries(snapshot.share_of_voice ?? {}).sort((a, b) => b[1] - a[1]);
  if (sov.length) {
    const total = sov.reduce((s, [, n]) => s + n, 0) || 1;
    lines.push(
      `## Share of voice`,
      ``,
      `| Brand | Mentions | Share |`,
      `| --- | --- | --- |`,
      ...sov.map(([name, n]) => `| ${name}${name === subject.brand ? " (you)" : ""} | ${n} | ${Math.round((n / total) * 100)}% |`),
      ``
    );
  }

  if (recommendations.length) {
    lines.push(`## Recommended actions`, ``);
    for (const r of recommendations) {
      lines.push(`### ${r.title} — ${r.priority} priority`, ``, r.description, ``, `*Impact: ${r.impact} · Effort: ${r.effort} · Status: ${r.status}*`, ``);
    }
  }

  return lines.join("\n");
}

export function buildCsvReport(d: ReportData): string {
  const { snapshot, brand: subject } = d;
  const rows: string[][] = [["metric", "value"]];
  rows.push(["project", subject.brand], ["identity", brandIdentityLabel(subject)], ["market", subject.market]);
  if (snapshot) {
    rows.push(
      ["overall_score", String(snapshot.overall_score)],
      ["mention_rate", snapshot.mention_rate.toFixed(3)],
      ["recommendation_rate", snapshot.recommendation_rate.toFixed(3)],
      ["avg_position", snapshot.avg_position?.toFixed(2) ?? ""],
      ["coverage", snapshot.coverage.toFixed(3)],
      ...Object.entries(snapshot.engine_scores).map(([e, s]) => [`score_${e}`, String(s)]),
      ...Object.entries(snapshot.share_of_voice ?? {}).map(([b, n]) => [`sov_${b}`, String(n)])
    );
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
