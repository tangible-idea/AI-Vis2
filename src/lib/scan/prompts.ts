import type { PromptCategory } from "../types";

interface PromptSeedInput {
  industry: string;
  country: string;
  targetMarket?: string | null;
  competitors: string[];
  brand: string;
}

/**
 * Generates the default scan prompt set from onboarding inputs — the
 * questions real buyers ask AI assistants, spread across the seven
 * buyer-intent categories. Users can edit these later.
 */
export function generateDefaultPrompts(input: PromptSeedInput): { text: string; category: PromptCategory }[] {
  const { industry, country, competitors, brand } = input;
  const ind = industry.trim();
  const loc = country.trim();

  const prompts: { text: string; category: PromptCategory }[] = [
    // branded — how engines talk about the brand itself
    { text: `Is ${brand} a good choice for ${ind}?`, category: "branded" },
    { text: `What is ${brand} and who is it for?`, category: "branded" },

    // category — "best X" discovery prompts
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
  ];

  if (competitors[0]) {
    prompts.push({
      text: `${competitors[0]} vs alternatives — which ${ind} option is better?`,
      category: "comparison",
    });
    prompts.push({
      text: `Best alternatives to ${competitors[0]}`,
      category: "comparison",
    });
  }
  if (competitors[1]) {
    prompts.push({
      text: `Compare ${competitors[0]} and ${competitors[1]} for ${ind}`,
      category: "comparison",
    });
  }

  return prompts;
}
