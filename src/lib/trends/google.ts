import {
  suggestionFor,
  WORLDWIDE_GEO,
  type Timeframe,
  type TrendResult,
  type TrendsQuery,
  type TrendsSource,
} from "./types";

/**
 * Google Trends source, built on the same endpoints trends.google.com's own
 * UI calls. There is no official API and no key — so there is no recurring
 * cost — but the endpoints are unofficial and rate-limit hard (429s appear
 * after a handful of calls from one IP). Three things keep that survivable:
 *
 *   1. every response is cached for an hour, keyed by URL, so repeat views
 *      and multiple users on the same geo/keyword cost nothing;
 *   2. one 429/5xx gets a single short retry;
 *   3. anything still failing falls back to the deterministic source, so the
 *      page degrades instead of breaking.
 *
 * Widget requests reuse one `explore` call: the trending-searches and
 * trending-topics panels read different widgets out of the same cached
 * response, so a Trends page load is one upstream round trip, not two.
 */

const BASE = "https://trends.google.com/trends/api";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Google Trends' own time tokens, one per timeframe the UI offers. */
const TIME_RANGE: Record<Timeframe, string> = {
  "7d": "now 7-d",
  "30d": "today 1-m",
  "90d": "today 3-m",
  "12m": "today 12-m",
};

/** Cache window for upstream responses, in seconds. */
const CACHE_TTL = 3600;
const REQUEST_TIMEOUT_MS = 8000;
/** Backoff between retries of a rate-limited request. */
const RETRY_DELAYS_MS = [1000, 3000];
/** Google reports anything above ~5000% growth as "Breakout"; cap the display. */
const BREAKOUT = 5000;

interface WidgetRequest {
  [key: string]: unknown;
}

/** The slice of each endpoint's payload this module reads. */
interface TrendsPayload {
  widgets?: Widget[];
  default?: {
    timelineData?: { value: number[] }[];
    rankedList?: { rankedKeyword?: RankedKeyword[] }[];
  };
}

interface Widget {
  id: string;
  token: string;
  request: WidgetRequest;
}

interface RankedKeyword {
  query?: string;
  topic?: { title: string };
  value?: number;
  formattedValue?: string;
}

/** One keyword's place in Google's "top" and "rising" ranked lists. */
interface Ranked {
  label: string;
  /** 0–100 relative interest, from the "top" list; 0 when only rising. */
  score: number;
  /** Percent growth, from the "rising" list; 0 when only top. */
  growth: number;
}

export class GoogleTrendsSource implements TrendsSource {
  name = "google";

  constructor(private readonly fallback: TrendsSource) {}

  async trendingSearches(q: TrendsQuery): Promise<TrendResult[]> {
    return this.ranked(q, q.industry, "RELATED_QUERIES", () => this.fallback.trendingSearches(q));
  }

  /**
   * "Trending now" for the selected geo, from Google's public trending RSS
   * feed. This is what Google itself shows as currently-spiking searches, it
   * is genuinely per-country, and the feed tolerates far more traffic than
   * the widget endpoints. Worldwide has no such feed (an empty geo resolves
   * to the caller's own country), so it falls back to related topics.
   */
  async trendingTopics(q: TrendsQuery): Promise<TrendResult[]> {
    if (q.geo === WORLDWIDE_GEO) {
      return this.ranked(q, q.industry, "RELATED_TOPICS", () => this.fallback.trendingTopics(q));
    }
    try {
      const items = await trendingNow(q.geo);
      if (!items.length) throw new Error("empty trending feed");
      const peak = Math.max(...items.map((i) => i.traffic), 1);
      return items.map((item) => {
        const score = Math.round((item.traffic / peak) * 100);
        const { suggestion, contentAngle } = suggestionFor(item.keyword, q, "rising");
        return {
          keyword: item.keyword,
          growth: null, // the feed reports volume, not change
          direction: "rising" as const,
          score,
          volume: `${item.formattedTraffic} searches`,
          suggestion,
          contentAngle,
        };
      });
    } catch (err) {
      warn("trendingNow", err);
      return this.ranked(q, q.industry, "RELATED_TOPICS", () => this.fallback.trendingTopics(q));
    }
  }

  async relatedQueries(keyword: string, q: TrendsQuery): Promise<TrendResult[]> {
    return this.ranked(q, keyword, "RELATED_QUERIES", () =>
      this.fallback.relatedQueries(keyword, q)
    );
  }

  /**
   * Interest for several keywords. Each keyword is its own comparison item —
   * the same request Google Trends Explore builds for "a, b, c" — so the
   * series stay independent and directly comparable.
   */
  async keywordInterest(keywords: string[], q: TrendsQuery): Promise<TrendResult[]> {
    const terms = keywords.map((k) => k.trim()).filter(Boolean);
    if (!terms.length) return [];
    try {
      const widgets = await this.explore(terms, q);
      const timeseries = widgets.find((w) => w.id === "TIMESERIES");
      if (!timeseries) throw new Error("no TIMESERIES widget");

      const raw = await this.widgetData(timeseries, "multiline");
      const points = raw?.default?.timelineData ?? [];
      if (!points.length) throw new Error("empty timeline");

      return terms.map((term, i) => {
        const series = points.map((p) => p.value[i] ?? 0);
        return toResult(term, avg(series), growthOf(series), q);
      });
    } catch (err) {
      warn("keywordInterest", err);
      return this.fallback.keywordInterest(terms, q);
    }
  }

  // ── shared ranked-list path ────────────────────────────────

  private async ranked(
    q: TrendsQuery,
    term: string,
    widgetId: "RELATED_QUERIES" | "RELATED_TOPICS",
    fallback: () => Promise<TrendResult[]>
  ): Promise<TrendResult[]> {
    try {
      const widgets = await this.explore([term], q);
      const widget = widgets.find((w) => w.id.startsWith(widgetId));
      if (!widget) throw new Error(`no ${widgetId} widget`);

      const raw = await this.widgetData(widget, "relatedsearches");
      const lists = raw?.default?.rankedList ?? [];
      const merged = mergeRanked(lists);
      if (!merged.length) throw new Error("empty ranked list");

      return merged.map((r) => toResult(r.label, r.score, r.growth, q));
    } catch (err) {
      warn(widgetId, err);
      return fallback();
    }
  }

  /** Step 1: exchange keywords + geo for per-widget tokens. */
  private async explore(keywords: string[], q: TrendsQuery): Promise<Widget[]> {
    const req = {
      comparisonItem: keywords.map((keyword) => ({
        keyword,
        geo: q.geo === WORLDWIDE_GEO ? "" : q.geo,
        time: TIME_RANGE[q.timeframe],
      })),
      category: 0,
      property: "",
    };
    const url = `${BASE}/explore?${new URLSearchParams({
      hl: hl(q.language),
      tz: "0",
      req: JSON.stringify(req),
    })}`;
    const data = await getJson(url);
    return data?.widgets ?? [];
  }

  /** Step 2: read one widget's data with the token from step 1. */
  private async widgetData(widget: Widget, kind: "multiline" | "relatedsearches") {
    const url = `${BASE}/widgetdata/${kind}?${new URLSearchParams({
      hl: "en-US",
      tz: "0",
      req: JSON.stringify(widget.request),
      token: widget.token,
    })}`;
    return getJson(url);
  }
}

// ── transport ────────────────────────────────────────────────

/**
 * Fetches one Trends endpoint. Responses are prefixed with `)]}'` to defeat
 * JSON hijacking, so the payload starts at the first brace.
 */
async function getJson(url: string, attempt = 0): Promise<TrendsPayload> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://trends.google.com/trends/explore",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: CACHE_TTL },
  });

  if (!res.ok) {
    // 429 is routine here. Two backed-off retries cost at most ~4s on a cold
    // cache and clear the great majority of them; anything beyond that is a
    // sustained block, where waiting longer just delays the fallback.
    if (attempt < RETRY_DELAYS_MS.length && (res.status === 429 || res.status >= 500)) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      return getJson(url, attempt + 1);
    }
    throw new Error(`Google Trends responded ${res.status}`);
  }

  const text = await res.text();
  const start = text.indexOf("{");
  if (start < 0) throw new Error("unexpected Google Trends payload");
  return JSON.parse(text.slice(start));
}

interface TrendingItem {
  keyword: string;
  /** Parsed lower bound of Google's "20K+" style estimate. */
  traffic: number;
  formattedTraffic: string;
}

/**
 * Google's trending-searches RSS feed for one country. Plain XML, no token
 * exchange, and far more tolerant of repeat calls than the widget endpoints —
 * so it stays available even while `explore` is rate-limiting.
 */
async function trendingNow(geo: string): Promise<TrendingItem[]> {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: CACHE_TTL },
  });
  if (!res.ok) throw new Error(`trending feed responded ${res.status}`);
  const xml = await res.text();

  const items: TrendingItem[] = [];
  for (const block of xml.split("<item>").slice(1)) {
    const keyword = decodeXml(between(block, "title"));
    if (!keyword) continue;
    const formattedTraffic = between(block, "ht:approx_traffic") || "";
    items.push({ keyword, traffic: parseTraffic(formattedTraffic), formattedTraffic });
  }
  return items.slice(0, 10);
}

function between(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? m[1].trim() : "";
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** "20K+" → 20000, "500+" → 500. */
function parseTraffic(formatted: string): number {
  const m = /([\d.]+)\s*([KMB])?/i.exec(formatted);
  if (!m) return 0;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(parseFloat(m[1]) * scale);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function warn(what: string, err: unknown) {
  console.warn(`[trends] ${what} fell back to sample data:`, err instanceof Error ? err.message : err);
}

// ── shaping ──────────────────────────────────────────────────

/**
 * Google returns two ranked lists: "top" (0–100 relative interest) and
 * "rising" (percent growth). A keyword can appear in either or both; merging
 * them gives one row per keyword carrying whichever signals exist.
 */
function mergeRanked(lists: { rankedKeyword?: RankedKeyword[] }[]): Ranked[] {
  const byLabel = new Map<string, Ranked>();

  const upsert = (label: string, patch: Partial<Ranked>) => {
    const key = label.toLowerCase();
    const current = byLabel.get(key) ?? { label, score: 0, growth: 0 };
    byLabel.set(key, { ...current, ...patch, label: current.label });
  };

  const [top, rising] = lists;
  for (const item of top?.rankedKeyword ?? []) {
    const label = labelOf(item);
    if (label) upsert(label, { score: item.value ?? 0 });
  }
  for (const item of rising?.rankedKeyword ?? []) {
    const label = labelOf(item);
    if (!label) continue;
    const breakout = /breakout/i.test(item.formattedValue ?? "");
    upsert(label, { growth: breakout ? BREAKOUT : Math.min(item.value ?? 0, BREAKOUT) });
  }

  return [...byLabel.values()].slice(0, 12);
}

function labelOf(item: RankedKeyword): string | null {
  return (item.query ?? item.topic?.title ?? "").trim() || null;
}

/**
 * Growth across a timeline: the last third of the window against the first
 * third. Comparing endpoints alone would swing on a single noisy day.
 */
function growthOf(series: number[]): number {
  if (series.length < 3) return 0;
  const window = Math.max(1, Math.floor(series.length / 3));
  const start = avg(series.slice(0, window));
  const end = avg(series.slice(-window));
  if (start === 0) return end > 0 ? BREAKOUT : 0;
  return Math.round((end / start - 1) * 100);
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function toResult(keyword: string, score: number, growth: number, q: TrendsQuery): TrendResult {
  const rounded = Math.round(score);
  const suggestion = suggestionFor(keyword, q);
  return {
    keyword,
    growth,
    direction: growth > 15 ? "rising" : growth < -10 ? "declining" : "steady",
    score: rounded,
    volume: rounded > 0 ? `${rounded}/100` : "—",
    suggestion: suggestion.suggestion,
    contentAngle: suggestion.contentAngle,
  };
}

/** Google's `hl` locale — drives the language of related queries. */
function hl(language: string): string {
  return language === "en" ? "en-US" : language || "en-US";
}
