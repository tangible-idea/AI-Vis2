import { ExternalLink } from "lucide-react";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { engineInfo } from "@/lib/ai/engines";
import { timeAgo } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, Badge } from "@/components/ui";
import { ScanButton } from "@/components/scan-button";
import { getT } from "@/lib/i18n/server";
import type { Engine, ScanResult, SourceType } from "@/lib/types";

export const metadata = { title: "Sources" };

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

interface Citation {
  engine: Engine;
  promptText: string;
  responseText: string;
  url: string;
}

interface SourceRow {
  domain: string;
  url: string;
  type: SourceType;
  engines: Set<Engine>;
  count: number;
  citations: Citation[];
}

/** Short excerpt around the first in-text occurrence of the domain, if any. */
function citationExcerpt(text: string, domain: string): { before: string; match: string; after: string } | null {
  const idx = text.toLowerCase().indexOf(domain.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + domain.length + 120);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, idx),
    match: text.slice(idx, idx + domain.length),
    after: text.slice(idx + domain.length, end) + (end < text.length ? "…" : ""),
  };
}

export default async function SourcesPage() {
  const { project } = await requireProject();
  const supabase = await createClient();
  const t = await getT();

  const { data: lastDone } = await supabase
    .from("scans")
    .select("id, completed_at")
    .eq("project_id", project.id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: resultRows }, { data: promptRows }] = await Promise.all([
    lastDone
      ? supabase
          .from("scan_results")
          .select("engine, sources, prompt_id, response_text")
          .eq("scan_id", lastDone.id)
      : Promise.resolve({ data: [] }),
    supabase.from("prompts").select("id, text").eq("project_id", project.id),
  ]);
  const results = (resultRows ?? []) as Pick<
    ScanResult,
    "engine" | "sources" | "prompt_id" | "response_text"
  >[];
  const promptText = new Map((promptRows ?? []).map((p) => [p.id, p.text]));

  // aggregate by domain: which platforms cite it, how often, what kind —
  // and keep every citing answer so users can see the full context in-app
  const byDomain = new Map<string, SourceRow>();
  for (const r of results) {
    for (const s of r.sources ?? []) {
      const row = byDomain.get(s.domain) ?? {
        domain: s.domain,
        url: s.url,
        type: s.type,
        engines: new Set<Engine>(),
        count: 0,
        citations: [],
      };
      row.engines.add(r.engine);
      row.count++;
      row.citations.push({
        engine: r.engine,
        promptText: promptText.get(r.prompt_id) ?? "(prompt no longer tracked)",
        responseText: r.response_text,
        url: s.url,
      });
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
        title={t("sources.title")}
        subtitle={
          lastDone
            ? t("sources.subtitleScanned", { time: timeAgo(lastDone.completed_at) })
            : t("sources.subtitleEmpty")
        }
        action={<ScanButton projectId={project.id} />}
      />

      <div className="stagger space-y-4">
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{t("sources.citedDomains")}</p>
              <p className="tabular mt-1.5 text-2xl font-medium text-ink">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{t("sources.yourProperties")}</p>
              <p className="tabular mt-1.5 text-2xl font-medium text-good">{officialCount}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{t("sources.competitorSites")}</p>
              <p className="tabular mt-1.5 text-2xl font-medium text-poor">{competitorCount}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader title={t("sources.citedSources")} hint={t("sources.citedSourcesHint")} />
          <div className="px-5 pb-4">
            {rows.length === 0 ? (
              <EmptyState title={t("sources.emptyTitle")} body={t("sources.emptyBody")} />
            ) : (
              <div className="divide-y divide-line">
                {rows.map((r) => (
                  <details key={r.domain} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=64`}
                        alt=""
                        width={20}
                        height={20}
                        className="shrink-0 rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink group-hover:text-accent-strong">
                          {r.domain}
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${r.domain} in a new tab`}
                            className="text-ink-faint hover:text-accent-strong"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-ink-faint">{t("sources.referencedBy")}</span>
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
                      <Badge tone={TYPE_TONE[r.type]}>{t(`sources.type.${r.type}`)}</Badge>
                      <span className="tabular w-8 text-right text-xs text-ink-faint">{r.count}×</span>
                      <span className="text-xs text-ink-faint transition-transform group-open:rotate-90">›</span>
                    </summary>

                    <div className="mb-3 space-y-3 rounded-lg bg-hover/50 p-3">
                      <p className="text-xs leading-relaxed text-ink-soft">{t(`sources.why.${r.type}`)}</p>
                      {r.citations.map((c, i) => {
                        const excerpt = citationExcerpt(c.responseText, r.domain);
                        return (
                          <div key={i} className="rounded-lg border border-line bg-paper p-3">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: engineInfo(c.engine).color }}
                              >
                                {engineInfo(c.engine).label}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
                                {t("sources.prompt")}: “{c.promptText}”
                              </span>
                            </div>
                            {excerpt ? (
                              <p className="text-xs leading-relaxed text-ink-soft">
                                {excerpt.before}
                                <mark className="rounded bg-accent-soft px-0.5 font-medium text-accent-strong">
                                  {excerpt.match}
                                </mark>
                                {excerpt.after}
                              </p>
                            ) : (
                              <>
                                <p className="mb-1 text-[11px] text-ink-faint">
                                  {t("sources.listedInSources")}
                                </p>
                                <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                                  {c.responseText.slice(0, 500)}
                                  {c.responseText.length > 500 ? "…" : ""}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
