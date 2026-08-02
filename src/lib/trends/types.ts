import { COUNTRIES } from "../types";

/**
 * Shared trends vocabulary: the source interface, the result shape, and the
 * geo/timeframe options. Lives apart from the implementations so the Google
 * source and the deterministic fallback can both depend on it without a cycle.
 */

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

/** Exactly the supported monitoring markets, plus Worldwide. */
export const TRENDS_GEOS: string[] = [WORLDWIDE_GEO, ...COUNTRIES];

/** Falls back to the monitoring market when no geo has been chosen. */
export function resolveTrendsGeo(stored: string | null | undefined, market: string): string {
  return stored === null || stored === undefined ? market : stored;
}

/** True for values this app will accept as a Google Trends geo. */
export function isValidTrendsGeo(value: string): boolean {
  return TRENDS_GEOS.includes(value);
}

/** Human label for a geo code ("" → Worldwide). */
export function geoLabel(geo: string): string {
  return geo === WORLDWIDE_GEO ? "Worldwide" : geo;
}

/** Content the generator can produce from a trend, in one click. */
export interface ContentSuggestion {
  /** Generator content type id (see lib/content/templates.ts). */
  type: string;
  label: string; // e.g. "Generate Blog"
}

export interface TrendResult {
  keyword: string;
  /**
   * % interest change over the timeframe, or null when the source has no
   * comparable baseline — Google's "trending now" feed reports live search
   * volume but no growth figure, and inventing one would be a lie.
   */
  growth: number | null;
  direction: TrendDirection;
  /** 0–100 relative search interest — the value panels sort "top" by. */
  score: number;
  volume: string; // human label for `score`, e.g. "85/100"
  suggestion: ContentSuggestion;
  contentAngle: string; // one-line content idea
  /**
   * Set when the row is deterministic sample data rather than live Google
   * Trends, so the UI can say so instead of passing it off as real demand.
   */
  sample?: boolean;
}

export interface TrendsQuery {
  industry: string;
  /** Google Trends geo — never the monitoring market unless they happen to match. */
  geo: string;
  language: string;
  timeframe: Timeframe;
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

const ANGLES: Record<string, (kw: string, dir: TrendDirection) => string> = {
  blog_post: (kw, dir) => `Blog post targeting "${kw}" while demand is ${dir}`,
  faq_page: (kw) => `FAQ entry answering "${kw}" directly`,
  category_page: (kw) => `Landing page ranking for "${kw}"`,
  comparison_page: (kw) => `Comparison page capturing "${kw}" searches`,
  social_post: (kw) => `LinkedIn post riding the "${kw}" conversation`,
};

/**
 * Picks the content type to offer for a keyword. Deterministic per
 * keyword+geo so the "Generate …" button doesn't change label between
 * renders — and shared by every source so the UI behaves identically
 * whichever one served the data.
 */
export function suggestionFor(
  keyword: string,
  q: Pick<TrendsQuery, "geo" | "timeframe">,
  direction: TrendDirection = "steady"
): { suggestion: ContentSuggestion; contentAngle: string } {
  const pick = SUGGESTIONS[hash(`${keyword}|${q.geo}`) % SUGGESTIONS.length];
  return { suggestion: pick, contentAngle: ANGLES[pick.type](keyword, direction) };
}

// ── tiny seeded PRNG (mirrors lib/ai/mock.ts) ────────────────
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
