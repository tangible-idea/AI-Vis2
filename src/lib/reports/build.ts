import { engineInfo } from "../ai/engines";
import { formatDate } from "../utils";
import type { Project, Snapshot, Recommendation } from "../types";

/** White-label identity (Pro) stamped on exported reports. */
export interface ReportBranding {
  name: string;
  website: string | null;
  logo_url: string | null;
}

export interface ReportData {
  project: Project;
  snapshot: Snapshot | null;
  previous: Snapshot | null;
  recommendations: Recommendation[];
  competitors: string[];
  branding?: ReportBranding | null;
}

export function buildMarkdownReport(d: ReportData): string {
  const { project, snapshot, previous, recommendations, branding } = d;
  const lines: string[] = [
    `# AI Visibility Report — ${project.name}`,
    ``,
    `Generated ${formatDate(new Date().toISOString())} · ${project.website} · ${project.industry}`,
    ``,
  ];
  if (branding?.name) {
    lines.push(
      `Prepared by ${branding.name}${branding.website ? ` · ${branding.website}` : ""}`,
      ``
    );
  }

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
      ...sov.map(([name, n]) => `| ${name}${name === project.name ? " (you)" : ""} | ${n} | ${Math.round((n / total) * 100)}% |`),
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
  const { snapshot, project } = d;
  const rows: string[][] = [["metric", "value"]];
  rows.push(["project", project.name]);
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
