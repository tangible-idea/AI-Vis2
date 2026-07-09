import { getAppContext } from "@/lib/project";
import { isMockMode } from "@/lib/ai/provider";
import { Sidebar } from "@/components/sidebar";
import { AssistantWidget } from "@/components/assistant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { projects, project, profile } = await getAppContext();

  return (
    <div className="min-h-screen">
      <Sidebar
        projects={projects}
        activeProjectId={project?.id ?? null}
        plan={profile.plan}
        mockMode={isMockMode()}
      />
      <main className="px-4 pb-24 pt-6 md:ml-56 md:px-8 md:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <AssistantWidget projectId={project?.id ?? null} projectName={project?.name ?? null} />
    </div>
  );
}
