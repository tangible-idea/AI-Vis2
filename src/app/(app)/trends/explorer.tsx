"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Search, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { TIMEFRAMES, type TrendResult, type Timeframe } from "@/lib/trends";
import { cn } from "@/lib/utils";

function DirectionIcon({ direction }: { direction: TrendResult["direction"] }) {
  if (direction === "rising") return <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-good" />;
  if (direction === "declining") return <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-poor" />;
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />;
}

/** One trend per row: keyword, growth, direction, one-click generate. */
export function TrendRows({ results, related }: { results: TrendResult[]; related?: (kw: string) => void }) {
  if (!results.length) {
    return <p className="py-4 text-sm text-ink-faint">No results — try different keywords.</p>;
  }
  return (
    <div className="divide-y divide-line">
      {results.map((t) => (
        <div key={t.keyword} className="flex items-center gap-3 py-2.5">
          <DirectionIcon direction={t.direction} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{t.keyword}</p>
            <p className="truncate text-[11px] text-ink-faint">{t.contentAngle}</p>
          </div>
          <span className={cn("tabular text-xs", t.growth >= 0 ? "text-good" : "text-poor")}>
            {t.growth >= 0 ? "+" : ""}
            {t.growth}%
          </span>
          <span className="tabular hidden w-16 text-right text-xs text-ink-faint sm:block">{t.volume}</span>
          {related && (
            <button
              onClick={() => related(t.keyword)}
              className="hidden cursor-pointer text-xs text-ink-faint hover:text-accent-strong sm:block"
              title="Show related searches"
            >
              Related
            </button>
          )}
          <Link
            href={`/optimize?type=${t.suggestion.type}&topic=${encodeURIComponent(t.keyword)}`}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover"
          >
            <Wand2 className="h-3 w-3" />
            {t.suggestion.label}
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
  const [keywordHeading, setKeywordHeading] = useState("Keyword results");
  const [busy, setBusy] = useState(false);

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
    setKeywordHeading(kws.length > 1 ? `Comparing ${kws.length} keywords` : `Interest in "${kws[0]}"`);
    setKeywordResults(await api("search", query));
    setBusy(false);
  }

  async function related(keyword: string) {
    setBusy(true);
    setQuery(keyword);
    setKeywordHeading(`Related to "${keyword}"`);
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
              placeholder="Search a keyword — or several, comma-separated, to compare"
              className="pl-8"
              aria-label="Search keywords"
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
            {busy ? "Loading…" : "Search"}
          </Button>
        </form>
      </Card>

      {keywordResults && (
        <Card>
          <CardHeader title={keywordHeading} hint="Interest change over the selected timeframe" />
          <div className="px-5 pb-4">
            <TrendRows results={keywordResults} related={related} />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Trending searches" hint="Rising queries in your category and market" />
        <div className="px-5 pb-4">
          <TrendRows results={searches} related={related} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Trending topics" hint="Broader themes gaining attention" />
        <div className="px-5 pb-4">
          <TrendRows results={topics} related={related} />
        </div>
      </Card>
    </div>
  );
}
