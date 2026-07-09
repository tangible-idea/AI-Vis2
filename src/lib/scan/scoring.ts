import type { Engine } from "../types";
import type { AnalyzedResponse } from "./analyzer";

export interface ResultRow extends AnalyzedResponse {
  engine: Engine;
}

export interface ScoreBreakdown {
  overall: number;
  engineScores: Record<string, number>;
  mentionRate: number;
  recommendationRate: number;
  avgPosition: number | null;
  coverage: number;
  shareOfVoice: Record<string, number>;
}

/**
 * Visibility Score (0–100):
 *   40% mention rate + 30% recommendation rate
 * + 20% position quality (rank 1 → 1.0, decaying) + 10% engine coverage.
 */
export function computeScores(
  results: ResultRow[],
  brand: string,
  competitors: string[],
  engines: Engine[]
): ScoreBreakdown {
  const engineScores: Record<string, number> = {};
  for (const engine of engines) {
    const rows = results.filter((r) => r.engine === engine);
    engineScores[engine] = rows.length ? subscore(rows, 1) : 0;
  }

  const mentionRate = rate(results, (r) => r.brand_mentioned);
  const recommendationRate = rate(results, (r) => r.recommended);
  const positions = results
    .filter((r) => r.brand_position != null)
    .map((r) => r.brand_position as number);
  const avgPosition = positions.length
    ? positions.reduce((a, b) => a + b, 0) / positions.length
    : null;
  const coverage = engines.length
    ? engines.filter((e) => results.some((r) => r.engine === e && r.brand_mentioned)).length /
      engines.length
    : 0;

  const overall = subscore(results, coverage);

  // share of voice: mention counts across brand + competitors
  const shareOfVoice: Record<string, number> = {
    [brand]: results.filter((r) => r.brand_mentioned).length,
  };
  for (const c of competitors) {
    shareOfVoice[c] = results.filter((r) => r.competitors_mentioned.includes(c)).length;
  }

  return {
    overall,
    engineScores,
    mentionRate,
    recommendationRate,
    avgPosition,
    coverage,
    shareOfVoice,
  };
}

function subscore(rows: ResultRow[], coverage: number): number {
  if (!rows.length) return 0;
  const mention = rate(rows, (r) => r.brand_mentioned);
  const rec = rate(rows, (r) => r.recommended);
  const positions = rows
    .filter((r) => r.brand_position != null)
    .map((r) => r.brand_position as number);
  const posQuality = positions.length
    ? positions.reduce((sum, p) => sum + 1 / Math.sqrt(p), 0) / positions.length
    : 0;
  return Math.round(100 * (0.4 * mention + 0.3 * rec + 0.2 * posQuality + 0.1 * coverage));
}

function rate<T>(rows: T[], pred: (r: T) => boolean): number {
  return rows.length ? rows.filter(pred).length / rows.length : 0;
}
