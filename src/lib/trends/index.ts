import { GoogleTrendsSource } from "./google";
import {
  hash,
  rng,
  suggestionFor,
  type TrendResult,
  type TrendsQuery,
  type TrendsSource,
} from "./types";

/**
 * Trends entry point. Live data comes from Google Trends (see ./google);
 * SampleTrendsSource below is the deterministic fallback used when Google is
 * unreachable or rate-limiting, and when GOOGLE_TRENDS_DISABLED is set.
 * It is clearly-labelled sample data, never presented as real demand.
 */

export * from "./types";
export { GoogleTrendsSource } from "./google";

/**
 * Deterministic stand-in. Seeded per keyword+geo+timeframe so the UI stays
 * stable across renders instead of flickering new numbers on every load.
 */
export class SampleTrendsSource implements TrendsSource {
  name = "sample";

  async trendingSearches(q: TrendsQuery): Promise<TrendResult[]> {
    const ind = q.industry.trim();
    return [
      `best ${ind} for small business`,
      `${ind} pricing comparison`,
      `ai ${ind} tools`,
      `${ind} alternatives`,
      `is ${ind} worth it`,
      `${ind} for startups`,
      `free ${ind} options`,
    ].map((k) => this.result(k, q));
  }

  async trendingTopics(q: TrendsQuery): Promise<TrendResult[]> {
    const ind = q.industry.trim();
    return [
      `AI in ${ind}`,
      `${ind} automation`,
      `${ind} cost trends`,
      `switching ${ind} providers`,
      `${ind} regulations`,
    ].map((k) => this.result(k, q));
  }

  /**
   * Each keyword is measured independently and returned as its own series —
   * the same thing Google Trends Explore does with comma-separated terms.
   */
  async keywordInterest(keywords: string[], q: TrendsQuery): Promise<TrendResult[]> {
    return keywords.filter(Boolean).map((k) => this.result(k.trim(), q));
  }

  async relatedQueries(keyword: string, q: TrendsQuery): Promise<TrendResult[]> {
    const k = keyword.trim();
    return [
      `${k} reviews`,
      `${k} pricing`,
      `${k} vs alternatives`,
      `best ${k}`,
      `${k} for beginners`,
    ].map((r) => this.result(r, q));
  }

  private result(keyword: string, q: TrendsQuery): TrendResult {
    const rand = rng(hash(`${keyword}|${q.timeframe}|${q.geo}`));
    const growth = Math.round(rand() * 260 - 40); // -40% … +220%
    const direction = growth > 15 ? "rising" : growth < -10 ? "declining" : "steady";
    const score = Math.round(5 + rand() * 95);
    const { suggestion, contentAngle } = suggestionFor(keyword, q, direction);
    return {
      keyword,
      growth,
      direction,
      score,
      volume: `${score}/100`,
      suggestion,
      contentAngle,
      sample: true,
    };
  }
}

/**
 * Google Trends, with the sample source behind it. Set GOOGLE_TRENDS_DISABLED
 * to skip the upstream calls entirely (useful offline and in tests).
 */
export function getTrendsSource(): TrendsSource {
  const sample = new SampleTrendsSource();
  if (process.env.GOOGLE_TRENDS_DISABLED) return sample;
  return new GoogleTrendsSource(sample);
}
