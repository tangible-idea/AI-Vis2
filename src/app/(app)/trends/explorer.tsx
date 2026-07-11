"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Search, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { TIMEFRAMES, type TrendResult, type Timeframe } from "@/lib/trends";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

function DirectionIcon({ direction }: { direction: TrendResult["direction"] }) {
  if (direction === "rising") return <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-good" />;
  if (direction === "declining") return <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-poor" />;
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />;
}

/** One trend per row: keyword, growth, direction, one-click generate. */
export function TrendRows({ results, related }: { results: TrendResult[]; related?: (kw: string) => void }) {
  const t = useT();
  if (!results.length) {
    return <p className="py-4 text-sm text-ink-faint">{t("trends.noResults")}</p>;
  }
  return (
    <div className="divide-y divide-line">
      {results.map((row) => (
        <div key={row.keyword} className="flex items-center gap-3 py-2.5">
          <DirectionIcon direction={row.direction} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{row.keyword}</p>
            <p className="truncate text-[11px] text-ink-faint">{row.contentAngle}</p>
          </div>
          <span className={cn("tabular text-xs", row.growth >= 0 ? "text-good" : "text-poor")}>
            {row.growth >= 0 ? "+" : ""}
            {row.growth}%
          </span>
          <span className="tabular hidden w-16 text-right text-xs text-ink-faint sm:block">{row.volume}</span>
          {related && (
            <button
              onClick={() => related(row.keyword)}
              className="hidden cursor-pointer text-xs text-ink-faint hover:text-accent-strong sm:block"
              title={t("trends.related")}
            >
              {t("trends.related")}
            </button>
          )}
          <Link
            href={`/optimize?type=${row.suggestion.type}&topic=${encodeURIComponent(row.keyword)}`}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover"
          >
            <Wand2 className="h-3 w-3" />
            {row.suggestion.label}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function TrendsExplorer({
  projectId,
  initialSearches,
  initialTopics,
}: {
  projectId: string;
  initialSearches: TrendResult[];
  initialTopics: TrendResult[];
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [searches, setSearches] = useState(initialSearches);
  const [topics, setTopics] = useState(initialTopics);
  const [query, setQuery] = useState("");
  const [keywordResults, setKeywordResults] = useState<TrendResult[] | null>(null);
  const [keywordHeading, setKeywordHeading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();

  async function api(mode: string, q = "", tf = timeframe): Promise<TrendResult[]> {
    const params = new URLSearchParams({ projectId, mode, q, timeframe: tf });
    const res = await fetch(`/api/trends?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  }

  async function changeTimeframe(tf: Timeframe) {
    setTimeframe(tf);
    setBusy(true);
    const [s, t] = await Promise.all([api("trending", "", tf), api("topics", "", tf)]);
    setSearches(s);
    setTopics(t);
    if (keywordResults && query) setKeywordResults(await api("search", query, tf));
    setBusy(false);
  }

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    const kws = query.split(",").map((s) => s.trim()).filter(Boolean);
    setKeywordHeading(
      kws.length > 1 ? t("trends.comparing", { count: kws.length }) : t("trends.interestIn", { kw: kws[0] })
    );
    setKeywordResults(await api("search", query));
    setBusy(false);
  }

  async function related(keyword: string) {
    setBusy(true);
    setQuery(keyword);
    setKeywordHeading(t("trends.relatedTo", { kw: keyword }));
    setKeywordResults(await api("related", keyword));
    setBusy(false);
  }

  return (
    <div className="stagger space-y-4">
      {/* search + compare + timeframe */}
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("trends.searchPlaceholder")}
              className="pl-8"
              aria-label={t("common.search")}
            />
          </div>
          <Select
            value={timeframe}
            onChange={(e) => changeTimeframe(e.target.value as Timeframe)}
            className="w-40"
            aria-label="Timeframe"
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Button type="submit" size="md" disabled={busy}>
            {busy ? t("common.loading") : t("common.search")}
          </Button>
        </form>
      </Card>

      {keywordResults && (
        <Card>
          <CardHeader
            title={keywordHeading ?? t("trends.keywordResults")}
            hint={t("trends.interestHint")}
          />
          <div className="px-5 pb-4">
            <TrendRows results={keywordResults} related={related} />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={t("trends.trendingSearches")} hint={t("trends.risingQueries")} />
        <div className="px-5 pb-4">
          <TrendRows results={searches} related={related} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("trends.trendingTopics")} hint={t("trends.topicsHint")} />
        <div className="px-5 pb-4">
          <TrendRows results={topics} related={related} />
        </div>
      </Card>
    </div>
  );
}
