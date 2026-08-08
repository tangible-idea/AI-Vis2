/**
 * Trends service. Two operations, both backed by real Google Trends data:
 *
 *   exploreTrends()  — keyword-driven: average interest, top and rising queries
 *   trendingNow()    — geo-driven only: what's spiking right now
 *
 * When Google is unavailable the caller gets an empty result rather than an
 * estimate; the UI says so. Nothing here invents numbers.
 */

import {
  fetchExplore,
  fetchTrendingNow,
  fetchTrendingRss,
  isRateLimited,
  TrendsUnavailableError,
} from "./google";
import {
  googleExploreUrl,
  googleTrendingUrl,
  supportsTrendingNow,
  type ExploreParams,
  type TrendingParams,
} from "./urls";
import type { ExploreResult, TrendingNowResult } from "./types";

export * from "./types";
export * from "./urls";
export * from "./keywords";
export { TrendsUnavailableError, CACHE_TTL } from "./google";

/** Result plus whether Google actually answered — drives the UI's empty state. */
export interface TrendsOutcome<T> {
  data: T;
  available: boolean;
  /**
   * Google publishes nothing for this geo, so there is no outage to report and
   * retrying cannot help. Distinguishes "pick a country" from "try again".
   */
  unsupported?: boolean;
  /**
   * Google throttled us. Routine, self-clearing, and unrelated to what the
   * user asked for — so this is reported as "no data right now", not as a
   * failure the user should act on.
   */
  rateLimited?: boolean;
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
/** Why the breaker tripped, so every skipped call reports what the first one did. */
let exploreBlockedByRateLimit = false;

export async function exploreTrends(
  params: ExploreParams
): Promise<TrendsOutcome<ExploreResult>> {
  const empty: ExploreResult = {
    keywords: [],
    byKeyword: [],
    sourceUrl: googleExploreUrl(params),
  };
  if (process.env.GOOGLE_TRENDS_DISABLED) return { data: empty, available: false };
  if (Date.now() < exploreBlockedUntil) {
    return { data: empty, available: false, rateLimited: exploreBlockedByRateLimit };
  }
  try {
    const data = await fetchExplore(params);
    exploreBlockedUntil = 0;
    return { data, available: true };
  } catch (err) {
    exploreBlockedUntil = Date.now() + BREAKER_MS;
    exploreBlockedByRateLimit = isRateLimited(err);
    warn("explore", err);
    return { data: empty, available: false, rateLimited: exploreBlockedByRateLimit };
  }
}

/**
 * What's trending in one geo right now, from whichever of Google's two
 * trending feeds suits the requested window.
 *
 * The RSS feed is a daily digest: ten ranked terms for one country, each with
 * the news stories that explain why it is trending. That makes it the better
 * answer for the 24-hour view — the news is context the RPC simply doesn't
 * carry — but it cannot answer anything longer.
 *
 * The RPC covers any window and returns hundreds of terms with numeric
 * volumes, so it leads for 7 days. It is also the endpoint most likely to be
 * blocked from a datacentre IP.
 *
 * Whichever leads, the other backs it up, so trending survives either one
 * being unavailable.
 *
 * Worldwide is not a gap in this code: Google publishes no worldwide trending
 * feed at all, so the caller is told the geo is unsupported rather than both
 * upstreams being tried and failing.
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
  if (!supportsTrendingNow(params.geo)) return { data: empty, available: false, unsupported: true };

  const daily = { name: "rss", fetch: fetchTrendingRss };
  const live = { name: "rpc", fetch: fetchTrendingNow };
  const sources = params.timeframe === "24h" ? [daily, live] : [live, daily];

  for (const source of sources) {
    try {
      const data = await source.fetch(params);
      // an empty feed is not an answer — let the other source try
      if (data.items.length) return { data, available: true };
      warn(`trendingNow (${source.name})`, new TrendsUnavailableError("empty feed"));
    } catch (err) {
      warn(`trendingNow (${source.name})`, err);
    }
  }
  return { data: empty, available: false };
}

function warn(what: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[trends] ${what} unavailable:`, message);
  if (!(err instanceof TrendsUnavailableError)) console.warn(err);
}
