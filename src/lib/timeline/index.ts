import type { SupabaseClient } from "@supabase/supabase-js";
import { ENGINES, engineInfo } from "../ai/engines";
import { getTrendsSource } from "../trends";
import type { Engine, Project, ScanResult, Snapshot } from "../types";

/**
 * AI Visibility Timeline — a presentation layer over data the product
 * already writes (snapshots, scans, results, recommendations, content,
 * share links, members, comments). Events are derived at read time; there
 * is no event store and nothing extra to maintain.
 */

export type TimelineCategory =
  | "visibility"
  | "citation"
  | "competitor"
  | "content"
  | "trends"
  | "recommendation"
  | "scan"
  | "reports"
  | "team";

export interface TimelineEvent {
  id: string;
  category: TimelineCategory;
  title: string;
  summary?: string;
  platform?: Engine;
  at: string; // ISO
  action?: { label: string; href: string };
  /** Key insight — surfaced in the highlights strip. */
  highlight?: boolean;
  tone: "good" | "bad" | "neutral";
}

export interface Achievement {
  id: string;
  label: string;
  achieved: boolean;
}

export interface MonthlyRecap {
  scoreDelta: number;
  engineDeltas: { id: Engine; label: string; delta: number }[];
  newCitations: number;
  competitorsSurpassed: number;
  contentGenerated: number;
  recommendationsCompleted: number;
}

export interface TimelineData {
  events: TimelineEvent[];
  insights: TimelineEvent[];
  achievements: Achievement[];
  recap: MonthlyRecap | null;
}

const MONTH_MS = 30 * 86_400_000;

export async function buildTimeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  project: Project,
  opts: { sinceIso?: string | null } = {}
): Promise<TimelineData> {
  const since = opts.sinceIso ?? "1970-01-01";
  const [
    { data: snapshots },
    { data: scans },
    { data: doneRecs },
    { data: content },
    { data: links },
    { data: members },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from("snapshots")
      .select("*")
      .eq("project_id", project.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    supabase
      .from("scans")
      .select("id, status, completed_at, created_at")
      .eq("project_id", project.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("recommendations")
      .select("id, title, status, completed_at")
      .eq("project_id", project.id)
      .eq("status", "done")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(15),
    supabase
      .from("generated_content")
      .select("id, title, type, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("share_links")
      .select("id, token, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("project_members")
      .select("id, email, accepted_at")
      .eq("project_id", project.id)
      .not("accepted_at", "is", null)
      .limit(10),
    supabase
      .from("project_comments")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // per-scan citation counts (last 4 completed scans is enough for diffs)
  const recentScans = (scans ?? []).slice(0, 4);
  const { data: resultRows } = recentScans.length
    ? await supabase
        .from("scan_results")
        .select("scan_id, engine, cited, sources")
        .in("scan_id", recentScans.map((s) => s.id))
    : { data: [] };
  const results = (resultRows ?? []) as Pick<ScanResult, "scan_id" | "engine" | "cited" | "sources">[];

  const history = (snapshots ?? []) as Snapshot[];
  const events: TimelineEvent[] = [];

  // ── visibility & competitor events from snapshot pairs ──────
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const cur = history[i];
    const d = cur.overall_score - prev.overall_score;
    if (d !== 0) {
      const bigMove = prev.overall_score > 0 && Math.abs(d) / prev.overall_score >= 0.1;
      events.push({
        id: `score-${cur.id}`,
        category: "visibility",
        title: `AI Visibility Score ${d > 0 ? "increased" : "decreased"}`,
        summary: `${prev.overall_score} → ${cur.overall_score}`,
        at: cur.created_at,
        tone: d > 0 ? "good" : "bad",
        highlight: d > 0 && bigMove,
        action: { label: "Open report", href: "/reports" },
      });
    }

    // platforms that lit up for the first time
    for (const e of ENGINES) {
      const p = prev.engine_scores[e.id] ?? 0;
      const c = cur.engine_scores[e.id] ?? 0;
      if (p === 0 && c > 0) {
        events.push({
          id: `first-${e.id}-${cur.id}`,
          category: "visibility",
          title: `${e.label} mentioned your brand for the first time`,
          summary: `Visibility score ${c} on ${e.label}`,
          platform: e.id,
          at: cur.created_at,
          tone: "good",
          highlight: true,
          action: { label: "View prompts", href: "/monitor" },
        });
      }
    }

    // share-of-voice crossings vs each competitor
    const brandPrev = prev.share_of_voice?.[project.name] ?? 0;
    const brandCur = cur.share_of_voice?.[project.name] ?? 0;
    for (const [name, curCount] of Object.entries(cur.share_of_voice ?? {})) {
      if (name === project.name) continue;
      const prevCount = prev.share_of_voice?.[name] ?? 0;
      if (prevCount <= brandPrev && curCount > brandCur) {
        events.push({
          id: `overtake-${name}-${cur.id}`,
          category: "competitor",
          title: `${name} overtook your brand in share of voice`,
          summary: `${name}: ${curCount} mentions vs your ${brandCur}`,
          at: cur.created_at,
          tone: "bad",
          highlight: true,
          action: { label: "Generate comparison page", href: "/optimize?type=comparison_page" },
        });
      } else if (prevCount > brandPrev && curCount <= brandCur) {
        events.push({
          id: `surpass-${name}-${cur.id}`,
          category: "competitor",
          title: `You overtook ${name} in share of voice`,
          summary: `Your ${brandCur} mentions vs ${name}'s ${curCount}`,
          at: cur.created_at,
          tone: "good",
          highlight: true,
        });
      }
    }
  }

  // ── citation events from scan-result diffs ──────────────────
  const citedByScan = (scanId: string, engine: Engine) =>
    results.filter((r) => r.scan_id === scanId && r.engine === engine && r.cited).length;
  const orderedRecent = [...recentScans].reverse(); // oldest → newest
  for (let i = 1; i < orderedRecent.length; i++) {
    const prevScan = orderedRecent[i - 1];
    const curScan = orderedRecent[i];
    for (const e of ENGINES) {
      const gained = citedByScan(curScan.id, e.id) - citedByScan(prevScan.id, e.id);
      const firstEver =
        citedByScan(curScan.id, e.id) > 0 &&
        orderedRecent.slice(0, i).every((s) => citedByScan(s.id, e.id) === 0);
      if (gained > 0) {
        events.push({
          id: `cite-${e.id}-${curScan.id}`,
          category: "citation",
          title: firstEver
            ? `${e.label} cited your website for the first time`
            : `${e.label} discovered ${gained} new citation${gained > 1 ? "s" : ""}`,
          platform: e.id,
          at: curScan.completed_at ?? curScan.created_at,
          tone: "good",
          highlight: firstEver,
          action: { label: "View sources", href: "/sources" },
        });
      }
    }
  }

  // ── scans, recommendations, content, reports, team ──────────
  for (const s of scans ?? []) {
    events.push({
      id: `scan-${s.id}`,
      category: "scan",
      title: "Scan completed across all AI platforms",
      at: s.completed_at ?? s.created_at,
      tone: "neutral",
      action: { label: "View prompts", href: "/monitor" },
    });
  }
  for (const r of doneRecs ?? []) {
    events.push({
      id: `rec-${r.id}`,
      category: "recommendation",
      title: `Completed: ${r.title}`,
      at: r.completed_at!,
      tone: "good",
    });
  }
  for (const c of content ?? []) {
    events.push({
      id: `content-${c.id}`,
      category: "content",
      title: `Generated: ${c.title || c.type}`,
      at: c.created_at,
      tone: "neutral",
      action: { label: "Open library", href: "/optimize" },
    });
  }
  for (const l of links ?? []) {
    events.push({
      id: `link-${l.id}`,
      category: "reports",
      title: "Public report link created",
      at: l.created_at,
      tone: "neutral",
      action: { label: "Open report", href: `/share/${l.token}` },
    });
  }
  for (const m of members ?? []) {
    events.push({
      id: `member-${m.id}`,
      category: "team",
      title: `${m.email} joined the workspace`,
      at: m.accepted_at!,
      tone: "good",
    });
  }
  for (const c of comments ?? []) {
    events.push({
      id: `comment-${c.id}`,
      category: "team",
      title: `${c.author_name || "Teammate"} left a note`,
      summary: c.body,
      at: c.created_at,
      tone: "neutral",
    });
  }

  // ── rising trend nudge (today) ───────────────────────────────
  try {
    const trends = await getTrendsSource().trendingSearches({
      industry: project.industry,
      country: project.country,
      language: project.language,
      timeframe: "30d",
    });
    const top = trends.filter((t) => t.direction === "rising").sort((a, b) => b.growth - a.growth)[0];
    if (top && top.growth >= 80) {
      events.push({
        id: `trend-${top.keyword}`,
        category: "trends",
        title: `Google Trends: "${top.keyword}" is rising fast`,
        summary: `+${top.growth}% interest — ${top.contentAngle}`,
        at: new Date().toISOString(),
        tone: "good",
        highlight: true,
        action: {
          label: top.suggestion.label,
          href: `/optimize?type=${top.suggestion.type}&topic=${encodeURIComponent(top.keyword)}`,
        },
      });
    }
  } catch {
    /* trends are decorative here */
  }

  events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const trimmed = events.slice(0, 60);

  // ── achievements ─────────────────────────────────────────────
  const latest = history.at(-1) ?? null;
  const anyCitation = results.some((r) => r.cited);
  const anyImprovement = history.some((s, i) => i > 0 && s.overall_score > history[i - 1].overall_score);
  const plus10 = history.length > 1 && latest !== null && latest.overall_score - history[0].overall_score >= 10;
  const achievements: Achievement[] = [
    { id: "first-citation", label: "First AI citation", achieved: anyCitation },
    { id: "first-improvement", label: "First weekly improvement", achieved: anyImprovement },
    { id: "plus-10", label: "AI Visibility +10", achieved: plus10 },
    { id: "all-platforms", label: "Referenced across all AI platforms", achieved: (latest?.coverage ?? 0) >= 1 },
    { id: "first-share", label: "First public report shared", achieved: (links ?? []).length > 0 },
    { id: "five-scans", label: "Five weekly scans", achieved: (scans ?? []).length >= 5 },
  ];

  // ── monthly recap ────────────────────────────────────────────
  const cutoff = Date.now() - MONTH_MS;
  const inMonth = history.filter((s) => +new Date(s.created_at) >= cutoff);
  let recap: MonthlyRecap | null = null;
  if (inMonth.length >= 2) {
    const first = inMonth[0];
    const last = inMonth[inMonth.length - 1];
    recap = {
      scoreDelta: last.overall_score - first.overall_score,
      engineDeltas: ENGINES.map((e) => ({
        id: e.id,
        label: e.label,
        delta: (last.engine_scores[e.id] ?? 0) - (first.engine_scores[e.id] ?? 0),
      })),
      newCitations: trimmed
        .filter((ev) => ev.category === "citation" && +new Date(ev.at) >= cutoff)
        .length,
      competitorsSurpassed: trimmed.filter(
        (ev) => ev.id.startsWith("surpass-") && +new Date(ev.at) >= cutoff
      ).length,
      contentGenerated: (content ?? []).filter((c) => +new Date(c.created_at) >= cutoff).length,
      recommendationsCompleted: (doneRecs ?? []).filter(
        (r) => +new Date(r.completed_at!) >= cutoff
      ).length,
    };
  }

  return {
    events: trimmed,
    insights: trimmed.filter((e) => e.highlight).slice(0, 4),
    achievements,
    recap,
  };
}

export { engineInfo };
