import type { Project, RecommendationType } from "../types";
import { CONTENT_LANGUAGES } from "../types";
import type { ChatMessage } from "../ai/provider";

/**
 * Everything the generator can produce. Recommendation types map 1:1 to
 * generator types; a few extra types exist only as generated content
 * (social posts, executive summaries) and are never stored as
 * recommendations.
 */
export type ContentType = RecommendationType | "social_post" | "exec_summary";

export const CONTENT_TYPES: { id: ContentType; label: string; blurb: string }[] = [
  { id: "faq_page", label: "FAQ page", blurb: "Q&A page targeting the exact questions buyers ask AI" },
  { id: "blog_post", label: "Blog post", blurb: "Authority article engines cite in answers" },
  { id: "comparison_page", label: "Comparison page", blurb: "You vs a competitor, honest and structured" },
  { id: "category_page", label: "Category page", blurb: "\"Best X\" landing page for your category" },
  { id: "location_page", label: "Location page", blurb: "Local landing page for your market" },
  { id: "schema", label: "Schema (JSON-LD)", blurb: "Organization / Product / FAQ structured data" },
  { id: "llms_txt", label: "llms.txt", blurb: "Structured brand summary for AI crawlers" },
  { id: "metadata", label: "Metadata", blurb: "Title + description rewrites for key pages" },
  { id: "internal_links", label: "Internal links", blurb: "Linking plan that concentrates authority" },
  { id: "social_post", label: "Social post", blurb: "LinkedIn/X post that puts your brand in the conversation" },
  { id: "exec_summary", label: "Executive summary", blurb: "One-page briefing on your AI visibility for stakeholders" },
];

interface BuildInput {
  project: Project;
  competitors: string[];
  type: ContentType;
  language: string;
  instructions?: string;
}

export function buildContentMessages(input: BuildInput): ChatMessage[] {
  const { project, competitors, type, language, instructions } = input;
  const langLabel = CONTENT_LANGUAGES.find((l) => l.code === language)?.label ?? "English";

  const system = [
    `You are an expert in AI search optimization (AEO/GEO) — making brands visible in answers from ChatGPT, Claude, Gemini and Perplexity.`,
    `Write production-ready content. No preamble, no "here is" — output the deliverable only, in Markdown (or raw code where the format demands it).`,
    `Context — brand: "${project.name}", website: ${project.website}, industry: ${project.industry}, country: ${project.country}, target market: ${project.target_market || "general"}.`,
    competitors.length ? `Competitors: ${competitors.join(", ")}.` : "",
    `Write in ${langLabel}. Keep facts generic enough to be safe (no invented statistics or customer names).`,
  ]
    .filter(Boolean)
    .join("\n");

  const asks: Record<ContentType, string> = {
    faq_page: `Write a complete FAQ page for ${project.name} with 8–10 questions real buyers ask AI assistants about ${project.industry} (e.g. "What is the best ${project.industry} solution?"). Answer each in 2–4 sentences, naming ${project.name} naturally where honest. End with an FAQPage JSON-LD block wrapping the same Q&As.`,
    blog_post: `Write a 900–1200 word authority blog post: "How to choose the right ${project.industry} solution". Use clear H2/H3 structure, a comparison criteria checklist, and position ${project.name} honestly among the options. Add a TL;DR at the top — AI engines lift these.`,
    comparison_page: `Write a comparison page: "${project.name} vs ${competitors[0] ?? "alternatives"}". Include a feature comparison table, "who should choose which" section, and an honest verdict. Structured, scannable, citation-friendly.`,
    category_page: `Write a "Best ${project.industry} solutions" category page listing 5–6 options including ${project.name}${competitors.length ? ` and ${competitors.slice(0, 2).join(", ")}` : ""}, each with a 2–3 sentence balanced blurb, followed by a buying guide section.`,
    location_page: `Write a location landing page: "${project.industry} in ${project.country}" for ${project.name}. Cover local relevance, who it serves in that market, and a local FAQ (4 questions).`,
    schema: `Output JSON-LD structured data for ${project.name}: an Organization block, a Product/Service block for its ${project.industry} offering, and an FAQPage block with 4 sample Q&As. Output only the <script type="application/ld+json"> blocks, ready to paste.`,
    llms_txt: `Output a complete llms.txt file for ${project.website}. Follow the llms.txt convention: H1 with brand name, blockquote one-line summary, then sections (## About, ## Products, ## Who it's for, ## Comparisons, ## Docs) with markdown links and one-line descriptions. Output only the file contents.`,
    metadata: `Write optimized metadata for ${project.name}'s 5 key pages (home, product, pricing, about, blog): for each give <title> (≤60 chars) and meta description (≤155 chars) that state plainly what ${project.name} is and for whom — phrasing AI engines lift into answers.`,
    internal_links: `Produce an internal linking plan for ${project.website} that concentrates topical authority on ${project.industry}: list 8–10 concrete link placements (from page → to page, suggested anchor text) and a short rationale for each.`,
    social_post: `Write 3 variants of a short LinkedIn post for ${project.name} about ${project.industry} — one thought-leadership angle, one practical-tips angle, one trend-reaction angle. Each ≤120 words, no hashtag spam (max 3), written to earn genuine engagement in ${project.country}.`,
    exec_summary: `Write a one-page executive summary of ${project.name}'s AI search visibility for non-technical stakeholders: where the brand stands across ChatGPT, Claude, Gemini, Perplexity and Google AI Overview, what changed recently, and the top 3 next actions. Use the metrics provided in the additional instructions verbatim; do not invent numbers. Plain business language, short paragraphs, one bullet list.`,
  };

  const user = [asks[type], instructions ? `\nAdditional instructions: ${instructions}` : ""].join("");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
