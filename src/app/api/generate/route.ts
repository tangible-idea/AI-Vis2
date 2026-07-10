import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/ai/provider";
import { WORKHORSE_MODEL } from "@/lib/ai/engines";
import { buildContentMessages, CONTENT_TYPES, type ContentType } from "@/lib/content/templates";
import { planLimits } from "@/lib/plans";

export const maxDuration = 120;

/**
 * POST { projectId, type, language, instructions?, recommendationId?, save? }
 * Streams generated content as plain text. When `save` metadata arrives via
 * a follow-up POST to /api/generate/save, content is persisted.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, type, language = "en", instructions } = body as {
    projectId: string;
    type: ContentType;
    language?: string;
    instructions?: string;
  };
  if (!CONTENT_TYPES.some((t) => t.id === type)) {
    return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
  }

  const [{ data: project }, { data: competitors }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("competitors").select("name").eq("project_id", projectId),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // plan gating: generations this month
  const limits = planLimits(profile?.plan);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("generated_content")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());
  if ((count ?? 0) >= limits.contentGenerations) {
    return NextResponse.json(
      { error: `Your ${limits.label} plan includes ${limits.contentGenerations} generations per month. Upgrade for more.`, code: "limit" },
      { status: 403 }
    );
  }

  const messages = buildContentMessages({
    project,
    competitors: (competitors ?? []).map((c) => c.name),
    type,
    language,
    instructions,
  });

  const provider = getProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of provider.stream(WORKHORSE_MODEL, messages)) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[Generation failed: ${err instanceof Error ? err.message : "unknown error"}]`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
