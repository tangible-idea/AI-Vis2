import { NextResponse } from "next/server";
import { industryPhrase } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getGenerationProvider, type ChatMessage } from "@/lib/ai/provider";
import { WORKHORSE_MODEL, engineInfo } from "@/lib/ai/engines";

export const maxDuration = 60;

/**
 * POST { projectId, page, messages: [{role, content}] }
 * Streams an assistant reply grounded in the project's latest scan.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, page, messages } = (await request.json()) as {
    projectId?: string;
    page?: string;
    messages: ChatMessage[];
  };

  let context = "The user has not created a project yet.";
  if (projectId) {
    const [{ data: project }, { data: snapshot }, { data: recs }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("snapshots")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("recommendations")
        .select("title, priority, status")
        .eq("project_id", projectId)
        .eq("status", "todo")
        .limit(5),
    ]);

    if (project) {
      const engineLine = snapshot
        ? Object.entries(snapshot.engine_scores as Record<string, number>)
            .map(([e, s]) => `${engineInfo(e).label} ${s}`)
            .join(", ")
        : "no scan yet";
      context = [
        `Project: ${project.name} (${project.website}) — ${industryPhrase(project.industry)}, ${project.country}.`,
        snapshot
          ? `Latest scan — Visibility Score ${snapshot.overall_score}/100. Engine scores: ${engineLine}. Mention rate ${Math.round(snapshot.mention_rate * 100)}%, recommendation rate ${Math.round(snapshot.recommendation_rate * 100)}%, avg position ${snapshot.avg_position?.toFixed(1) ?? "n/a"}.`
          : "No scans have run yet.",
        recs?.length
          ? `Open recommendations: ${recs.map((r) => `${r.title} (${r.priority})`).join("; ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const system: ChatMessage = {
    role: "system",
    content: [
      "You are Sightline's AI copilot, embedded in an AI-visibility analytics product. You help users understand their scores, compare against competitors, and decide what to do next.",
      "Be concise and concrete. Use short paragraphs or tight bullet lists. When suggesting actions, reference the product's own features (running scans on Monitor, generating content on Optimize, tracking progress on Improve).",
      `The user is currently on the "${page ?? "app"}" page.`,
      `\n--- Project context ---\n${context}`,
    ].join("\n"),
  };

  const provider = getGenerationProvider();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of provider.stream(WORKHORSE_MODEL, [system, ...messages.slice(-12)])) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`Sorry — I hit an error: ${err instanceof Error ? err.message : "unknown"}`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
