import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";
import { CONTENT_LANGUAGES, type GeneratedContent, type Recommendation } from "@/lib/types";
import { OptimizeClient } from "./optimize-client";

export const metadata = { title: "Optimize" };

export default async function OptimizePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; topic?: string }>;
}) {
  const { project } = await requireProject();
  const supabase = await createClient();
  const { type: prefillType, topic: prefillTopic } = await searchParams;

  const [{ data: recs }, { data: library }] = await Promise.all([
    supabase
      .from("recommendations")
      .select("*")
      .eq("project_id", project.id)
      .order("status")
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_content")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <PageHeader
        title="Optimize"
        subtitle="Ready-to-publish assets, not generic advice"
      />

      <OptimizeClient
        projectId={project.id}
        recommendations={(recs ?? []) as Recommendation[]}
        prefillType={prefillType}
        prefillTopic={prefillTopic}
      />

      {(library ?? []).length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Content library" hint="Everything you've generated and saved" />
          <div className="divide-y divide-line px-5 pb-4">
            {(library as GeneratedContent[]).map((c) => (
              <details key={c.id} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex-1 text-sm text-ink">{c.title || c.type}</span>
                  <Badge tone="neutral">
                    {CONTENT_LANGUAGES.find((l) => l.code === c.language)?.label ?? c.language}
                  </Badge>
                  <span className="text-xs text-ink-faint">{formatDate(c.created_at)}</span>
                  <span className="text-xs text-ink-faint transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-paper p-4 font-sans text-[13px] leading-relaxed text-ink">
                  {c.content}
                </pre>
              </details>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
