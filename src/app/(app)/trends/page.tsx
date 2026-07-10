import { requireProject } from "@/lib/project";
import { planLimits } from "@/lib/plans";
import { getTrendsSource } from "@/lib/trends";
import { CONTENT_LANGUAGES } from "@/lib/types";
import { PageHeader, Card, CardHeader, LockedOverlay } from "@/components/ui";
import { TrendsExplorer, TrendRows } from "./explorer";

export const metadata = { title: "Trends" };

export default async function TrendsPage() {
  const { project, profile } = await requireProject();
  const limits = planLimits(profile.plan);
  const langLabel =
    CONTENT_LANGUAGES.find((l) => l.code === project.language)?.label ?? project.language;

  const source = getTrendsSource();
  const query = {
    industry: project.industry,
    country: project.country,
    language: project.language,
    timeframe: "30d" as const,
  };
  const [searches, topics] = await Promise.all([
    source.trendingSearches(query),
    source.trendingTopics(query),
  ]);

  if (!limits.trends) {
    return (
      <>
        <PageHeader
          title="Trends"
          subtitle={`Search demand in ${project.country} · ${langLabel}`}
        />
        <LockedOverlay message="Google Trends insights are available on Starter and Pro">
          <Card>
            <CardHeader title="Trending searches" hint={`Rising demand in ${project.industry}`} />
            <div className="px-5 pb-4">
              <TrendRows results={searches.slice(0, 5)} />
            </div>
          </Card>
        </LockedOverlay>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Trends"
        subtitle={`Search demand in ${project.country} · ${langLabel} — turn rising topics into content in one click`}
      />
      <TrendsExplorer
        projectId={project.id}
        initialSearches={searches}
        initialTopics={topics}
      />
    </>
  );
}
