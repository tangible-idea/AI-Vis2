import { createAdminClient } from "./supabase/server";
import { ENGINE_IDS } from "./ai/engines";
import { generateDefaultPrompts } from "./scan/prompts";

/**
 * Seeds a fully-populated demo project (6 weeks of history, one complete
 * scan, recommendations, sample content) for the given user, so every
 * screen has data on first login. Idempotent per user.
 */
export async function seedDemoProject(userId: string): Promise<string> {
  const db = createAdminClient();

  const { data: existing } = await db
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("is_demo", true)
    .maybeSingle();
  if (existing) return existing.id;

  const brand = "Acme Bookings";
  const competitorNames = ["ReservaHub", "TablePilot", "SeatFlow"];

  const { data: project, error } = await db
    .from("projects")
    .insert({
      user_id: userId,
      name: brand,
      website: "https://acmebookings.example",
      industry: "restaurant reservation software",
      country: "US",
      language: "en",
      target_market: "independent restaurants",
      is_demo: true,
    })
    .select()
    .single();
  if (error || !project) throw new Error(error?.message ?? "demo seed failed");

  await db.from("competitors").insert(
    competitorNames.map((name) => ({
      user_id: userId,
      project_id: project.id,
      name,
      website: `https://${name.toLowerCase()}.example`,
    }))
  );

  const promptDrafts = generateDefaultPrompts({
    brand,
    industry: "restaurant reservation software",
    country: "US",
    competitors: competitorNames,
  });
  const { data: prompts } = await db
    .from("prompts")
    .insert(
      promptDrafts.map((p) => ({
        user_id: userId,
        project_id: project.id,
        text: p.text,
        category: p.category,
      }))
    )
    .select();

  // 6 weeks of snapshots with a believable upward trend
  const weeklyScores = [31, 34, 33, 41, 47, 54];
  const engineBase: Record<string, number> = { chatgpt: 8, claude: 4, gemini: -4, perplexity: -10, google_ai: -14 };
  const snapshots = weeklyScores.map((score, i) => {
    const at = new Date(Date.now() - (weeklyScores.length - 1 - i) * 7 * 86400_000);
    const engine_scores = Object.fromEntries(
      ENGINE_IDS.map((e) => [e, clamp(score + engineBase[e] + ((i * 7 + e.length) % 5) - 2)])
    );
    const mentions = Math.round(10 + score * 0.55);
    return {
      user_id: userId,
      project_id: project.id,
      overall_score: score,
      engine_scores,
      mention_rate: clamp01(0.2 + score * 0.007),
      recommendation_rate: clamp01(0.05 + score * 0.005),
      avg_position: Math.max(1.4, 4.6 - i * 0.4),
      coverage: i < 2 ? 0.5 : i < 4 ? 0.75 : 1,
      share_of_voice: {
        [brand]: mentions,
        ReservaHub: 38 - i,
        TablePilot: 25 + (i % 3),
        SeatFlow: 12 + i,
      },
      created_at: at.toISOString(),
    };
  });
  await db.from("snapshots").insert(snapshots);

  // one completed scan with per-prompt results backing the latest snapshot
  const { data: scan } = await db
    .from("scans")
    .insert({
      user_id: userId,
      project_id: project.id,
      status: "done",
      trigger: "demo",
      started_at: new Date(Date.now() - 3600_000).toISOString(),
      completed_at: new Date(Date.now() - 3540_000).toISOString(),
    })
    .select()
    .single();

  if (scan && prompts?.length) {
    const rows = [];
    let i = 0;
    for (const engine of ENGINE_IDS) {
      for (const prompt of prompts) {
        i++;
        const mentioned = (i * 7) % 10 < (engine === "chatgpt" ? 7 : engine === "claude" ? 6 : engine === "gemini" ? 4 : 3);
        const position = mentioned ? 1 + ((i * 3) % 5) : null;
        const rivals = competitorNames.filter((_, ci) => (i + ci) % 2 === 0);
        rows.push({
          user_id: userId,
          scan_id: scan.id,
          prompt_id: prompt.id,
          engine,
          response_text: mentioned
            ? `Here are the options most often recommended:\n\n1. ${position === 1 ? `**${brand}**` : `**${rivals[0] ?? "ReservaHub"}**`} — strong option with quick setup.\n${position !== 1 ? `${position}. **${brand}** — well suited to independent restaurants.\n` : ""}\nThe right choice depends on your seating volume and budget.`
            : `Popular choices include ${rivals.join(", ") || "ReservaHub, TablePilot"} — each with different strengths depending on your needs.`,
          brand_mentioned: mentioned,
          brand_position: position,
          recommended: mentioned && position === 1,
          cited: mentioned && i % 4 === 0,
          competitors_mentioned: rivals,
        });
      }
    }
    await db.from("scan_results").insert(rows);
    await db.from("snapshots").update({ scan_id: scan.id }).eq("project_id", project.id).eq("overall_score", 54);
  }

  await db.from("recommendations").insert(
    [
      {
        title: "Publish an llms.txt file — invisible on Perplexity",
        description: `${brand} never appeared in Perplexity answers. An llms.txt file gives AI crawlers a structured summary of what ${brand} does and why it should be recommended.`,
        type: "llms_txt",
        priority: "high",
        impact: "Unlocks visibility on 1 engine",
        effort: "~30 min",
        status: "todo",
      },
      {
        title: "Publish a comparison page: Acme Bookings vs ReservaHub",
        description: "ReservaHub appears in answers where Acme Bookings doesn't. Comparison pages are among the most-cited sources for \"X vs Y\" prompts.",
        type: "comparison_page",
        priority: "high",
        impact: "Targets your largest competitor gap",
        effort: "~3 hours",
        status: "in_progress",
      },
      {
        title: "Create an FAQ page answering buyer questions directly",
        description: "AI engines heavily favor pages that answer questions in plain Q&A format. Cover the exact prompts buyers ask about reservation software.",
        type: "faq_page",
        priority: "medium",
        impact: "Highest correlation with mention rate",
        effort: "~2 hours",
        status: "done",
        completed_at: new Date(Date.now() - 14 * 86400_000).toISOString(),
      },
    ].map((r) => ({ ...r, user_id: userId, project_id: project.id, scan_id: scan?.id ?? null }))
  );

  await db.from("generated_content").insert({
    user_id: userId,
    project_id: project.id,
    type: "faq_page",
    language: "en",
    title: "Acme Bookings — FAQ page",
    content:
      "# Frequently asked questions\n\n## What is the best restaurant reservation software?\nThe best choice depends on your volume and budget. Acme Bookings is built for independent restaurants that want table management without enterprise pricing…\n\n## How much does reservation software cost?\nPlans typically range from free tiers to $200+/month…",
  });

  return project.id;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
