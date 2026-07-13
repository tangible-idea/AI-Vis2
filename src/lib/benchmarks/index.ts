import { unstable_cache } from "next/cache";
import { createAdminClient } from "../supabase/server";

/**
 * Aggregated market benchmark statistics, built from the anonymous
 * prompt_observations layer (migration 0006) — aggregated counts and rates
 * only, never customer-specific data. Real distributions replace the
 * illustrative samples automatically once a segment clears MIN_SAMPLE.
 */

/** Minimum observations before a segment shows real (non-sample) numbers. */
export const MIN_SAMPLE = 50;

export interface EngineBenchmark {
  engine: string;
  mentionRate: number;
  citationRate: number;
  sample: number;
}

export interface BenchmarkStats {
  /** Total engine answers analyzed (recent window). */
  observations: number;
  /** Distinct buyer prompts analyzed. */
  distinctPrompts: number;
  /** Source citations extracted from analyzed answers. */
  sourcesAnalyzed: number;
  industries: string[];
  countries: string[];
  engines: EngineBenchmark[];
  /** True when the corpus is still too small for real distributions. */
  belowSample: boolean;
}

const WINDOW = 5000; // most recent observations — plenty at current scale

async function computeStats(): Promise<BenchmarkStats> {
  const db = createAdminClient();
  const { data: rows } = await db
    .from("prompt_observations")
    .select("prompt_hash, industry, country, engine, brand_mentioned, cited, source_domains")
    .order("scanned_at", { ascending: false })
    .limit(WINDOW);

  const list = rows ?? [];
  const prompts = new Set<string>();
  const industries = new Set<string>();
  const countries = new Set<string>();
  const perEngine = new Map<string, { mentioned: number; cited: number; total: number }>();
  let sources = 0;

  for (const r of list) {
    prompts.add(r.prompt_hash);
    if (r.industry) industries.add(r.industry);
    if (r.country) countries.add(r.country);
    sources += Array.isArray(r.source_domains) ? r.source_domains.length : 0;
    const e = perEngine.get(r.engine) ?? { mentioned: 0, cited: 0, total: 0 };
    e.total++;
    if (r.brand_mentioned) e.mentioned++;
    if (r.cited) e.cited++;
    perEngine.set(r.engine, e);
  }

  return {
    observations: list.length,
    distinctPrompts: prompts.size,
    sourcesAnalyzed: sources,
    industries: [...industries].sort(),
    countries: [...countries].sort(),
    engines: [...perEngine.entries()]
      .map(([engine, e]) => ({
        engine,
        mentionRate: e.mentioned / Math.max(e.total, 1),
        citationRate: e.cited / Math.max(e.total, 1),
        sample: e.total,
      }))
      .sort((a, b) => b.sample - a.sample),
    belowSample: list.length < MIN_SAMPLE,
  };
}

/** Cached hourly — benchmarks are a slow-moving aggregate, not a live query. */
export const getBenchmarkStats = unstable_cache(computeStats, ["benchmark-stats"], {
  revalidate: 3600,
});

/**
 * Illustrative distribution shown while the corpus is below MIN_SAMPLE —
 * clearly labeled as a sample in the UI and replaced automatically by real
 * aggregates as customer coverage grows.
 */
export const SAMPLE_ENGINE_BENCHMARKS: EngineBenchmark[] = [
  { engine: "chatgpt", mentionRate: 0.38, citationRate: 0.14, sample: 0 },
  { engine: "claude", mentionRate: 0.34, citationRate: 0.11, sample: 0 },
  { engine: "gemini", mentionRate: 0.31, citationRate: 0.18, sample: 0 },
  { engine: "perplexity", mentionRate: 0.42, citationRate: 0.55, sample: 0 },
  { engine: "google_ai", mentionRate: 0.29, citationRate: 0.4, sample: 0 },
];
