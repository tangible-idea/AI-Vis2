import { createHash } from "crypto";
import { createAdminClient } from "../supabase/server";
import { completeWithRetry, getProvider, isMockMode, type ChatMessage } from "../ai/provider";
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
 * Identical prompts asked to the same engine for the same market/language
 * within this window reuse the cached answer instead of a new provider
 * call — deduplicating across organizations, projects and scheduled runs.
 */
const RESPONSE_CACHE_HOURS = 24;

/** Stable identity for a prompt across customers: whitespace/case-insensitive. */
export function promptHash(text: string): string {
  return createHash("sha256").update(text.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
}

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
    if (project.archived_at) throw new Error("Project is archived — restore it to run scans");
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

    // mock answers embed this project's context, so they're never shareable;
    // only real provider responses enter the cross-customer cache
    const cacheable = !isMockMode();
    const cacheCutoff = new Date(Date.now() - RESPONSE_CACHE_HOURS * 3_600_000).toISOString();

    await mapLimit(jobs, CONCURRENCY, async (job) => {
      const hash = promptHash(job.prompt.text);

      let text = "";
      if (cacheable) {
        const { data: cached } = await db
          .from("ai_responses")
          .select("response_text")
          .eq("prompt_hash", hash)
          .eq("engine", job.engine)
          .eq("country", project.country)
          .eq("language", project.language)
          .gte("created_at", cacheCutoff)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cached) text = cached.response_text;
      }

      if (!text) {
        const messages: ChatMessage[] = [
          { role: "system", content: SCAN_SYSTEM_PROMPT },
          ...(isMockMode() ? [mockContextMessage(project.name, competitorNames)] : []),
          { role: "user", content: job.prompt.text },
        ];
        try {
          text = await completeWithRetry(provider, job.model, messages);
        } catch (err) {
          console.error(`[scan] ${job.engine} failed for "${job.prompt.text}":`, err);
          done++;
          return; // one failed call shouldn't sink the scan
        }
        if (cacheable && text) {
          await db.from("ai_responses").insert({
            prompt_hash: hash,
            prompt_text: job.prompt.text,
            engine: job.engine,
            model: job.model,
            country: project.country,
            language: project.language,
            response_text: text,
          });
        }
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

    // anonymous prompt observations — the normalized metadata layer future
    // market benchmarks aggregate over. No user/org/project identity, and
    // best-effort: an insert failure never sinks the scan.
    if (cacheable && !project.is_demo) {
      const promptById = new Map(prompts.map((p) => [p.id, p as Prompt]));
      const { error: obsError } = await db.from("prompt_observations").insert(
        rows.map((r) => ({
          prompt_hash: promptHash(promptById.get(r.prompt_id)?.text ?? ""),
          intent: promptById.get(r.prompt_id)?.category ?? "custom",
          country: project.country,
          language: project.language,
          industry: project.industry,
          engine: r.engine,
          brand_mentioned: r.brand_mentioned,
          competitor_mentioned: r.competitors_mentioned.length > 0,
          cited: r.cited,
          source_domains: r.sources.map((s) => s.domain),
        }))
      );
      if (obsError) console.error("[scan] observation insert failed:", obsError.message);
    }

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
