import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { brandContextFor } from "@/lib/brand";
import { exploreTrends, resolveTrendsGeo, trendingNow } from "@/lib/trends";
import { PageHeader, Card, CardHeader, LockedOverlay } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { TrendsExplorer } from "./explorer";

export const metadata = { title: "Trends" };

export default async function TrendsPage() {
  const { project, profile } = await requireProject();
  const limits = planLimits(profile.plan);
  const t = await getT();

  const supabase = await createClient();
  const { data: competitors } = await supabase
    .from("competitors")
    .select("name, website")
    .eq("project_id", project.id)
    .order("position");
  const brand = brandContextFor(project, competitors ?? []);

  // the Google Trends geo is remembered per project and defaults to the
  // monitoring market — the two stay independent from here on
  const geo = resolveTrendsGeo(project.trends_geo, brand.market);

  if (!limits.trends) {
    return (
      <>
        <PageHeader title={t("trends.title")} subtitle={t("trends.subtitle")} />
        <LockedOverlay message={t("trends.locked")} cta={t("common.upgrade")}>
          <Card>
            <CardHeader title={t("trends.topQueries")} hint={t("trends.lockedHint")} />
            <div className="px-5 pb-8" />
          </Card>
        </LockedOverlay>
      </>
    );
  }

  // first paint carries real data: the category's Explore view plus what's
  // trending in the geo right now. Both are cached upstream for an hour.
  const [explore, trending] = await Promise.all([
    exploreTrends({
      keywords: [brand.industryPhrase],
      geo,
      timeframe: "week",
      language: brand.language,
    }),
    trendingNow({ geo, timeframe: "24h", language: brand.language }),
  ]);

  return (
    <>
      {/* the header stays location-free — the Google Trends Region selector
          in the explorer is the single place the active geo is stated */}
      <PageHeader title={t("trends.title")} subtitle={t("trends.subtitle")} />
      <TrendsExplorer
        projectId={project.id}
        market={brand.market}
        initialGeo={geo}
        initialExplore={explore.data}
        initialExploreAvailable={explore.available}
        initialTrending={{ ...trending.data, items: trending.data.items.slice(0, 5) }}
        initialTrendingAvailable={trending.available}
      />
    </>
  );
}
