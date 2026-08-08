/**
 * Keyword rules for Explore, shared by the input that collects them and the
 * API route that acts on them — so what the UI accepts and what the server
 * requests from Google can never diverge.
 */

/**
 * How many keywords one Explore comparison carries. Google's own Explore
 * accepts five; two is Sightline's limit because every extra keyword is
 * another related-queries request per view, and two is what the comparison
 * and the per-keyword result tabs are designed around.
 */
export const MAX_EXPLORE_KEYWORDS = 2;

/** Rows shown per keyword in each of the Top and Rising lists. */
export const EXPLORE_ROWS = 3;

export interface ParsedKeywords {
  /** Trimmed, de-duplicated, and capped at MAX_EXPLORE_KEYWORDS. */
  keywords: string[];
  /** The input named more distinct keywords than a comparison can hold. */
  overflow: boolean;
}

/**
 * "  saas , AI LLM, saas " → ["saas", "AI LLM"].
 *
 * Blanks and repeats are dropped quietly — they are typos, not choices — but
 * naming too many distinct keywords is reported so the caller can say so
 * rather than silently searching for something other than what was typed.
 */
export function parseKeywords(input: string): ParsedKeywords {
  const seen = new Map<string, string>();
  for (const raw of input.split(",")) {
    const keyword = raw.trim();
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (!seen.has(key)) seen.set(key, keyword);
  }
  const all = [...seen.values()];
  return {
    keywords: all.slice(0, MAX_EXPLORE_KEYWORDS),
    overflow: all.length > MAX_EXPLORE_KEYWORDS,
  };
}
