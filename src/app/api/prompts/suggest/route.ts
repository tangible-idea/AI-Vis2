import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProvider, isMockMode } from "@/lib/ai/provider";
import { WORKHORSE_MODEL } from "@/lib/ai/engines";
import { generateTopicPrompts } from "@/lib/scan/prompts";
import { promptHash } from "@/lib/scan/runner";
import { PROMPT_CATEGORIES, type PromptCategory } from "@/lib/types";

export const maxDuration = 60;

const MAX_SUGGESTIONS = 8;

/**
 * POST { projectId, topic } → recommended scan prompts for a topic.
 * Suggestions are drafts only — nothing is monitored until the user accepts
 * them in the Prompt Explorer. Uses the workhorse model when available,
 * falling back to buyer-intent templates (also the mock-mode path). Prompts
 * the project already tracks are filtered out.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, topic: rawTopic } = (await request.json()) as {
    projectId?: string;
    topic?: string;
  };
  const topic = String(rawTopic ?? "").trim().slice(0, 80);
  if (!projectId || !topic) {
    return NextResponse.json({ error: "projectId and topic required" }, { status: 400 });
  }

  const [{ data: project }, { data: existing }, { data: competitors }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("prompts").select("text").eq("project_id", projectId),
    supabase.from("competitors").select("name").eq("project_id", projectId).order("position"),
  ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const competitorNames = (competitors ?? []).map((c) => c.name);
  let suggestions = isMockMode()
    ? null
    : await generateWithModel(topic, project.name, project.country, competitorNames);
  if (!suggestions?.length) {
    suggestions = generateTopicPrompts({
      topic,
      brand: project.name,
      country: project.country,
      competitors: competitorNames,
    });
  }

  // never suggest a prompt the project already tracks (whitespace/case-insensitive)
  const seen = new Set((existing ?? []).map((p) => promptHash(p.text)));
  const fresh = suggestions.filter((s) => {
    const h = promptHash(s.text);
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  });

  return NextResponse.json({ suggestions: fresh.slice(0, MAX_SUGGESTIONS) });
}

const VALID_CATEGORIES = new Set(PROMPT_CATEGORIES.map((c) => c.id));

async function generateWithModel(
  topic: string,
  brand: string,
  country: string,
  competitors: string[]
): Promise<{ text: string; category: PromptCategory }[] | null> {
  try {
    const raw = await getProvider().complete(WORKHORSE_MODEL, [
      {
        role: "system",
        content:
          "You generate the exact questions real buyers ask AI assistants (ChatGPT, Claude, Gemini, Perplexity) when researching a topic. Respond with a JSON array only — no prose, no code fences.",
      },
      {
        role: "user",
        content: [
          `Topic: ${topic}`,
          `Market: ${country}`,
          `Brand being monitored: ${brand}`,
          competitors.length ? `Known competitors: ${competitors.join(", ")}` : "",
          "",
          `Write ${MAX_SUGGESTIONS} short, natural buyer questions about this topic. Spread them across intents: category discovery ("best X"), purchase, informational, comparison, local (${country}), and problem-solving. Do not mention the monitored brand except in at most one branded question.`,
          `Return JSON: [{"text": "...", "category": "branded|category|informational|comparison|purchase|local|problem"}]`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ]);

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { text?: unknown; category?: unknown }[];
    const items = parsed
      .filter((p) => typeof p.text === "string" && (p.text as string).trim().length > 8)
      .map((p) => ({
        text: (p.text as string).trim().slice(0, 200),
        category: (VALID_CATEGORIES.has(p.category as PromptCategory)
          ? p.category
          : "category") as PromptCategory,
      }));
    return items.length ? items : null;
  } catch (err) {
    console.error("[prompts/suggest] model generation failed:", err);
    return null; // template fallback keeps the feature working
  }
}
