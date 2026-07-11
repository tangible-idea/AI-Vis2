import { getAppContext } from "@/lib/project";
import { isMockMode } from "@/lib/ai/provider";
import { Sidebar } from "@/components/sidebar";
import { AssistantWidget } from "@/components/assistant";
import { MarketTabs } from "@/components/market-tabs";
import { LanguageSelector, SyncLanguage } from "@/components/language-selector";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { projects, project, profile } = await getAppContext();

  // sibling market views: same brand website, one project per country
  const markets = project
    ? projects
        .filter((p) => p.website === project.website && p.is_demo === project.is_demo)
        .map((p) => ({ id: p.id, country: p.country }))
    : [];

  return (
    <div className="min-h-screen">
      <Sidebar
        projects={projects}
        activeProjectId={project?.id ?? null}
        plan={profile.plan}
        mockMode={isMockMode()}
      />
      <main className="px-4 pb-24 pt-6 md:ml-56 md:px-8 md:pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="no-print mb-4 flex flex-wrap items-start justify-between gap-3">
            {project ? <MarketTabs markets={markets} activeId={project.id} /> : <span />}
            <LanguageSelector />
          </div>
          {children}
        </div>
      </main>
      <AssistantWidget projectId={project?.id ?? null} projectName={project?.name ?? null} />
      <SyncLanguage profileLanguage={profile.ui_language ?? null} />
    </div>
  );
}
