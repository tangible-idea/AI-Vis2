import { engineInfo } from "../ai/engines";
import type { Project, Snapshot, Recommendation } from "../types";

interface DigestInput {
  project: Project;
  snapshot: Snapshot;
  previous: Snapshot | null;
  recommendations: Recommendation[];
  appUrl: string;
}

/** Weekly digest email — plain, table-based HTML that renders everywhere. */
export function buildWeeklyDigest(d: DigestInput): { subject: string; html: string } {
  const { project, snapshot, previous, recommendations, appUrl } = d;
  const delta = previous ? snapshot.overall_score - previous.overall_score : null;
  const deltaLabel =
    delta === null ? "" : delta >= 0 ? ` (▲ +${delta})` : ` (▼ ${delta})`;

  const engines = Object.entries(snapshot.engine_scores as Record<string, number>)
    .map(
      ([e, s]) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${engineInfo(e).label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace">${s}</td></tr>`
    )
    .join("");

  const recs = recommendations
    .slice(0, 3)
    .map((r) => `<li style="margin-bottom:6px"><strong>${r.title}</strong> — ${r.impact}</li>`)
    .join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1c1b16">
    <h2 style="font-weight:600">Weekly AI visibility — ${project.name}</h2>
    <p style="font-size:32px;margin:16px 0;font-family:monospace"><strong>${snapshot.overall_score}</strong>/100${deltaLabel}</p>
    <table style="border-collapse:collapse;width:100%">${engines}</table>
    ${recs ? `<h3 style="margin-top:24px">Top actions this week</h3><ul>${recs}</ul>` : ""}
    <p style="margin-top:24px"><a href="${appUrl}/dashboard" style="background:#0e7b43;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open dashboard</a></p>
    <p style="color:#8d897e;font-size:12px;margin-top:32px">Sightline · AI Visibility Intelligence</p>
  </div>`;

  return {
    subject: `${project.name}: Visibility Score ${snapshot.overall_score}${deltaLabel}`,
    html,
  };
}
