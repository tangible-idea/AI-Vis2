"use client";

import { useRef, useState } from "react";
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
} from "@/lib/trends";
import { useT } from "@/lib/i18n";

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
  if (!rows.length) return <p className="py-4 text-sm text-ink-faint">{emptyLabel}</p>;
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

export function TrendsExplorer({
  projectId,
  market,
  initialGeo,
  initialExplore,
  initialExploreAvailable,
  initialTrending,
  initialTrendingAvailable,
}: {
  projectId: string;
  /** The project's monitoring market — shown so the two are never confused. */
  market: string;
  initialGeo: string;
  initialExplore: ExploreResult;
  initialExploreAvailable: boolean;
  initialTrending: TrendingNowResult;
  initialTrendingAvailable: boolean;
}) {
  const t = useT();
  const [geo, setGeo] = useState(initialGeo);
  const [query, setQuery] = useState("");
  const [timeframe, setTimeframe] = useState<ExploreTimeframe>("week");
  const [trendingTimeframe, setTrendingTimeframe] = useState<TrendingTimeframe>("24h");

  const [explore, setExplore] = useState(initialExplore);
  const [exploreOk, setExploreOk] = useState(initialExploreAvailable);
  const [trending, setTrending] = useState(initialTrending);
  const [trendingOk, setTrendingOk] = useState(initialTrendingAvailable);
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
        setExploreOk(false);
        return;
      }
      if (data.key === lastExplore.current) return; // identical result already shown
      lastExplore.current = data.key;
      setExplore(data as ExploreResult);
      setExploreOk(data.available);
    } catch {
      setExploreOk(false);
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
        setTrendingOk(false);
        return;
      }
      if (data.key === lastTrending.current) return;
      lastTrending.current = data.key;
      setTrending(data as TrendingNowResult);
      setTrendingOk(data.available);
    } catch {
      setTrendingOk(false);
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
            <SourceLink href={explore.sourceUrl} label={t("trends.viewOnGoogle")} />
          </div>
          <p className="text-[11px] text-ink-faint">
            {t("trends.geoScope", { geo: label(geo) })}
            {geo !== market && ` · ${t("trends.geoMarketNote", { market })}`}
          </p>
        </form>
      </Card>

      {!exploreOk && (
        <p className="px-1 text-xs text-mid">{t("trends.unavailable")}</p>
      )}

      {/* ── Comparing keywords: Google's Average interest ─────── */}
      {explore.keywords.length > 0 && (
        <Card>
          <CardHeader
            title={t("trends.comparing", { count: explore.keywords.length })}
            hint={t("trends.averageInterestHint")}
          />
          <div className="divide-y divide-line px-5 pb-4">
            {explore.keywords.map((k) => (
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
              <QueryRows
                rows={explore.top}
                emptyLabel={t("trends.noResults")}
                onDrillDown={drillDown}
                relatedLabel={t("trends.related")}
              />
            </div>
          </Card>
          <Card>
            <CardHeader
              title={t("trends.risingQueriesTitle")}
              hint={t("trends.risingQueries", { geo: label(geo) })}
            />
            <div className="px-5 pb-4">
              <QueryRows
                rows={explore.rising}
                emptyLabel={t("trends.noResults")}
                onDrillDown={drillDown}
                relatedLabel={t("trends.related")}
              />
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
              blaming an outage the user could wait out */}
          {trendingUnsupported ? (
            <p className="py-4 text-sm text-ink-faint">{t("trends.trendingNeedsRegion")}</p>
          ) : !trendingOk ? (
            <p className="py-4 text-sm text-ink-faint">{t("trends.unavailable")}</p>
          ) : !trending.items.length ? (
            <p className="py-4 text-sm text-ink-faint">
              {trendingBusy ? t("common.loading") : t("trends.noResults")}
            </p>
          ) : (
            <div className="divide-y divide-line">
              {trending.items.map((item) => (
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
          {trendingOk && trending.source === "daily" && trendingTimeframe !== "24h" && (
            <p className="pt-2 text-[11px] text-ink-faint">{t("trends.dailyFeedNote")}</p>
          )}
          <div className="pt-2">
            <SourceLink href={trending.sourceUrl} label={t("trends.viewOnGoogle")} />
          </div>
        </div>
      </Card>
    </div>
  );
}
