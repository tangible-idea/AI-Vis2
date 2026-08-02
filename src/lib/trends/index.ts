/**
 * Trends abstraction. Google Trends has no official API, so the MVP ships a
 * deterministic mock source; swap in a real implementation (SerpAPI, Glimpse,
 * DataForSEO) by implementing TrendsSource and returning it from
 * getTrendsSource(). Every result carries growth, direction and a suggested
 * content type so it plugs straight into the AI Content Generator.
 */

import { COUNTRIES } from "../types";

export type Timeframe = "7d" | "30d" | "90d" | "12m";
export type TrendDirection = "rising" | "steady" | "declining";

export const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: "7d", label: "Past 7 days" },
  { id: "30d", label: "Past 30 days" },
  { id: "90d", label: "Past 90 days" },
  { id: "12m", label: "Past 12 months" },
];

/**
 * Google Trends geo codes. Deliberately independent of the monitoring market:
 * a brand monitored in KR may still want to read demand worldwide or in the US.
 * "" is Google Trends' own code for Worldwide.
 */
export const WORLDWIDE_GEO = "";

export const TRENDS_GEOS: string[] = [WORLDWIDE_GEO, ...COUNTRIES];

/** Falls back to the monitoring market when no geo has been chosen. */
export function resolveTrendsGeo(stored: string | null | undefined, market: string): string {
  return stored === null || stored === undefined ? market : stored;
}

/** True for values this app will accept as a Google Trends geo. */
export function isValidTrendsGeo(value: string): boolean {
  return TRENDS_GEOS.includes(value);
}

/** Content the generator can produce from a trend, in one click. */
export interface ContentSuggestion {
  /** Generator content type id (see lib/content/templates.ts). */
  type: string;
  label: string; // e.g. "Generate Blog"
}

export interface TrendResult {
  keyword: string;
  growth: number; // % interest change over the timeframe
  direction: TrendDirection;
  volume: string; // human label, e.g. "12K searches/mo"
  suggestion: ContentSuggestion;
  contentAngle: string; // one-line content idea
}

export interface TrendsQuery {
  industry: string;
  /** Google Trends geo — never the monitoring market unless they happen to match. */
  geo: string;
  language: string;
  timeframe: Timeframe;
}

/** Human label for a geo code ("" → Worldwide). */
export function geoLabel(geo: string): string {
  return geo === WORLDWIDE_GEO ? "Worldwide" : geo;
}

export interface TrendsSource {
  name: string;
  /** Rising searches around the user's industry / market. */
  trendingSearches(q: TrendsQuery): Promise<TrendResult[]>;
  /** Broader trending topics (themes rather than exact queries). */
  trendingTopics(q: TrendsQuery): Promise<TrendResult[]>;
  /** Interest for specific keywords — pass several to compare. */
  keywordInterest(keywords: string[], q: TrendsQuery): Promise<TrendResult[]>;
  /** Related searches for one keyword. */
  relatedQueries(keyword: string, q: TrendsQuery): Promise<TrendResult[]>;
}

const SUGGESTIONS: ContentSuggestion[] = [
  { type: "blog_post", label: "Generate Blog" },
  { type: "faq_page", label: "Generate FAQ" },
  { type: "category_page", label: "Generate Landing Page" },
  { type: "comparison_page", label: "Generate Comparison Page" },
  { type: "social_post", label: "Generate LinkedIn Post" },
];

class MockTrendsSource implements TrendsSource {
  name = "mock";

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
      `${ind} regulations ${geoLabel(q.geo)}`,
      `${ind} cost trends`,
      `switching ${ind} providers`,
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
      `${k} ${geoLabel(q.geo).toLowerCase()}`,
    ].map((r) => this.result(r, q));
  }

  /** Deterministic per keyword+timeframe+geo, so the UI feels stable. */
  private result(keyword: string, q: TrendsQuery): TrendResult {
    const rand = rng(hash(`${keyword}|${q.timeframe}|${q.geo}`));
    const growth = Math.round(rand() * 260 - 40); // -40% … +220%
    const direction: TrendDirection = growth > 15 ? "rising" : growth < -10 ? "declining" : "steady";
    const volume = `${(0.8 + rand() * 14).toFixed(1)}K/mo`;
    const suggestion = SUGGESTIONS[Math.floor(rand() * SUGGESTIONS.length)];
    const angles: Record<string, string> = {
      blog_post: `Blog post targeting "${keyword}" while demand is ${direction}`,
      faq_page: `FAQ entry answering "${keyword}" directly`,
      category_page: `Landing page ranking for "${keyword}"`,
      comparison_page: `Comparison page capturing "${keyword}" searches`,
      social_post: `LinkedIn post riding the "${keyword}" conversation`,
    };
    return {
      keyword,
      growth,
      direction,
      volume,
      suggestion,
      contentAngle: angles[suggestion.type],
    };
  }
}

export function getTrendsSource(): TrendsSource {
  return new MockTrendsSource();
}

// ── tiny seeded PRNG (mirrors lib/ai/mock.ts) ────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
