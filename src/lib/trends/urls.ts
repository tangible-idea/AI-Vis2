import { COUNTRIES, countryLabel } from "../types";

/**
 * Every Google Trends URL the app builds, in one place.
 *
 * Nothing outside this module may concatenate a trends.google.com URL. If
 * Google changes a parameter name, an endpoint path or a date token, this
 * file is the only thing that has to change.
 *
 * Three request families are covered:
 *   • Explore      — keyword-driven: interest over time + top/rising queries
 *   • Trending now — geo-driven only, no keywords (batched RPC)
 *   • Daily RSS    — the same trending feed as a plain per-geo RSS document
 */

const ORIGIN = "https://trends.google.com";
const API = `${ORIGIN}/trends/api`;

// ── geo ──────────────────────────────────────────────────────

/** Google Trends' own code for Worldwide. */
export const WORLDWIDE_GEO = "";

/**
 * The geos offered for Google Trends: Worldwide plus the shared market list,
 * in the same order and with the same labels as "+ Add market". Adding a
 * country to COUNTRIES adds it here, with no second list to keep in step.
 */
export const TRENDS_GEOS: string[] = [WORLDWIDE_GEO, ...COUNTRIES];

export function isValidTrendsGeo(value: string): boolean {
  return TRENDS_GEOS.includes(value);
}

/** Falls back to the project's monitoring market when no geo has been chosen. */
export function resolveTrendsGeo(stored: string | null | undefined, market: string): string {
  return stored === null || stored === undefined ? market : stored;
}

/**
 * Human label for a geo code ("" → Worldwide). Country codes go through the
 * shared market label so the region selector reads exactly like the market
 * tabs — no extra qualifiers.
 */
export function geoLabel(geo: string): string {
  return geo === WORLDWIDE_GEO ? "Worldwide" : countryLabel(geo);
}

// ── timeframes ───────────────────────────────────────────────

/**
 * Explore timeframes, using Google's own wording. `date` is the token Google
 * expects in both the public URL and the API request.
 */
export const EXPLORE_TIMEFRAMES = [
  { id: "week", label: "Past week", date: "now 7-d" },
  { id: "3m", label: "Past 3 months", date: "today 3-m" },
  { id: "12m", label: "Past year", date: "today 12-m" },
] as const;

export type ExploreTimeframe = (typeof EXPLORE_TIMEFRAMES)[number]["id"];

/** Trending now timeframes. Google's RPC takes a window in hours. */
export const TRENDING_TIMEFRAMES = [
  { id: "24h", label: "Past 24 hours", hours: 24 },
  { id: "7d", label: "Past 7 days", hours: 168 },
] as const;

export type TrendingTimeframe = (typeof TRENDING_TIMEFRAMES)[number]["id"];

export function exploreDate(timeframe: ExploreTimeframe): string {
  return (EXPLORE_TIMEFRAMES.find((t) => t.id === timeframe) ?? EXPLORE_TIMEFRAMES[0]).date;
}

export function trendingHours(timeframe: TrendingTimeframe): number {
  return (TRENDING_TIMEFRAMES.find((t) => t.id === timeframe) ?? TRENDING_TIMEFRAMES[0]).hours;
}

export function isExploreTimeframe(v: string): v is ExploreTimeframe {
  return EXPLORE_TIMEFRAMES.some((t) => t.id === v);
}

export function isTrendingTimeframe(v: string): v is TrendingTimeframe {
  return TRENDING_TIMEFRAMES.some((t) => t.id === v);
}

// ── request shapes ───────────────────────────────────────────

export interface ExploreParams {
  keywords: string[];
  geo: string;
  timeframe: ExploreTimeframe;
  /** UI language; drives the language of Google's related queries. */
  language?: string;
}

export interface TrendingParams {
  geo: string;
  timeframe: TrendingTimeframe;
  language?: string;
}

/** Google's `hl` locale code. */
function hl(language?: string): string {
  return !language || language === "en" ? "en-US" : language;
}

// ── public (human) URLs ──────────────────────────────────────

/**
 * The page a user would open to see this exact query on Google Trends —
 * e.g. https://trends.google.com/explore?geo=SG&date=now%207-d&q=saas,ai%20visibility
 * Used for "View on Google Trends" links so the two always agree.
 */
export function googleExploreUrl({ keywords, geo, timeframe }: ExploreParams): string {
  const params = [`date=${encodeURIComponent(exploreDate(timeframe))}`];
  if (geo !== WORLDWIDE_GEO) params.unshift(`geo=${encodeURIComponent(geo)}`);
  const q = keywords.map((k) => encodeURIComponent(k.trim())).filter(Boolean).join(",");
  if (q) params.push(`q=${q}`);
  return `${ORIGIN}/explore?${params.join("&")}`;
}

/** e.g. https://trends.google.com/trending?geo=SG */
export function googleTrendingUrl({ geo }: Pick<TrendingParams, "geo">): string {
  return geo === WORLDWIDE_GEO ? `${ORIGIN}/trending` : `${ORIGIN}/trending?geo=${encodeURIComponent(geo)}`;
}

// ── API URLs ─────────────────────────────────────────────────

/** Step 1 of Explore: exchange keywords + geo + date for widget tokens. */
export function exploreApiUrl({ keywords, geo, timeframe, language }: ExploreParams): string {
  const req = {
    comparisonItem: keywords.map((keyword) => ({
      keyword: keyword.trim(),
      geo: geo === WORLDWIDE_GEO ? "" : geo,
      time: exploreDate(timeframe),
    })),
    category: 0,
    property: "",
  };
  return `${API}/explore?${new URLSearchParams({
    hl: hl(language),
    tz: "0",
    req: JSON.stringify(req),
  })}`;
}

export type WidgetKind = "multiline" | "relatedsearches";

/** Step 2 of Explore: read one widget using the token from step 1. */
export function widgetDataUrl(
  kind: WidgetKind,
  widget: { token: string; request: unknown },
  language?: string
): string {
  return `${API}/widgetdata/${kind}?${new URLSearchParams({
    hl: hl(language),
    tz: "0",
    req: JSON.stringify(widget.request),
    token: widget.token,
  })}`;
}

/**
 * Any Trends page will do to obtain the `NID` cookie the Explore endpoints
 * want; this one is served (and sets the cookie) even while rate-limited, so
 * it doubles as the recovery path out of a 429.
 */
export const TRENDS_COOKIE_URL = `${ORIGIN}/trends/explore`;

/** Trending now is a batched RPC rather than a REST endpoint. */
export const TRENDING_RPC_URL = `${ORIGIN}/_/TrendsUi/data/batchexecute`;

/**
 * Google's Daily Search Trends feed for one country — the same trending
 * terms as the RPC, published as ordinary RSS with the top news story
 * attached to each. It is unauthenticated and not rate-limited, which makes
 * it the fallback when the RPC is blocked.
 *
 * e.g. https://trends.google.com/trending/rss?geo=KR
 */
export function trendingRssUrl(geo: string): string {
  return `${ORIGIN}/trending/rss?geo=${encodeURIComponent(geo)}`;
}

/**
 * Whether Google publishes a Trending now feed for this geo. It is a
 * per-country product: neither upstream covers Worldwide.
 *
 *   • The RPC answers a worldwide request with an empty payload, not an error.
 *   • The RSS feed has no worldwide edition — omitting `geo` makes Google
 *     geolocate the caller's IP, so a server in one country would return that
 *     country's trends labelled as everyone's.
 *
 * Explore is unaffected and does cover Worldwide, so the geo stays selectable;
 * only this one panel has to say it needs a country.
 */
export function supportsTrendingNow(geo: string): boolean {
  return geo !== WORLDWIDE_GEO;
}

/**
 * Form body for the trending-now RPC. The inner payload is a JSON string
 * embedded in the outer envelope — Google's own client does the same.
 */
export function trendingRpcBody({ geo, timeframe, language }: TrendingParams): string {
  const inner = JSON.stringify([
    null,
    null,
    geo === WORLDWIDE_GEO ? "" : geo,
    0,
    hl(language),
    trendingHours(timeframe),
    1,
  ]);
  const envelope = JSON.stringify([[["i0OFE", inner, null, "generic"]]]);
  return new URLSearchParams({ "f.req": envelope }).toString();
}

/**
 * A stable identity for one upstream request, used as the cache/dedupe key.
 * Fresh data is fetched only when one of these inputs actually changes.
 */
export function requestKey(kind: "explore" | "trending", params: ExploreParams | TrendingParams): string {
  if (kind === "trending") {
    const p = params as TrendingParams;
    return `trending|${p.geo}|${p.timeframe}`;
  }
  const p = params as ExploreParams;
  return `explore|${p.geo}|${p.timeframe}|${p.language ?? ""}|${p.keywords.map((k) => k.trim().toLowerCase()).join(",")}`;
}
