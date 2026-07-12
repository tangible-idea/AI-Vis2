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
  brandMentioned: boolean;
  competitors: string[];
}

interface SourceRow {
  domain: string;
  url: string;
  title: string | null;
  type: SourceType;
  engines: Set<Engine>;
  count: number;
  brandMentioned: boolean;
  competitorMentioned: boolean;
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

/** Splits text on brand occurrences so the brand can render bold + highlighted. */
function brandSegments(text: string, brand: string): { text: string; isBrand: boolean }[] {
  const b = brand.trim();
  if (!b) return [{ text, isBrand: false }];
  const re = new RegExp(`(${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text
    .split(re)
    .filter((s) => s !== "")
    .map((s) => ({ text: s, isBrand: s.toLowerCase() === b.toLowerCase() }));
}

function BrandText({ text, brand }: { text: string; brand: string }) {
  return (
    <>
      {brandSegments(text, brand).map((seg, i) =>
        seg.isBrand ? (
          <mark key={i} className="rounded bg-good-soft px-0.5 font-semibold text-good">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
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
          .select("engine, sources, prompt_id, response_text, brand_mentioned, competitors_mentioned")
          .eq("scan_id", lastDone.id)
      : Promise.resolve({ data: [] }),
    supabase.from("prompts").select("id, text").eq("project_id", project.id),
  ]);
  const results = (resultRows ?? []) as Pick<
    ScanResult,
    "engine" | "sources" | "prompt_id" | "response_text" | "brand_mentioned" | "competitors_mentioned"
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
        title: null,
        type: s.type,
        engines: new Set<Engine>(),
        count: 0,
        brandMentioned: false,
        competitorMentioned: false,
        citations: [],
      };
      row.engines.add(r.engine);
      row.count++;
      if (!row.title && s.title) row.title = s.title;
      if (r.brand_mentioned) row.brandMentioned = true;
      if ((r.competitors_mentioned ?? []).length > 0) row.competitorMentioned = true;
      row.citations.push({
        engine: r.engine,
        promptText: promptText.get(r.prompt_id) ?? "(prompt no longer tracked)",
        responseText: r.response_text,
        url: s.url,
        brandMentioned: r.brand_mentioned,
        competitors: r.competitors_mentioned ?? [],
      });
      // prefer the most specific classification for the domain
      if (row.type === "third_party" && s.type !== "third_party") row.type = s.type;
      byDomain.set(s.domain, row);
    }
  }
  const rows = [...byDomain.values()].sort((a, b) => b.count - a.count);
  const officialCount = rows.filter((r) => ["official", "docs", "knowledge_base", "blog"].includes(r.type)).length;
  const competitorCount = rows.filter((r) => r.type === "competitor").length;

  // typical citation frequency, for the human-friendly "appears N times more
  // often than similar sources" copy (replaces raw 7× / 3× counters)
  const counts = rows.map((r) => r.count).sort((a, b) => a - b);
  const median = counts.length ? counts[Math.floor(counts.length / 2)] : 1;

  const frequencyCopy = (count: number) => {
    const ratio = Math.round(count / Math.max(median, 1));
    if (ratio >= 2) return t("sources.frequencyHigh", { times: ratio });
    return count === 1 ? t("sources.frequencyOnce") : t("sources.frequency", { count });
  };

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
                        <span className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-ink group-hover:text-accent-strong">
                          <span className="truncate">{r.title ?? r.domain}</span>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${r.domain} in a new tab`}
                            className="shrink-0 text-ink-faint hover:text-accent-strong"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {r.title && <span className="text-[11px] text-ink-faint">{r.domain} ·</span>}
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
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <Badge tone={r.brandMentioned ? "good" : "neutral"}>
                          {t("sources.brandMentioned")} {r.brandMentioned ? t("common.yes") : t("common.no")}
                        </Badge>
                        <Badge tone={r.competitorMentioned ? "mid" : "neutral"}>
                          {t("sources.competitorMentioned")} {r.competitorMentioned ? t("common.yes") : t("common.no")}
                        </Badge>
                      </span>
                      <Badge tone={TYPE_TONE[r.type]}>{t(`sources.type.${r.type}`)}</Badge>
                      <span className="text-xs text-ink-faint transition-transform group-open:rotate-90">›</span>
                    </summary>

                    <div className="mb-3 space-y-3 rounded-lg bg-hover/50 p-3">
                      <p className="text-xs leading-relaxed text-ink-soft">
                        <span className="font-medium text-ink">{t("sources.whyReferenced")}</span>{" "}
                        {t(`sources.why.${r.type}`)} {frequencyCopy(r.count)}
                      </p>
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
                              <>
                                <p className="mb-1 text-[11px] font-medium text-ink-faint">
                                  {t("sources.citedText")}
                                </p>
                                <p className="text-xs leading-relaxed text-ink-soft">
                                  <BrandText text={excerpt.before} brand={project.name} />
                                  <mark className="rounded bg-accent-soft px-0.5 font-medium text-accent-strong">
                                    {excerpt.match}
                                  </mark>
                                  <BrandText text={excerpt.after} brand={project.name} />
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="mb-1 text-[11px] font-medium text-ink-faint">
                                  {t("sources.aiResponse")} · {t("sources.listedInSources")}
                                </p>
                                <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                                  <BrandText
                                    text={c.responseText.slice(0, 500) + (c.responseText.length > 500 ? "…" : "")}
                                    brand={project.name}
                                  />
                                </p>
                              </>
                            )}
                            {c.competitors.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-ink-faint">{t("sources.competitorsNamed")}</span>
                                {c.competitors.map((name) => (
                                  <Badge key={name} tone="neutral">
                                    {name}
                                  </Badge>
                                ))}
                              </div>
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
