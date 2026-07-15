import { requireProject } from "@/lib/project";
import { planLimits } from "@/lib/plans";
import { getTrendsSource } from "@/lib/trends";
import { CONTENT_LANGUAGES , industryPhrase} from "@/lib/types";
import { PageHeader, Card, CardHeader, LockedOverlay } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { TrendsExplorer, TrendRows } from "./explorer";

export const metadata = { title: "Trends" };

export default async function TrendsPage() {
  const { project, profile } = await requireProject();
  const limits = planLimits(profile.plan);
  const t = await getT();
  const langLabel =
    CONTENT_LANGUAGES.find((l) => l.code === project.language)?.label ?? project.language;

  const source = getTrendsSource();
  const query = {
    industry: industryPhrase(project.industry),
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
          title={t("trends.title")}
          subtitle={t("trends.subtitleLocked", { country: project.country, language: langLabel })}
        />
        <LockedOverlay message={t("trends.locked")} cta={t("common.upgrade")}>
          <Card>
            <CardHeader
              title={t("trends.trendingSearches")}
              hint={t("trends.trendingHint", { industry: industryPhrase(project.industry) })}
            />
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
        title={t("trends.title")}
        subtitle={t("trends.subtitle", { country: project.country, language: langLabel })}
      />
      <TrendsExplorer
        projectId={project.id}
        initialSearches={searches}
        initialTopics={topics}
      />
    </>
  );
}
