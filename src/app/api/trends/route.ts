import { NextResponse } from "next/server";
import { industryPhrase } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { getTrendsSource, TIMEFRAMES, type Timeframe } from "@/lib/trends";

/**
 * GET /api/trends?projectId=…&mode=trending|topics|search|related&q=…&timeframe=30d
 * `q` is comma-separated keywords for search/compare, or one keyword for related.
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

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!planLimits(profile?.plan).trends) {
    return NextResponse.json({ error: "Trends are available on Starter and Pro", code: "limit" }, { status: 403 });
  }

  const source = getTrendsSource();
  const query = {
    industry: industryPhrase(project.industry),
    country: project.country,
    language: project.language,
    timeframe,
  };

  const results =
    mode === "topics"
      ? await source.trendingTopics(query)
      : mode === "search"
        ? await source.keywordInterest(q.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5), query)
        : mode === "related"
          ? await source.relatedQueries(q, query)
          : await source.trendingSearches(query);

  return NextResponse.json({ results, source: source.name });
}
