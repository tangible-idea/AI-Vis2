/**
 * Trends result shapes. Every number here is a value Google returned — there
 * are no derived or estimated metrics, so what Sightline shows can always be
 * checked against the matching Google Trends page.
 */

export type { ExploreTimeframe, TrendingTimeframe, ExploreParams, TrendingParams } from "./urls";

/** Content the generator can produce from a trend, in one click. */
export interface ContentSuggestion {
  /** Generator content type id (see lib/content/templates.ts). */
  type: string;
  label: string; // e.g. "Generate Blog"
}

/** A keyword in the Explore comparison — Google's "Average interest". */
export interface KeywordInterest {
  keyword: string;
  /** Mean of Google's interest-over-time series, 0–100. */
  averageInterest: number;
  suggestion: ContentSuggestion;
  contentAngle: string;
}

/** One row of Google's Top or Rising queries list. */
export interface QueryResult {
  query: string;
  /** Top queries: relative popularity 0–100. Null on rising-only rows. */
  popularity: number | null;
  /** Rising queries: percent change. Null on top-only rows. */
  change: number | null;
  /** Google reported "Breakout" (growth too large to express as a percent). */
  breakout: boolean;
  suggestion: ContentSuggestion;
  contentAngle: string;
}

/** One row of Google's Trending now feed. */
export interface TrendingResult {
  title: string;
  /** Approximate searches, as returned by Google. */
  searchVolume: number;
  /** Display form of `searchVolume`, e.g. "20K+". */
  formattedVolume: string;
  suggestion: ContentSuggestion;
  contentAngle: string;
}

/** Everything one Explore request yields — served from a single upstream call. */
export interface ExploreResult {
  keywords: KeywordInterest[];
  top: QueryResult[];
  rising: QueryResult[];
  /** Link to the same query on Google Trends. */
  sourceUrl: string;
}

export interface TrendingNowResult {
  items: TrendingResult[];
  sourceUrl: string;
}

const SUGGESTIONS: ContentSuggestion[] = [
  { type: "blog_post", label: "Generate Blog" },
  { type: "faq_page", label: "Generate FAQ" },
  { type: "category_page", label: "Generate Landing Page" },
  { type: "comparison_page", label: "Generate Comparison Page" },
  { type: "social_post", label: "Generate LinkedIn Post" },
];

const ANGLES: Record<string, (kw: string) => string> = {
  blog_post: (kw) => `Blog post targeting "${kw}"`,
  faq_page: (kw) => `FAQ entry answering "${kw}" directly`,
  category_page: (kw) => `Landing page ranking for "${kw}"`,
  comparison_page: (kw) => `Comparison page capturing "${kw}" searches`,
  social_post: (kw) => `LinkedIn post riding the "${kw}" conversation`,
};

/**
 * Picks which content type to offer for a term. Deterministic per term+geo so
 * the button label doesn't change between renders, and shared by every panel
 * so the same term always offers the same action.
 */
export function suggestionFor(
  term: string,
  geo: string
): { suggestion: ContentSuggestion; contentAngle: string } {
  const pick = SUGGESTIONS[hash(`${term}|${geo}`) % SUGGESTIONS.length];
  return { suggestion: pick, contentAngle: ANGLES[pick.type](term) };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
