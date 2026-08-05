import {
  exploreApiUrl,
  googleExploreUrl,
  googleTrendingUrl,
  trendingRpcBody,
  trendingRssUrl,
  widgetDataUrl,
  TRENDING_RPC_URL,
  TRENDS_COOKIE_URL,
  type ExploreParams,
  type TrendingParams,
} from "./urls";
import {
  suggestionFor,
  type ExploreResult,
  type KeywordInterest,
  type QueryResult,
  type TrendingNews,
  type TrendingNowResult,
  type TrendingResult,
} from "./types";

/**
 * Google Trends client. Uses the same endpoints trends.google.com's own UI
 * calls — no API key, no vendor, no recurring cost. Every URL comes from
 * ./urls; nothing is assembled here.
 *
 * Three upstreams with very different reliability:
 *   • Explore (`/trends/api/*`) refuses cookie-less callers outright — every
 *     request 429s until the client carries an `NID` cookie, which is why
 *     this module keeps one (see `cookieHeader`).
 *   • Trending now (the `batchexecute` RPC) is far more tolerant, honours the
 *     selected timeframe, and covers worldwide.
 *   • The daily RSS feed is plain, unauthenticated XML per country. It only
 *     covers the past day, but it answers when the RPC does not — so it backs
 *     trending up rather than leading it.
 *
 * All are cached for an hour keyed by URL, so a given geo/keyword/timeframe
 * combination costs one upstream call per hour no matter how many people view
 * it. On failure the caller gets an empty result and the UI says Google is
 * unavailable — nothing is estimated or synthesised.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Cache window for upstream responses, in seconds. */
export const CACHE_TTL = 3600;
const REQUEST_TIMEOUT_MS = 8000;
/** Backoff between retries of a rate-limited request. */
const RETRY_DELAYS_MS = [1000, 3000];
/** Google shows "Breakout" instead of a percentage above roughly this. */
const BREAKOUT = 5000;

export class TrendsUnavailableError extends Error {}

interface Widget {
  id: string;
  token: string;
  request: unknown;
}

interface RankedKeyword {
  query?: string;
  value?: number;
  formattedValue?: string;
}

interface ExplorePayload {
  widgets?: Widget[];
  default?: {
    timelineData?: { value: number[] }[];
    rankedList?: { rankedKeyword?: RankedKeyword[] }[];
  };
}

/**
 * One Explore request → interest comparison, top queries and rising queries.
 * They all come out of a single `explore` token exchange, so the three panels
 * the UI shows cost one upstream conversation, not three.
 */
export async function fetchExplore(params: ExploreParams): Promise<ExploreResult> {
  const keywords = params.keywords.map((k) => k.trim()).filter(Boolean);
  const sourceUrl = googleExploreUrl({ ...params, keywords });
  if (!keywords.length) return { keywords: [], top: [], rising: [], sourceUrl };

  const explore = await getJson(exploreApiUrl({ ...params, keywords }));
  const widgets = explore.widgets ?? [];

  const timeseries = widgets.find((w) => w.id === "TIMESERIES");
  const related = widgets.find((w) => w.id.startsWith("RELATED_QUERIES"));

  // the two widget reads are independent — run them together
  const [interest, ranked] = await Promise.all([
    timeseries
      ? getJson(widgetDataUrl("multiline", timeseries, params.language))
      : Promise.resolve<ExplorePayload>({}),
    related
      ? getJson(widgetDataUrl("relatedsearches", related, params.language))
      : Promise.resolve<ExplorePayload>({}),
  ]);

  return {
    keywords: averageInterest(keywords, interest, params.geo),
    ...rankedQueries(ranked, params.geo),
    sourceUrl,
  };
}

/**
 * Google's "Average interest" for each compared keyword: the mean of its
 * interest-over-time series, exactly the figure Google prints beside the
 * chart. Keywords are independent comparison items, so the series line up
 * with the order they were requested in.
 */
function averageInterest(
  keywords: string[],
  payload: ExplorePayload,
  geo: string
): KeywordInterest[] {
  const points = payload.default?.timelineData ?? [];
  return keywords.map((keyword, i) => {
    const series = points.map((p) => p.value[i] ?? 0);
    const { suggestion, contentAngle } = suggestionFor(keyword, geo);
    return {
      keyword,
      averageInterest: series.length
        ? Math.round(series.reduce((a, b) => a + b, 0) / series.length)
        : 0,
      suggestion,
      contentAngle,
    };
  });
}

/**
 * Google returns two ranked lists: "top" (relative popularity 0–100) and
 * "rising" (percent change, or Breakout). They are kept separate — each panel
 * shows the metric Google actually reports for it.
 */
function rankedQueries(
  payload: ExplorePayload,
  geo: string
): { top: QueryResult[]; rising: QueryResult[] } {
  const [topList, risingList] = payload.default?.rankedList ?? [];

  const rows = (items: RankedKeyword[] | undefined, kind: "top" | "rising"): QueryResult[] =>
    (items ?? [])
      .filter((i) => (i.query ?? "").trim())
      .slice(0, 10)
      .map((i) => {
        const query = (i.query as string).trim();
        const breakout = /breakout/i.test(i.formattedValue ?? "");
        const { suggestion, contentAngle } = suggestionFor(query, geo);
        return {
          query,
          popularity: kind === "top" ? (i.value ?? 0) : null,
          change: kind === "rising" ? (breakout ? BREAKOUT : (i.value ?? 0)) : null,
          breakout,
          suggestion,
          contentAngle,
        };
      });

  return { top: rows(topList?.rankedKeyword, "top"), rising: rows(risingList?.rankedKeyword, "rising") };
}

// ── trending now ─────────────────────────────────────────────

/** Index of the fields this module reads out of a trending row. */
const TREND_TITLE = 0;
const TREND_VOLUME = 6;

/**
 * Trending now for one geo and window. Keyword-free by design: Google reports
 * this at country level only.
 */
export async function fetchTrendingNow(params: TrendingParams): Promise<TrendingNowResult> {
  const sourceUrl = googleTrendingUrl(params);
  const res = await request(TRENDING_RPC_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: trendingRpcBody(params),
  });

  const text = await res.text();
  const rows = JSON.parse(text.slice(text.indexOf("["))) as [string, string, string][];
  const envelope = rows.find((r) => r[0] === "wrb.fr" && r[1] === "i0OFE");
  if (!envelope) throw new TrendsUnavailableError("unexpected trending payload");

  const payload = JSON.parse(envelope[2]) as [unknown, unknown[][]];
  const items: TrendingResult[] = (payload[1] ?? [])
    .map((row) => {
      const title = String(row[TREND_TITLE] ?? "").trim();
      const searchVolume = Number(row[TREND_VOLUME] ?? 0);
      const { suggestion, contentAngle } = suggestionFor(title, params.geo);
      return {
        title,
        searchVolume,
        formattedVolume: formatVolume(searchVolume),
        // the RPC returns article ids, not headlines — only RSS carries those
        news: [],
        suggestion,
        contentAngle,
      };
    })
    .filter((i) => i.title);

  return { items, sourceUrl, source: "live" };
}

// ── daily RSS ────────────────────────────────────────────────

/**
 * Trending now for one geo, read from Google's Daily Search Trends RSS feed.
 *
 * Same terms as the RPC, in Google's own order, plus the news stories that
 * explain each one. The feed is always the past day, so the caller must not
 * present it as answering a longer window. Traffic arrives pre-formatted
 * ("2000+"); that string is Google's own label and is shown verbatim.
 */
export async function fetchTrendingRss(params: TrendingParams): Promise<TrendingNowResult> {
  // the feed is read, but "view the source" must land on the readable page
  const sourceUrl = googleTrendingUrl(params);
  const res = await request(trendingRssUrl(params.geo), { headers: { "User-Agent": UA } });
  const xml = await res.text();

  const items = tags(xml, "item").map((item) => {
    const title = xmlText(item, "title");
    const formattedVolume = xmlText(item, "ht:approx_traffic");
    const { suggestion, contentAngle } = suggestionFor(title, params.geo);
    return {
      title,
      searchVolume: parseApproxTraffic(formattedVolume),
      formattedVolume,
      news: newsItems(item),
      suggestion,
      contentAngle,
    };
  });

  return { items: items.filter((i) => i.title), sourceUrl, source: "daily" };
}

function newsItems(item: string): TrendingNews[] {
  return tags(item, "ht:news_item")
    .map((n) => ({
      title: xmlText(n, "ht:news_item_title"),
      url: xmlText(n, "ht:news_item_url"),
      source: xmlText(n, "ht:news_item_source"),
    }))
    .filter((n) => n.title && n.url);
}

/** "2000+" → 2000. Google's own approximation; the "+" carries no value. */
function parseApproxTraffic(formatted: string): number {
  const digits = formatted.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

// ── minimal XML reading ──────────────────────────────────────
//
// The feed is a small, fixed-shape document from one publisher, so matching
// its elements directly is enough — and avoids a dependency for one endpoint.

/** The inner text of every `<name>…</name>` element in `xml`. */
function tags(xml: string, name: string): string[] {
  const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "g");
  return [...xml.matchAll(pattern)].map((m) => m[1]);
}

/** First `<name>` child as decoded text ("" when absent or self-closing). */
function xmlText(xml: string, name: string): string {
  return decodeXml(tags(xml, name)[0] ?? "").trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // named entities last: an escaped "&amp;lt;" must not become "<"
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name]);
}

/** 20000 → "20K+", matching how Google labels these estimates. */
function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${trimZero(n / 1_000_000)}M+`;
  if (n >= 1000) return `${trimZero(n / 1000)}K+`;
  return `${n}+`;
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

// ── transport ────────────────────────────────────────────────

/**
 * Fetches a Trends endpoint. Responses are prefixed with `)]}'` to defeat
 * JSON hijacking, so the payload starts at the first brace.
 */
async function getJson(url: string): Promise<ExplorePayload> {
  // headers are built per attempt so a retry after 429 carries a fresh cookie
  const res = await request(url, async () => ({ headers: await browserHeaders() }));
  const text = await res.text();
  const start = text.indexOf("{");
  if (start < 0) throw new TrendsUnavailableError("unexpected Google Trends payload");
  return JSON.parse(text.slice(start));
}

async function browserHeaders(): Promise<Record<string, string>> {
  const cookie = await cookieHeader();
  return {
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9",
    Referer: TRENDS_COOKIE_URL,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

// ── cookie ───────────────────────────────────────────────────

/**
 * Google issues NID with a months-long expiry, so it is renewed rarely; a 429
 * invalidates it early. Holding it steady also keeps the fetch cache key
 * steady, so rotating the cookie doesn't quietly discard the hourly cache.
 */
const COOKIE_TTL_MS = 6 * 60 * 60_000;
let cookie: { value: string; expiresAt: number } | null = null;
/** Concurrent callers on a cold cache share one bootstrap, not one each. */
let cookieInFlight: Promise<string | null> | null = null;

/**
 * The Explore endpoints reject cookie-less callers with 429 — not because of
 * request volume, but because a real browser always arrives holding an `NID`
 * cookie from trends.google.com. Fetching any Trends page yields one, and
 * with it attached the same requests that returned 429 return 200.
 *
 * The cookie is kept in module memory and reused. It is not per-user and
 * carries no identity of ours — it is the anonymous cookie Google hands to
 * any first-time visitor.
 */
async function cookieHeader(): Promise<string | null> {
  if (cookie && Date.now() < cookie.expiresAt) return cookie.value;
  cookieInFlight ??= fetchCookie().finally(() => {
    cookieInFlight = null;
  });
  return cookieInFlight;
}

async function fetchCookie(): Promise<string | null> {
  try {
    // Google serves this page (and sets the cookie) even while rate-limiting,
    // so a 429 here is still a success — only the cookie is read, not the body.
    const res = await fetch(TRENDS_COOKIE_URL, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // must reach Google to receive a Set-Cookie; a cached response has none
      cache: "no-store",
    });
    const value = readNid(res);
    cookie = value ? { value, expiresAt: Date.now() + COOKIE_TTL_MS } : null;
    return value;
  } catch {
    return null;
  }
}

/** The `NID=…` pair out of the response's Set-Cookie headers. */
function readNid(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const all = headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  for (const header of all) {
    const match = /(^|[;,]\s*)(NID=[^;]+)/.exec(header);
    if (match) return match[2];
  }
  return null;
}

/** Drops the cached cookie so the next Explore request bootstraps a fresh one. */
function invalidateCookie() {
  cookie = null;
}

/**
 * Shared transport. Identical URLs are deduplicated and cached for an hour by
 * the Next fetch cache, so repeat views and concurrent viewers of the same
 * geo/keyword/timeframe never hit Google twice.
 *
 * `init` may be a factory, in which case it is re-evaluated for each attempt —
 * that is how a retry picks up a renewed cookie rather than replaying the
 * headers that were just rejected.
 */
type RequestInitFactory = RequestInit | (() => RequestInit | Promise<RequestInit>);

async function request(url: string, init: RequestInitFactory, attempt = 0): Promise<Response> {
  const resolved = typeof init === "function" ? await init() : init;
  const res = await fetch(url, {
    ...resolved,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: CACHE_TTL },
  });
  if (res.ok) return res;

  // 429 is routine on the Explore endpoints. Two backed-off retries cost at
  // most ~4s on a cold cache; beyond that it's a sustained block and waiting
  // only delays telling the user.
  if (attempt < RETRY_DELAYS_MS.length && (res.status === 429 || res.status >= 500)) {
    // a 429 here usually means the cookie is stale or was never obtained,
    // not that we are genuinely over a quota — drop it and let the retry
    // bootstrap a new one
    if (res.status === 429) invalidateCookie();
    await sleep(RETRY_DELAYS_MS[attempt]);
    return request(url, init, attempt + 1);
  }
  throw new TrendsUnavailableError(`Google Trends responded ${res.status}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
