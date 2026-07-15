import { industryPhrase, type PromptCategory } from "../types";

/**
 * Reusable prompt-template infrastructure. Every generated prompt draws on
 * the Project's canonical identity — primary domain first, brand name and
 * other metadata as supporting context.
 *
 * Domain-first anchoring: any prompt that references the brand names the
 * tracked domain ("Acme (acme.com)", "the company whose official website is
 * acme.com") so engines resolve the exact entity even when brand names
 * collide. Discovery prompts (category/informational/local/problem) stay
 * brand-free on purpose — they measure unaided visibility, so anchoring
 * them to the domain would invalidate the measurement.
 */
export interface PromptContext {
  /** Canonical identifier: the tracked domain, e.g. "acme.com". */
  domain: string;
  brand: string;
  /** Normalized industry id (or legacy free text — both phrase cleanly). */
  industry: string;
  country: string;
  language?: string;
  competitors: string[];
}

export interface PromptDraft {
  text: string;
  category: PromptCategory;
}

/** "https://www.acme.com/x" | "acme.com" → "acme.com" (canonical form). */
export function canonicalDomain(website: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

/** "Acme (acme.com)" — the standard brand reference inside prompts. */
function brandRef(ctx: Pick<PromptContext, "brand" | "domain">): string {
  return ctx.domain ? `${ctx.brand} (${ctx.domain})` : ctx.brand;
}

/**
 * Default scan prompt set from onboarding inputs, spread across the seven
 * buyer-intent categories. Users can edit these later.
 */
export function generateDefaultPrompts(ctx: PromptContext): PromptDraft[] {
  const ind = industryPhrase(ctx.industry).trim();
  const loc = ctx.country.trim();
  const ref = brandRef(ctx);

  const prompts: PromptDraft[] = [
    // branded — domain-anchored so engines resolve the exact entity
    { text: `What products and services does ${ctx.domain} provide?`, category: "branded" },
    { text: `Tell me about the company whose official website is ${ctx.domain}. What is it and who is it for?`, category: "branded" },
    { text: `Is ${ref} a good choice for ${ind}?`, category: "branded" },

    // category — "best X" discovery prompts (deliberately brand-free)
    { text: `What are the best ${ind} solutions right now?`, category: "category" },
    { text: `Top ${ind} companies to consider in 2026`, category: "category" },

    // informational — learning-stage questions
    { text: `How do I choose a ${ind} provider? What should I look for?`, category: "informational" },

    // purchase intent — ready-to-buy questions
    { text: `I need a ${ind} provider — what should I choose and why?`, category: "purchase" },
    { text: `Which ${ind} tool would you recommend for a small business?`, category: "purchase" },

    // local intent
    { text: `Best ${ind} options in ${loc}`, category: "local" },

    // problem-solving — pain-first questions
    { text: `My team is struggling with ${ind} — what's the easiest way to solve this?`, category: "problem" },

    // comparison — the tracked domain against its market
    { text: `How does ${ctx.domain} compare with its competitors in ${ind}?`, category: "comparison" },
  ];

  if (ctx.competitors[0]) {
    prompts.push({
      text: `${ref} vs ${ctx.competitors[0]} — which ${ind} option is better?`,
      category: "comparison",
    });
    prompts.push({
      text: `Best alternatives to ${ctx.competitors[0]}`,
      category: "comparison",
    });
  }

  return prompts;
}

/**
 * Template-based prompt suggestions for a user-entered topic ("CRM",
 * "AI SEO", …) — the offline/mock fallback for the Prompt Explorer's
 * AI-generated recommendations. Same buyer-intent spread as the default set.
 */
export function generateTopicPrompts(ctx: PromptContext & { topic: string }): PromptDraft[] {
  const topic = ctx.topic.trim();
  const prompts: PromptDraft[] = [
    { text: `What are the best ${topic} solutions right now?`, category: "category" },
    { text: `Which ${topic} tool would you recommend for a small business?`, category: "purchase" },
    { text: `How do I choose a ${topic} provider? What should I look for?`, category: "informational" },
    { text: `Best ${topic} options in ${ctx.country}`, category: "local" },
    { text: `My team is struggling with ${topic} — what's the easiest way to solve this?`, category: "problem" },
    { text: `Is ${brandRef(ctx)} a good choice for ${topic}?`, category: "branded" },
  ];
  if (ctx.competitors[0]) {
    prompts.push({
      text: `Best alternatives to ${ctx.competitors[0]} for ${topic}`,
      category: "comparison",
    });
  }
  return prompts;
}
