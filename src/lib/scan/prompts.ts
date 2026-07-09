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
 * questions real buyers ask AI assistants. Users can edit these later.
 */
export function generateDefaultPrompts(input: PromptSeedInput): { text: string; category: PromptCategory }[] {
  const { industry, country, competitors, brand } = input;
  const ind = industry.trim();
  const loc = country.trim();

  const prompts: { text: string; category: PromptCategory }[] = [
    { text: `What are the best ${ind} solutions right now?`, category: "best" },
    { text: `Top ${ind} companies to consider in 2026`, category: "best" },
    { text: `Which ${ind} tool would you recommend for a small business?`, category: "recommendation" },
    { text: `I need a ${ind} provider — what should I choose and why?`, category: "recommendation" },
    { text: `Best ${ind} options in ${loc}`, category: "local" },
    { text: `Most trusted ${ind} brands for enterprise teams`, category: "best" },
  ];

  if (competitors[0]) {
    prompts.push({
      text: `${competitors[0]} vs alternatives — which ${ind} option is better?`,
      category: "comparison",
    });
    prompts.push({
      text: `Best alternatives to ${competitors[0]}`,
      category: "alternative",
    });
  }
  if (competitors[1]) {
    prompts.push({
      text: `Compare ${competitors[0]} and ${competitors[1]} for ${ind}`,
      category: "comparison",
    });
  }

  prompts.push({
    text: `Is ${brand} a good choice for ${ind}?`,
    category: "recommendation",
  });

  return prompts;
}
