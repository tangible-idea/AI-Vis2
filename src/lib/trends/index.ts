/**
 * Trends service. Two operations, both backed by real Google Trends data:
 *
 *   exploreTrends()  — keyword-driven: average interest, top and rising queries
 *   trendingNow()    — geo-driven only: what's spiking right now
 *
 * When Google is unavailable the caller gets an empty result rather than an
 * estimate; the UI says so. Nothing here invents numbers.
 */

import { fetchExplore, fetchTrendingNow, TrendsUnavailableError } from "./google";
import { googleExploreUrl, googleTrendingUrl, type ExploreParams, type TrendingParams } from "./urls";
import type { ExploreResult, TrendingNowResult } from "./types";

export * from "./types";
export * from "./urls";
export { TrendsUnavailableError, CACHE_TTL } from "./google";

/** Result plus whether Google actually answered — drives the UI's empty state. */
export interface TrendsOutcome<T> {
  data: T;
  available: boolean;
}

/**
 * Circuit breaker for the Explore endpoints. They rate-limit hard, and a
 * blocked request costs two backoff sleeps before it gives up — which the
 * Dashboard, Monitor and Timeline would each pay on every render. After a
 * failure the whole family is skipped for a few minutes and callers get the
 * empty result immediately. Per-instance and in-memory: nothing to operate.
 */
const BREAKER_MS = 5 * 60_000;
let exploreBlockedUntil = 0;

export async function exploreTrends(
  params: ExploreParams
): Promise<TrendsOutcome<ExploreResult>> {
  const empty: ExploreResult = {
    keywords: [],
    top: [],
    rising: [],
    sourceUrl: googleExploreUrl(params),
  };
  if (process.env.GOOGLE_TRENDS_DISABLED) return { data: empty, available: false };
  if (Date.now() < exploreBlockedUntil) return { data: empty, available: false };
  try {
    const data = await fetchExplore(params);
    exploreBlockedUntil = 0;
    return { data, available: true };
  } catch (err) {
    exploreBlockedUntil = Date.now() + BREAKER_MS;
    warn("explore", err);
    return { data: empty, available: false };
  }
}

export async function trendingNow(
  params: TrendingParams
): Promise<TrendsOutcome<TrendingNowResult>> {
  const empty: TrendingNowResult = { items: [], sourceUrl: googleTrendingUrl(params) };
  if (process.env.GOOGLE_TRENDS_DISABLED) return { data: empty, available: false };
  try {
    return { data: await fetchTrendingNow(params), available: true };
  } catch (err) {
    warn("trendingNow", err);
    return { data: empty, available: false };
  }
}

function warn(what: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[trends] ${what} unavailable:`, message);
  if (!(err instanceof TrendsUnavailableError)) console.warn(err);
}
