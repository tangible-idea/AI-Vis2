import type { Engine, RecommendationType } from "../types";
import { engineInfo } from "../ai/engines";
import type { ScoreBreakdown } from "../scan/scoring";
import type { ResultRow } from "../scan/scoring";

export interface RecommendationDraft {
  title: string;
  description: string;
  type: RecommendationType;
  priority: "high" | "medium" | "low";
  impact: string;
  effort: string;
}

interface Ctx {
  brand: string;
  industry: string;
  competitors: string[];
  engines: Engine[];
}

/**
 * Gap-based recommendation engine: turns a scan's score breakdown into
 * concrete, prioritized actions. Pure function — reused by the scan
 * pipeline and the demo seeder.
 */
export function deriveRecommendations(
  scores: ScoreBreakdown,
  results: ResultRow[],
  ctx: Ctx
): RecommendationDraft[] {
  const recs: RecommendationDraft[] = [];
  const { brand, industry, competitors } = ctx;

  // engines where the brand is invisible
  const darkEngines = ctx.engines.filter(
    (e) => !results.some((r) => r.engine === e && r.brand_mentioned)
  );
  if (darkEngines.length) {
    const names = darkEngines.map((e) => engineInfo(e).label).join(", ");
    recs.push({
      title: `Publish an llms.txt file — invisible on ${names}`,
      description: `${brand} never appeared in answers from ${names}. An llms.txt file gives AI crawlers a structured summary of what ${brand} does, who it serves, and why it should be recommended.`,
      type: "llms_txt",
      priority: "high",
      impact: `Unlocks visibility on ${darkEngines.length} engine${darkEngines.length > 1 ? "s" : ""}`,
      effort: "~30 min",
    });
  }

  if (scores.mentionRate < 0.5) {
    recs.push({
      title: `Create an FAQ page answering buyer questions directly`,
      description: `${brand} was mentioned in only ${Math.round(scores.mentionRate * 100)}% of answers. AI engines heavily favor pages that answer questions in plain Q&A format. Cover the exact prompts buyers ask about ${industry}.`,
      type: "faq_page",
      priority: "high",
      impact: "Highest correlation with mention rate",
      effort: "~2 hours",
    });
  }

  const rivals = competitors.filter((c) =>
    results.some((r) => r.competitors_mentioned.includes(c) && !r.brand_mentioned)
  );
  if (rivals.length) {
    recs.push({
      title: `Publish a comparison page: ${brand} vs ${rivals[0]}`,
      description: `${rivals[0]} appears in answers where ${brand} doesn't. Comparison pages are among the most-cited sources when AI answers "X vs Y" and "best alternatives" prompts.`,
      type: "comparison_page",
      priority: "high",
      impact: `Targets ${rivals.length} competitor gap${rivals.length > 1 ? "s" : ""}`,
      effort: "~3 hours",
    });
  }

  if (scores.recommendationRate < 0.3) {
    recs.push({
      title: "Add Organization + Product schema (JSON-LD)",
      description: `Structured data helps engines understand and trust ${brand}'s offering, moving mentions from "listed" to "recommended". Add Organization, Product and FAQPage schema to key pages.`,
      type: "schema",
      priority: "medium",
      impact: "Improves recommendation framing",
      effort: "~1 hour",
    });
  }

  if (scores.avgPosition !== null && scores.avgPosition > 3) {
    recs.push({
      title: "Publish authority content to climb list rankings",
      description: `When ${brand} is mentioned it averages position ${scores.avgPosition.toFixed(1)}. In-depth guides and original data on ${industry} give engines reasons to rank ${brand} earlier.`,
      type: "blog_post",
      priority: "medium",
      impact: "Moves average list position up",
      effort: "~4 hours",
    });
  }

  recs.push({
    title: "Refresh homepage metadata for AI answers",
    description: `Rewrite the title and meta description to state plainly what ${brand} is, for whom, and its category ("${industry}") — the phrasing engines lift into answers.`,
    type: "metadata",
    priority: recs.length > 3 ? "low" : "medium",
    impact: "Sharper positioning in answers",
    effort: "~20 min",
  });

  return recs.slice(0, 6);
}
