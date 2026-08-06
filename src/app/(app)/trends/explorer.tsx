"use client";

import { Suspense, use, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, Search, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Input, Label, Select } from "@/components/ui";
import {
  EXPLORE_TIMEFRAMES,
  TRENDING_TIMEFRAMES,
  TRENDS_GEOS,
  geoLabel,
  supportsTrendingNow,
  type ExploreResult,
  type ExploreTimeframe,
  type QueryResult,
  type TrendingNowResult,
  type TrendingTimeframe,
  type TrendsOutcome,
} from "@/lib/trends";
import { useT } from "@/lib/i18n";

/**
 * A section's data plus how it arrived. The server streams the first one in as
 * a promise; every later one comes from /api/trends as the user changes geo,
 * keywords or timeframe, and simply replaces it.
 */
type ExploreState = TrendsOutcome<ExploreResult>;
type TrendingState = TrendsOutcome<TrendingNowResult>;

/** Trending now is a summary — only the first few rows are listed. */
const TRENDING_PREVIEW = 5;

/**
 * Stand-in rows shaped like the real ones. Sized to the content it replaces so
 * nothing jumps when the section streams in.
 */
function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse divide-y divide-line" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-2/5 rounded bg-hover" />
            <div className="h-2.5 w-3/5 rounded bg-hover" />
          </div>
          <div className="h-3 w-8 shrink-0 rounded bg-hover" />
          <div className="h-6 w-24 shrink-0 rounded-lg bg-hover" />
        </div>
      ))}
    </div>
  );
}

/** One-click content generation for a term — the existing generator route. */
function GenerateLink({ type, topic, label }: { type: string; topic: string; label: string }) {
  return (
    <Link
      href={`/optimize?type=${type}&topic=${encodeURIComponent(topic)}`}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover"
    >
      <Wand2 className="h-3 w-3" />
      {label}
    </Link>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-ink-faint hover:text-accent-strong"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * A Top or Rising query row. Each list shows the metric Google actually
 * reports for it — relative popularity for Top, change for Rising — so the
 * numbers can be checked against the matching Google Trends panel.
 */
function QueryRows({
  rows,
  emptyLabel,
  onDrillDown,
  relatedLabel,
}: {
  rows: QueryResult[];
  emptyLabel: string;
  onDrillDown: (query: string) => void;
  relatedLabel: string;
}) {
  // an empty label means "say nothing" — used while Google is throttling,
  // where blaming the user's keywords would be wrong
  if (!rows.length) {
    return emptyLabel ? <p className="py-4 text-sm text-ink-faint">{emptyLabel}</p> : null;
  }
  return (
    <div className="divide-y divide-line">
      {rows.map((row) => (
        <div key={row.query} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{row.query}</p>
            <p className="truncate text-[11px] text-ink-faint">{row.contentAngle}</p>
          </div>

          {row.popularity !== null && (
            <span className="tabular w-10 text-right text-xs text-ink-soft">{row.popularity}</span>
          )}
          {row.change !== null &&
            (row.breakout ? (
              <Badge tone="good">Breakout</Badge>
            ) : (
              <span className="tabular text-xs text-good">
                +{row.change}%
              </span>
            ))}

          <button
            onClick={() => onDrillDown(row.query)}
            className="hidden cursor-pointer text-xs text-ink-faint hover:text-accent-strong sm:block"
          >
            {relatedLabel}
          </button>
          <GenerateLink type={row.suggestion.type} topic={row.query} label={row.suggestion.label} />
        </div>
      ))}
    </div>
  );
}

// ── streamed sections ────────────────────────────────────────
//
// Each of these unwraps the server's promise with `use()`, so it suspends on
// its own and the rest of the page does not wait for it. Once the user changes
// anything, `override` carries the fresh result and the promise is ignored.

/**
 * The result currently on show: a client re-fetch if there is one, else the
 * server's. `failed` marks a refresh that never landed — what is on screen
 * stays, but the section reports itself unavailable rather than passing off
 * the previous query's numbers as an answer to this one.
 */
function useSection<T>(
  promise: Promise<TrendsOutcome<T>>,
  override: TrendsOutcome<T> | null,
  failed: boolean
): TrendsOutcome<T> {
  const streamed = use(promise);
  const state = override ?? streamed;
  return failed ? { ...state, available: false, rateLimited: false } : state;
}

/** Links to the same query on Google Trends — needs the resolved keywords. */
function ExploreSourceLink({
  promise,
  override,
}: {
  promise: Promise<ExploreState>;
  override: ExploreState | null;
}) {
  const t = useT();
  const { data } = useSection(promise, override, false);
  return <SourceLink href={data.sourceUrl} label={t("trends.viewOnGoogle")} />;
}

/** The outage notice and the keyword comparison — both exist only once data does. */
function ExploreSummary({
  promise,
  override,
  failed,
}: {
  promise: Promise<ExploreState>;
  override: ExploreState | null;
  failed: boolean;
}) {
  const t = useT();
  const { data, available, rateLimited } = useSection(promise, override, failed);
  return (
    <>
      {/* Throttling is Google pacing us, not an outage and nothing the user
          can act on — it passes silently and the panels simply stay empty. */}
      {!available && !rateLimited && (
        <p className="px-1 text-xs text-mid">{t("trends.unavailable")}</p>
      )}

      {/* ── Comparing keywords: Google's Average interest ─────── */}
      {data.keywords.length > 0 && (
        <Card>
          <CardHeader
            title={t("trends.comparing", { count: data.keywords.length })}
            hint={t("trends.averageInterestHint")}
          />
          <div className="divide-y divide-line px-5 pb-4">
            {data.keywords.map((k) => (
              <div key={k.keyword} className="flex items-center gap-3 py-2.5">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{k.keyword}</p>
                  <p className="truncate text-[11px] text-ink-faint">{k.contentAngle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-medium text-ink">{k.averageInterest}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                    {t("trends.averageInterest")}
                  </p>
                </div>
                <GenerateLink type={k.suggestion.type} topic={k.keyword} label={k.suggestion.label} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

/** One of Google's two ranked lists. The card and its heading render without it. */
function QueryPanel({
  kind,
  promise,
  override,
  failed,
  onDrillDown,
}: {
  kind: "top" | "rising";
  promise: Promise<ExploreState>;
  override: ExploreState | null;
  failed: boolean;
  onDrillDown: (query: string) => void;
}) {
  const t = useT();
  const { data, rateLimited } = useSection(promise, override, failed);
  return (
    <QueryRows
      rows={kind === "top" ? data.top : data.rising}
      emptyLabel={rateLimited ? "" : t("trends.noResults")}
      onDrillDown={onDrillDown}
      relatedLabel={t("trends.related")}
    />
  );
}

/** Trending now's rows, note and source link — everything below its header. */
function TrendingBody({
  promise,
  override,
  failed,
  timeframe,
  busy,
}: {
  promise: Promise<TrendingState>;
  override: TrendingState | null;
  failed: boolean;
  timeframe: TrendingTimeframe;
  busy: boolean;
}) {
  const t = useT();
  const { data, available } = useSection(promise, override, failed);
  const items = data.items.slice(0, TRENDING_PREVIEW);
  return (
    <>
      {!available ? (
        <p className="py-4 text-sm text-ink-faint">{t("trends.unavailable")}</p>
      ) : !items.length ? (
        <p className="py-4 text-sm text-ink-faint">
          {busy ? t("common.loading") : t("trends.noResults")}
        </p>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.title} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{item.title}</p>
                {/* why it's trending — Google supplies this on the daily feed */}
                {item.news[0] && (
                  <a
                    href={item.news[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-[11px] text-ink-faint hover:text-accent-strong"
                  >
                    {item.news[0].title} · {item.news[0].source}
                  </a>
                )}
              </div>
              <span className="tabular shrink-0 text-xs text-ink-soft">
                {t("trends.searchVolume", { volume: item.formattedVolume })}
              </span>
              <GenerateLink
                type={item.suggestion.type}
                topic={item.title}
                label={item.suggestion.label}
              />
            </div>
          ))}
        </div>
      )}
      {/* the daily feed covers one day; say so only when that falls short
          of the window the user asked for */}
      {available && data.source === "daily" && timeframe !== "24h" && (
        <p className="pt-2 text-[11px] text-ink-faint">{t("trends.dailyFeedNote")}</p>
      )}
      <div className="pt-2">
        <SourceLink href={data.sourceUrl} label={t("trends.viewOnGoogle")} />
      </div>
    </>
  );
}

export function TrendsExplorer({
  projectId,
  market,
  initialGeo,
  explorePromise,
  trendingPromise,
}: {
  projectId: string;
  /** The project's monitoring market — shown so the two are never confused. */
  market: string;
  initialGeo: string;
  /** Streamed by the server: awaited inside each section, not up front. */
  explorePromise: Promise<ExploreState>;
  trendingPromise: Promise<TrendingState>;
}) {
  const t = useT();
  const [geo, setGeo] = useState(initialGeo);
  const [query, setQuery] = useState("");
  const [timeframe, setTimeframe] = useState<ExploreTimeframe>("week");
  const [trendingTimeframe, setTrendingTimeframe] = useState<TrendingTimeframe>("24h");

  // null until the user changes something — the streamed result stands in
  const [exploreOverride, setExploreOverride] = useState<ExploreState | null>(null);
  const [trendingOverride, setTrendingOverride] = useState<TrendingState | null>(null);
  // a refresh that never landed — kept apart from the data so the section can
  // say so without the last good result being thrown away
  const [exploreFailed, setExploreFailed] = useState(false);
  const [trendingFailed, setTrendingFailed] = useState(false);
  const [exploreBusy, setExploreBusy] = useState(false);
  const [trendingBusy, setTrendingBusy] = useState(false);

  // last request identity per module — a repeat of the same keywords/geo/
  // timeframe is skipped entirely rather than re-fetched
  const lastExplore = useRef<string | null>(null);
  const lastTrending = useRef<string | null>(null);

  const label = (g: string) => (g === "" ? t("trends.worldwide") : geoLabel(g));

  // Trending now is a per-country feed at Google. Derived from the selected
  // geo rather than the last response, so switching to Worldwide explains
  // itself immediately instead of after a round trip that cannot succeed.
  const trendingUnsupported = !supportsTrendingNow(geo);

  async function loadExplore(next: { q?: string; geo?: string; tf?: ExploreTimeframe; persist?: boolean }) {
    const params = new URLSearchParams({
      projectId,
      mode: "explore",
      q: next.q ?? query,
      geo: next.geo ?? geo,
      timeframe: next.tf ?? timeframe,
    });
    if (next.persist) params.set("persistGeo", "1");
    setExploreBusy(true);
    try {
      const res = await fetch(`/api/trends?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setExploreFailed(true);
        return;
      }
      if (data.key === lastExplore.current) return; // identical result already shown
      lastExplore.current = data.key;
      setExploreOverride({
        data: data as ExploreResult,
        available: Boolean(data.available),
        rateLimited: Boolean(data.rateLimited),
      });
      setExploreFailed(false);
    } catch {
      setExploreFailed(true);
    } finally {
      setExploreBusy(false);
    }
  }

  async function loadTrending(next: { geo?: string; tf?: TrendingTimeframe; persist?: boolean }) {
    const params = new URLSearchParams({
      projectId,
      mode: "trending",
      geo: next.geo ?? geo,
      timeframe: next.tf ?? trendingTimeframe,
    });
    if (next.persist) params.set("persistGeo", "1");
    setTrendingBusy(true);
    try {
      const res = await fetch(`/api/trends?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setTrendingFailed(true);
        return;
      }
      if (data.key === lastTrending.current) return;
      lastTrending.current = data.key;
      setTrendingOverride({ data: data as TrendingNowResult, available: Boolean(data.available) });
      setTrendingFailed(false);
    } catch {
      setTrendingFailed(true);
    } finally {
      setTrendingBusy(false);
    }
  }

  /** The geo is shared by both modules and remembered server-side. */
  function changeGeo(g: string) {
    setGeo(g);
    loadExplore({ geo: g, persist: true });
    loadTrending({ geo: g });
  }

  function drillDown(term: string) {
    setQuery(term);
    loadExplore({ q: term });
  }

  return (
    <div className="stagger space-y-4">
      {/* ── Explore: keyword + geo + timeline ─────────────────── */}
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadExplore({});
          }}
          className="space-y-3"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("trends.searchPlaceholder")}
              className="pl-8"
              aria-label={t("common.search")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tr-geo">{t("trends.geoFilterLabel")}</Label>
              {/* same list, same order, same labels as "+ Add market" */}
              <Select id="tr-geo" value={geo} onChange={(e) => changeGeo(e.target.value)}>
                {TRENDS_GEOS.map((g) => (
                  <option key={g || "worldwide"} value={g}>
                    {label(g)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tr-time">{t("trends.timelineLabel")}</Label>
              <Select
                id="tr-time"
                value={timeframe}
                onChange={(e) => {
                  const tf = e.target.value as ExploreTimeframe;
                  setTimeframe(tf);
                  loadExplore({ tf });
                }}
              >
                {EXPLORE_TIMEFRAMES.map((tf) => (
                  <option key={tf.id} value={tf.id}>
                    {tf.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="submit" size="md" disabled={exploreBusy}>
              {exploreBusy ? t("common.loading") : t("common.search")}
            </Button>
            <Suspense fallback={<span className="h-4 w-32 rounded bg-hover" />}>
              <ExploreSourceLink promise={explorePromise} override={exploreOverride} />
            </Suspense>
          </div>
          <p className="text-[11px] text-ink-faint">
            {t("trends.geoScope", { geo: label(geo) })}
            {geo !== market && ` · ${t("trends.geoMarketNote", { market })}`}
          </p>
        </form>
      </Card>

      {/* streams in on its own; nothing above it waits */}
      <Suspense fallback={null}>
        <ExploreSummary
          promise={explorePromise}
          override={exploreOverride}
          failed={exploreFailed}
        />
      </Suspense>

      {/* ── Explore: Top + Rising queries ─────────────────────── */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold">{t("trends.explore")}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t("trends.topQueries")}
              hint={t("trends.topQueriesHint", { geo: label(geo) })}
            />
            <div className="px-5 pb-4">
              <Suspense fallback={<RowsSkeleton />}>
                <QueryPanel
                  kind="top"
                  promise={explorePromise}
                  override={exploreOverride}
                  failed={exploreFailed}
                  onDrillDown={drillDown}
                />
              </Suspense>
            </div>
          </Card>
          <Card>
            <CardHeader
              title={t("trends.risingQueriesTitle")}
              hint={t("trends.risingQueries", { geo: label(geo) })}
            />
            <div className="px-5 pb-4">
              <Suspense fallback={<RowsSkeleton />}>
                <QueryPanel
                  kind="rising"
                  promise={explorePromise}
                  override={exploreOverride}
                  failed={exploreFailed}
                  onDrillDown={drillDown}
                />
              </Suspense>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Trending now: independent, keyword-free ───────────── */}
      <Card>
        <CardHeader
          title={t("trends.trendingNow")}
          hint={t("trends.trendingNowHint", { geo: label(geo) })}
          action={
            <Select
              value={trendingTimeframe}
              onChange={(e) => {
                const tf = e.target.value as TrendingTimeframe;
                setTrendingTimeframe(tf);
                loadTrending({ tf });
              }}
              className="w-40"
              aria-label={t("trends.timelineLabel")}
            >
              {TRENDING_TIMEFRAMES.map((tf) => (
                <option key={tf.id} value={tf.id}>
                  {tf.label}
                </option>
              ))}
            </Select>
          }
        />
        <div className="px-5 pb-4">
          {/* Google publishes this per country only — say so rather than
              blaming an outage the user could wait out. Known from the geo
              alone, so it answers at once instead of shimmering for a request
              that cannot succeed. */}
          {trendingUnsupported ? (
            <p className="py-4 text-sm text-ink-faint">{t("trends.trendingNeedsRegion")}</p>
          ) : (
            <Suspense fallback={<RowsSkeleton rows={TRENDING_PREVIEW} />}>
              <TrendingBody
                promise={trendingPromise}
                override={trendingOverride}
                failed={trendingFailed}
                timeframe={trendingTimeframe}
                busy={trendingBusy}
              />
            </Suspense>
          )}
        </div>
      </Card>
    </div>
  );
}
