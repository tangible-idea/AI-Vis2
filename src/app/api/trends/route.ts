import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { brandContextFor } from "@/lib/brand";
import {
  exploreTrends,
  isExploreTimeframe,
  isTrendingTimeframe,
  isValidTrendsGeo,
  parseKeywords,
  requestKey,
  resolveTrendsGeo,
  trendingNow,
  type ExploreTimeframe,
  type TrendingTimeframe,
} from "@/lib/trends";
import type { Project } from "@/lib/types";

/**
 * GET /api/trends
 *   ?mode=explore   &projectId=…&geo=SG&timeframe=week|3m|12m&q=saas,ai visibility
 *   ?mode=trending  &projectId=…&geo=SG&timeframe=24h|7d
 *
 * `geo` is the Google Trends geo and is independent of the project's
 * monitoring market; add `persistGeo=1` (sent only when the user actively
 * picks one) to remember it on the project.
 *
 * Explore with no keywords falls back to the brand's industry, so the page
 * still shows real Google data before anything is typed.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const mode = url.searchParams.get("mode") === "trending" ? "trending" : "explore";
  const requestedGeo = url.searchParams.get("geo");
  const persistGeo = url.searchParams.get("persistGeo") === "1";

  const [{ data: project }, { data: profile }, { data: competitors }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.from("competitors").select("name, website").eq("project_id", projectId).order("position"),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!planLimits(profile?.plan).trends) {
    return NextResponse.json({ error: "Trends are available on Starter and Pro", code: "limit" }, { status: 403 });
  }

  const brand = brandContextFor(project as Project, competitors ?? []);
  const geo = await resolveGeo(supabase, project, brand.market, requestedGeo, persistGeo);

  if (mode === "trending") {
    const tf = url.searchParams.get("timeframe") ?? "24h";
    const timeframe: TrendingTimeframe = isTrendingTimeframe(tf) ? tf : "24h";
    const params = { geo, timeframe, language: brand.language };
    const { data, available, unsupported } = await trendingNow(params);
    return NextResponse.json({
      ...data,
      // only the top 5 are shown — this section is deliberately lightweight
      items: data.items.slice(0, 5),
      geo,
      timeframe,
      available,
      /** Google has no trending feed for this geo — not an outage. */
      unsupported: unsupported ?? false,
      key: requestKey("trending", params),
    });
  }

  const tf = url.searchParams.get("timeframe") ?? "week";
  const timeframe: ExploreTimeframe = isExploreTimeframe(tf) ? tf : "week";
  // the input enforces the same rule; this is the server's own guard
  const { keywords } = parseKeywords(url.searchParams.get("q") ?? "");
  const params = {
    // no keyword yet → show the brand's own category, still from Google
    keywords: keywords.length ? keywords : [brand.industryPhrase],
    geo,
    timeframe,
    language: brand.language,
  };
  const { data, available, rateLimited } = await exploreTrends(params);
  return NextResponse.json({
    ...data,
    geo,
    timeframe,
    available,
    /** Google is throttling us — transient, and not worth alarming the user. */
    rateLimited: rateLimited ?? false,
    /** True when the results describe the brand's category, not a typed query. */
    implicit: keywords.length === 0,
    key: requestKey("explore", params),
  });
}

/**
 * The geo for this request. An explicit, valid pick wins and is remembered;
 * otherwise the stored geo applies, falling back to the monitoring market.
 */
async function resolveGeo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  project: { id: string; trends_geo?: string | null },
  market: string,
  requestedGeo: string | null,
  persistGeo: boolean
): Promise<string> {
  if (requestedGeo === null || !isValidTrendsGeo(requestedGeo)) {
    return resolveTrendsGeo(project.trends_geo, market);
  }
  if (persistGeo && requestedGeo !== project.trends_geo) {
    const { error } = await supabase
      .from("projects")
      .update({ trends_geo: requestedGeo })
      .eq("id", project.id);
    // migration 0011 not applied yet: the geo still works, it just isn't remembered
    if (error) console.warn("[trends] could not remember geo:", error.message);
  }
  return requestedGeo;
}
