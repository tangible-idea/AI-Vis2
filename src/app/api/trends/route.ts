import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { brandContextFor } from "@/lib/brand";
import {
  getTrendsSource,
  isValidTrendsGeo,
  resolveTrendsGeo,
  TIMEFRAMES,
  type Timeframe,
} from "@/lib/trends";
import type { Project } from "@/lib/types";

/**
 * GET /api/trends?projectId=…&mode=trending|topics|search|related&q=…&timeframe=30d&geo=US
 * `q` is comma-separated keywords for search/compare, or one keyword for related.
 *
 * `geo` is the Google Trends geo, independent of the project's monitoring
 * market. When supplied it is remembered on the project so the next visit
 * opens on the same geo; when omitted the stored geo (else the market) is used.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const mode = url.searchParams.get("mode") ?? "trending";
  const q = url.searchParams.get("q") ?? "";
  const tf = url.searchParams.get("timeframe") ?? "30d";
  const timeframe: Timeframe = TIMEFRAMES.some((t) => t.id === tf) ? (tf as Timeframe) : "30d";
  const requestedGeo = url.searchParams.get("geo");

  const [{ data: project }, { data: profile }, { data: competitors }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.from("competitors").select("name, website").eq("project_id", projectId).order("position"),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!planLimits(profile?.plan).trends) {
    return NextResponse.json({ error: "Trends are available on Starter and Pro", code: "limit" }, { status: 403 });
  }

  // Trends reads its industry/language from the shared Brand Context; only the
  // geo is its own dimension.
  const brand = brandContextFor(project as Project, competitors ?? []);
  let geo = resolveTrendsGeo(project.trends_geo, brand.market);
  if (requestedGeo !== null && isValidTrendsGeo(requestedGeo) && requestedGeo !== project.trends_geo) {
    geo = requestedGeo;
    await supabase.from("projects").update({ trends_geo: geo }).eq("id", projectId);
  }

  const source = getTrendsSource();
  const query = {
    industry: brand.industryPhrase,
    geo,
    language: brand.language,
    timeframe,
  };

  const results =
    mode === "topics"
      ? await source.trendingTopics(query)
      : mode === "search"
        ? await source.keywordInterest(splitKeywords(q), query)
        : mode === "related"
          ? await source.relatedQueries(q, query)
          : await source.trendingSearches(query);

  return NextResponse.json({ results, source: source.name, geo });
}

/** "computer software, saas" → ["computer software", "saas"] — one series each. */
function splitKeywords(q: string): string[] {
  return q
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}
