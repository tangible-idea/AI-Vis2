import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { PromptExplorer } from "./explorer";
import type { Prompt } from "@/lib/types";

export const metadata = { title: "Prompt Explorer" };

export default async function PromptsPage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);
  const t = await getT();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at");
  const promptList = (prompts ?? []) as Prompt[];
  const activeCount = promptList.filter((p) => p.is_active).length;

  return (
    <>
      <PageHeader
        title={t("promptExplorer.title")}
        subtitle={t("promptExplorer.subtitle", {
          count: activeCount,
          max: limits.maxPrompts,
          plan: limits.label,
        })}
      />
      <PromptExplorer
        projectId={project.id}
        prompts={promptList}
        maxPrompts={limits.maxPrompts}
      />
    </>
  );
}
