import { ExternalLink } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { engineInfo } from "@/lib/ai/engines";
import { timeAgo } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, Badge } from "@/components/ui";
import { ScanButton } from "@/components/scan-button";
import type { Engine, ScanResult, SourceType } from "@/lib/types";

export const metadata = { title: "Sources" };

const TYPE_LABEL: Record<SourceType, string> = {
  official: "Official website",
  competitor: "Competitor",
  review: "Third-party review",
  news: "News",
  docs: "Documentation",
  knowledge_base: "Knowledge base",
  blog: "Blog",
  third_party: "Third-party",
};

const TYPE_TONE: Record<SourceType, "good" | "mid" | "poor" | "neutral" | "accent"> = {
  official: "accent",
  competitor: "poor",
  review: "mid",
  news: "neutral",
  docs: "good",
  knowledge_base: "good",
  blog: "good",
  third_party: "neutral",
};

interface SourceRow {
  domain: string;
  url: string;
  type: SourceType;
  engines: Set<Engine>;
  count: number;
}

export default async function SourcesPage() {
  const { project } = await requireProject();
  const supabase = await createClient();

  const { data: lastDone } = await supabase
    .from("scans")
    .select("id, completed_at")
    .eq("project_id", project.id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: resultRows } = lastDone
    ? await supabase.from("scan_results").select("engine, sources").eq("scan_id", lastDone.id)
    : { data: [] };
  const results = (resultRows ?? []) as Pick<ScanResult, "engine" | "sources">[];

  // aggregate by domain: which platforms cite it, how often, what kind
  const byDomain = new Map<string, SourceRow>();
  for (const r of results) {
    for (const s of r.sources ?? []) {
      const row = byDomain.get(s.domain) ?? {
        domain: s.domain,
        url: s.url,
        type: s.type,
        engines: new Set<Engine>(),
        count: 0,
      };
      row.engines.add(r.engine);
      row.count++;
      // prefer the most specific classification for the domain
      if (row.type === "third_party" && s.type !== "third_party") row.type = s.type;
      byDomain.set(s.domain, row);
    }
  }
  const rows = [...byDomain.values()].sort((a, b) => b.count - a.count);
  const officialCount = rows.filter((r) => ["official", "docs", "knowledge_base", "blog"].includes(r.type)).length;
  const competitorCount = rows.filter((r) => r.type === "competitor").length;

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle={
          lastDone
            ? `Why AI mentions you — where engines got their information, from the scan ${timeAgo(lastDone.completed_at)}`
            : "Why AI mentions you — run a scan to see where engines get their information"
        }
        action={<ScanButton projectId={project.id} />}
      />

      <div className="stagger space-y-4">
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Cited domains</p>
              <p className="tabular mt-1.5 text-2xl font-medium text-ink">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Your properties</p>
              <p className="tabular mt-1.5 text-2xl font-medium text-good">{officialCount}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Competitor sites</p>
              <p className="tabular mt-1.5 text-2xl font-medium text-poor">{competitorCount}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Cited sources"
            hint="Every domain AI engines referenced when answering your buyers' questions"
          />
          <div className="px-5 pb-4">
            {rows.length === 0 ? (
              <EmptyState
                title="No sources detected yet"
                body="Citations show up when engines reference specific pages — most often on Perplexity and Google AI Overview. Run a scan, then publish citable content (FAQ, comparison pages, docs) to grow this list."
              />
            ) : (
              <div className="divide-y divide-line">
                {rows.map((r) => (
                  <div key={r.domain} className="flex items-center gap-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=64`}
                      alt=""
                      width={20}
                      height={20}
                      className="shrink-0 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-accent-strong"
                      >
                        {r.domain}
                        <ExternalLink className="h-3 w-3 text-ink-faint" />
                      </a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-ink-faint">Referenced by</span>
                        {[...r.engines].map((e) => (
                          <span key={e} className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: engineInfo(e).color }}
                            />
                            {engineInfo(e).label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge>
                    <span className="tabular w-8 text-right text-xs text-ink-faint">{r.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
