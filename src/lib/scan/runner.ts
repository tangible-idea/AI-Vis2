import { createAdminClient } from "../supabase/server";
import { getProvider, isMockMode, type ChatMessage } from "../ai/provider";
import { ENGINES } from "../ai/engines";
import { mockContextMessage } from "../ai/mock";
import { analyzeResponse } from "./analyzer";
import { computeScores, type ResultRow } from "./scoring";
import { deriveRecommendations } from "../recommendations";
import type { Engine, Prompt } from "../types";

const SCAN_SYSTEM_PROMPT =
  "You are a helpful assistant. Answer the user's question the way you normally would, naming specific products, companies or services where relevant.";

const CONCURRENCY = 6;

/**
 * Executes a scan end-to-end: queries every engine with every active prompt,
 * analyzes responses, stores results, snapshots scores and refreshes
 * recommendations. Designed to run inside a single serverless invocation.
 */
export async function runScan(scanId: string): Promise<void> {
  const db = createAdminClient();

  const { data: scan } = await db.from("scans").select("*").eq("id", scanId).single();
  if (!scan || scan.status === "done") return;

  await db
    .from("scans")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", scanId);

  try {
    const [{ data: project }, { data: competitors }, { data: prompts }] = await Promise.all([
      db.from("projects").select("*").eq("id", scan.project_id).single(),
      db.from("competitors").select("*").eq("project_id", scan.project_id),
      db
        .from("prompts")
        .select("*")
        .eq("project_id", scan.project_id)
        .eq("is_active", true)
        .order("created_at"),
    ]);
    if (!project) throw new Error("Project not found");
    if (!prompts?.length) throw new Error("No active prompts to scan");

    const competitorNames = (competitors ?? []).map((c) => c.name);
    const competitorWebsites = (competitors ?? []).map((c) => c.website);
    const provider = getProvider();

    const jobs: { engine: Engine; model: string; prompt: Prompt }[] = [];
    for (const engine of ENGINES) {
      for (const prompt of prompts) {
        jobs.push({ engine: engine.id, model: engine.poeModel, prompt });
      }
    }

    const rows: (ResultRow & { prompt_id: string; response_text: string })[] = [];

    // live progress for the scan-transparency UI (throttled writes)
    let done = 0;
    let lastReported = 0;
    const reportProgress = async (engine: Engine, force = false) => {
      if (!force && done - lastReported < 4) return;
      lastReported = done;
      await db
        .from("scans")
        .update({ progress: { done, total: jobs.length, engine } })
        .eq("id", scanId);
    };
    await reportProgress(jobs[0].engine, true);

    await mapLimit(jobs, CONCURRENCY, async (job) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SCAN_SYSTEM_PROMPT },
        ...(isMockMode() ? [mockContextMessage(project.name, competitorNames)] : []),
        { role: "user", content: job.prompt.text },
      ];

      let text = "";
      try {
        text = await provider.complete(job.model, messages);
      } catch (err) {
        console.error(`[scan] ${job.engine} failed for "${job.prompt.text}":`, err);
        done++;
        return; // one failed call shouldn't sink the scan
      }

      const analyzed = analyzeResponse(text, project.name, competitorNames, {
        brandWebsite: project.website,
        competitorWebsites,
      });
      rows.push({
        engine: job.engine,
        prompt_id: job.prompt.id,
        response_text: text,
        ...analyzed,
      });
      done++;
      await reportProgress(job.engine);
    });

    if (!rows.length) throw new Error("All engine calls failed");

    await db.from("scan_results").insert(
      rows.map((r) => ({
        user_id: scan.user_id,
        scan_id: scanId,
        prompt_id: r.prompt_id,
        engine: r.engine,
        response_text: r.response_text,
        brand_mentioned: r.brand_mentioned,
        brand_position: r.brand_position,
        recommended: r.recommended,
        cited: r.cited,
        competitors_mentioned: r.competitors_mentioned,
        sources: r.sources,
      }))
    );

    const engineIds = ENGINES.map((e) => e.id);
    const scores = computeScores(rows, project.name, competitorNames, engineIds);

    await db.from("snapshots").insert({
      user_id: scan.user_id,
      project_id: scan.project_id,
      scan_id: scanId,
      overall_score: scores.overall,
      engine_scores: scores.engineScores,
      mention_rate: scores.mentionRate,
      recommendation_rate: scores.recommendationRate,
      avg_position: scores.avgPosition,
      coverage: scores.coverage,
      share_of_voice: scores.shareOfVoice,
    });

    // refresh open scan-derived recommendations with the latest picture
    const drafts = deriveRecommendations(scores, rows, {
      brand: project.name,
      industry: project.industry,
      competitors: competitorNames,
      engines: engineIds,
    });
    await db
      .from("recommendations")
      .delete()
      .eq("project_id", scan.project_id)
      .eq("status", "todo")
      .not("scan_id", "is", null);
    if (drafts.length) {
      await db.from("recommendations").insert(
        drafts.map((d) => ({
          user_id: scan.user_id,
          project_id: scan.project_id,
          scan_id: scanId,
          ...d,
        }))
      );
    }

    await db
      .from("scans")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", scanId);
  } catch (err) {
    console.error("[scan] failed:", err);
    await db
      .from("scans")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanId);
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.all(workers);
}
