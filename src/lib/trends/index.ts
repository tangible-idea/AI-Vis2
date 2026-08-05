/**
 * Trends service. Two operations, both backed by real Google Trends data:
 *
 *   exploreTrends()  — keyword-driven: average interest, top and rising queries
 *   trendingNow()    — geo-driven only: what's spiking right now
 *
 * When Google is unavailable the caller gets an empty result rather than an
 * estimate; the UI says so. Nothing here invents numbers.
 */

import { fetchExplore, fetchTrendingNow, fetchTrendingRss, TrendsUnavailableError } from "./google";
import {
  googleExploreUrl,
  googleTrendingUrl,
  supportsTrendingRss,
  type ExploreParams,
  type TrendingParams,
} from "./urls";
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

/**
 * What's trending in one geo right now.
 *
 * The RPC leads because it honours the selected timeframe, covers worldwide
 * and reports numeric volumes. When it fails — it is the endpoint most likely
 * to be blocked from a datacentre IP — the per-geo RSS feed answers instead,
 * with the same terms plus the news stories behind them. Only worldwide has
 * no fallback, since the feed is published per country.
 *
 * The result records which one answered so the UI can be honest about the
 * window it actually covers.
 */
export async function trendingNow(
  params: TrendingParams
): Promise<TrendsOutcome<TrendingNowResult>> {
  const empty: TrendingNowResult = {
    items: [],
    sourceUrl: googleTrendingUrl(params),
    source: "live",
  };
  if (process.env.GOOGLE_TRENDS_DISABLED) return { data: empty, available: false };

  try {
    return { data: await fetchTrendingNow(params), available: true };
  } catch (err) {
    warn("trendingNow", err);
  }

  if (!supportsTrendingRss(params.geo)) return { data: empty, available: false };
  try {
    return { data: await fetchTrendingRss(params), available: true };
  } catch (err) {
    warn("trendingNow (rss)", err);
    return { data: empty, available: false };
  }
}

function warn(what: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[trends] ${what} unavailable:`, message);
  if (!(err instanceof TrendsUnavailableError)) console.warn(err);
}
