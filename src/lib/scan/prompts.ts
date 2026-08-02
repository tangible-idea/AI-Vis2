import { brandRef, type BrandContext } from "../brand";
import type { PromptCategory } from "../types";

/**
 * Reusable prompt-template infrastructure. Every generated prompt draws on the
 * shared Brand Context — primary domain first, brand name and other metadata as
 * supporting context. There is no separate prompt-side notion of the brand.
 *
 * Domain-first anchoring: any prompt that references the brand names the
 * tracked domain ("Acme (acme.com)", "the company whose official website is
 * acme.com") so engines resolve the exact entity even when brand names
 * collide. Discovery prompts (category/informational/local/problem) stay
 * brand-free on purpose — they measure unaided visibility, so anchoring
 * them to the domain would invalidate the measurement.
 */

export interface PromptDraft {
  text: string;
  category: PromptCategory;
}

export { canonicalDomain } from "../brand";

/** "acme.com" for web projects; the store listing for app projects. */
function identity(ctx: BrandContext): string {
  if (ctx.domain) return ctx.domain;
  if (ctx.app) return `${ctx.brand} on the ${ctx.app.platform === "ios" ? "iOS App Store" : "Google Play Store"}`;
  return ctx.brand;
}

/**
 * Default scan prompt set from the Brand Context, spread across the seven
 * buyer-intent categories. Users can edit these later.
 */
export function generateDefaultPrompts(ctx: BrandContext): PromptDraft[] {
  const ind = ctx.industryPhrase;
  const loc = ctx.market.trim();
  const ref = brandRef(ctx);
  const id = identity(ctx);

  const prompts: PromptDraft[] = [
    // branded — domain-anchored so engines resolve the exact entity
    { text: `What products and services does ${id} provide?`, category: "branded" },
    { text: ctx.domain
        ? `Tell me about the company whose official website is ${ctx.domain}. What is it and who is it for?`
        : `Tell me about ${id}. What is it and who is it for?`,
      category: "branded" },
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

    // comparison — the tracked identity against its market
    { text: `How does ${id} compare with its competitors in ${ind}?`, category: "comparison" },
  ];

  const rival = ctx.competitors[0]?.name;
  if (rival) {
    prompts.push({
      text: `${ref} vs ${rival} — which ${ind} option is better?`,
      category: "comparison",
    });
    prompts.push({
      text: `Best alternatives to ${rival}`,
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
export function generateTopicPrompts(ctx: BrandContext, topicInput: string): PromptDraft[] {
  const topic = topicInput.trim();
  const prompts: PromptDraft[] = [
    { text: `What are the best ${topic} solutions right now?`, category: "category" },
    { text: `Which ${topic} tool would you recommend for a small business?`, category: "purchase" },
    { text: `How do I choose a ${topic} provider? What should I look for?`, category: "informational" },
    { text: `Best ${topic} options in ${ctx.market}`, category: "local" },
    { text: `My team is struggling with ${topic} — what's the easiest way to solve this?`, category: "problem" },
    { text: `Is ${brandRef(ctx)} a good choice for ${topic}?`, category: "branded" },
  ];
  const rival = ctx.competitors[0]?.name;
  if (rival) {
    prompts.push({
      text: `Best alternatives to ${rival} for ${topic}`,
      category: "comparison",
    });
  }
  return prompts;
}
