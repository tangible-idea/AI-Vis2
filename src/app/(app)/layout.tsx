import { getAppContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { isMockMode } from "@/lib/ai/provider";
import { Sidebar } from "@/components/sidebar";
import { AssistantWidget } from "@/components/assistant";
import { MarketTabs } from "@/components/market-tabs";
import { LanguageSelector, SyncLanguage } from "@/components/language-selector";
import type { SwitcherProject } from "@/components/project-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { projects, project, profile } = await getAppContext();
  const limits = planLimits(profile.plan);

  // latest score + scan date per project for the switcher (one query, newest first)
  const supabase = await createClient();
  const { data: snapshotRows } = projects.length
    ? await supabase
        .from("snapshots")
        .select("project_id, overall_score, created_at")
        .in("project_id", projects.map((p) => p.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const latestByProject = new Map<string, { overall_score: number; created_at: string }>();
  for (const s of snapshotRows ?? []) {
    if (!latestByProject.has(s.project_id)) latestByProject.set(s.project_id, s);
  }

  const switcherProjects: SwitcherProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    website: p.website,
    country: p.country,
    is_demo: p.is_demo,
    logo_url: p.logo_url,
    score: latestByProject.get(p.id)?.overall_score ?? null,
    lastScanAt: latestByProject.get(p.id)?.created_at ?? null,
  }));

  const activeCount = projects.filter((p) => !p.is_demo).length;

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
        switcherProjects={switcherProjects}
        activeProjectId={project?.id ?? null}
        plan={profile.plan}
        planLabel={limits.label}
        maxProjects={limits.maxProjects}
        canCreate={activeCount < limits.maxProjects}
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
