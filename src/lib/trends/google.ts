import {
  exploreApiUrl,
  googleExploreUrl,
  googleTrendingUrl,
  trendingRpcBody,
  widgetDataUrl,
  TRENDING_RPC_URL,
  type ExploreParams,
  type TrendingParams,
} from "./urls";
import {
  suggestionFor,
  type ExploreResult,
  type KeywordInterest,
  type QueryResult,
  type TrendingNowResult,
  type TrendingResult,
} from "./types";

/**
 * Google Trends client. Uses the same endpoints trends.google.com's own UI
 * calls — no API key, no vendor, no recurring cost. Every URL comes from
 * ./urls; nothing is assembled here.
 *
 * Two upstream families with very different reliability:
 *   • Explore (`/trends/api/*`) rate-limits hard — 429s appear after a
 *     handful of calls from one IP.
 *   • Trending now (the `batchexecute` RPC) is far more tolerant and keeps
 *     answering while Explore is throttled.
 *
 * Both are cached for an hour keyed by URL, so a given geo/keyword/timeframe
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
      return { title, searchVolume, formattedVolume: formatVolume(searchVolume), suggestion, contentAngle };
    })
    .filter((i) => i.title);

  return { items, sourceUrl };
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
  const res = await request(url, { headers: browserHeaders() });
  const text = await res.text();
  const start = text.indexOf("{");
  if (start < 0) throw new TrendsUnavailableError("unexpected Google Trends payload");
  return JSON.parse(text.slice(start));
}

function browserHeaders(): Record<string, string> {
  return {
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://trends.google.com/trends/explore",
  };
}

/**
 * Shared transport. Identical URLs are deduplicated and cached for an hour by
 * the Next fetch cache, so repeat views and concurrent viewers of the same
 * geo/keyword/timeframe never hit Google twice.
 */
async function request(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: CACHE_TTL },
  });
  if (res.ok) return res;

  // 429 is routine on the Explore endpoints. Two backed-off retries cost at
  // most ~4s on a cold cache; beyond that it's a sustained block and waiting
  // only delays telling the user.
  if (attempt < RETRY_DELAYS_MS.length && (res.status === 429 || res.status >= 500)) {
    await sleep(RETRY_DELAYS_MS[attempt]);
    return request(url, init, attempt + 1);
  }
  throw new TrendsUnavailableError(`Google Trends responded ${res.status}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
