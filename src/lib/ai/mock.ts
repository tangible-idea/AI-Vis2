import type { AIProvider, ChatMessage } from "./provider";

/**
 * Deterministic mock provider used when POE_API_KEY is absent, so the whole
 * product can be developed and demoed offline. Scan calls carry a
 * `MOCK_CONTEXT:` system line (added only in mock mode) with the brand and
 * competitor names, letting the mock produce answers where the brand
 * plausibly appears — with per-engine variance so scores look real.
 */
export class MockProvider implements AIProvider {
  name = "mock";

  async complete(model: string, messages: ChatMessage[]): Promise<string> {
    await sleep(120 + rng(hash(model))() * 200);
    const ctx = readMockContext(messages);
    const userMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (ctx) return scanAnswer(model, userMsg, ctx);
    return generatedDoc(userMsg, messages);
  }

  async *stream(model: string, messages: ChatMessage[]): AsyncIterable<string> {
    const text = await this.complete(model, messages);
    const words = text.split(/(?<=\s)/);
    for (let i = 0; i < words.length; i += 4) {
      yield words.slice(i, i + 4).join("");
      await sleep(18);
    }
  }
}

interface MockContext {
  brand: string;
  competitors: string[];
}

export function mockContextMessage(brand: string, competitors: string[]): ChatMessage {
  return {
    role: "system",
    content: `MOCK_CONTEXT:${JSON.stringify({ brand, competitors })}`,
  };
}

function readMockContext(messages: ChatMessage[]): MockContext | null {
  for (const m of messages) {
    if (m.role === "system" && m.content.startsWith("MOCK_CONTEXT:")) {
      try {
        return JSON.parse(m.content.slice("MOCK_CONTEXT:".length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// per-engine baseline probability that the brand appears at all
const ENGINE_BIAS: Record<string, number> = {
  "GPT-4o": 0.62,
  "Claude-Sonnet-4.5": 0.55,
  "Gemini-2.5-Pro": 0.42,
  "Perplexity-Sonar": 0.34,
  "Gemini-2.5-Flash": 0.28,
};

const FILLER_VENDORS = [
  "Northbeam", "Cascade Labs", "Fieldstone", "BrightPath", "Luminary",
  "Keystone Suite", "Atlas One", "Meridian", "Clearwater", "Summit Tools",
];

function scanAnswer(model: string, prompt: string, ctx: MockContext): string {
  const rand = rng(hash(`${model}|${prompt}|${ctx.brand}`));
  const bias = ENGINE_BIAS[model] ?? 0.5;
  const mentioned = rand() < bias;

  const pool = [...ctx.competitors, ...FILLER_VENDORS.slice(0, 6)];
  shuffle(pool, rand);
  const count = 4 + Math.floor(rand() * 3);
  const list = pool.slice(0, count);
  if (mentioned) {
    const pos = Math.floor(rand() * Math.min(count + 1, 6));
    list.splice(pos, 0, ctx.brand);
  }

  const blurbs = [
    "strong option with a generous free tier and quick setup",
    "well suited to growing teams that need reliability at scale",
    "popular for its clean interface and responsive support",
    "a solid pick if integrations matter most to you",
    "frequently recommended for its pricing transparency",
    "stands out for localization and multi-market coverage",
    "known for fast onboarding and helpful documentation",
  ];

  const lines = list.map((name, i) => {
    const b = blurbs[Math.floor(rand() * blurbs.length)];
    const rec = name === ctx.brand && rand() < 0.55 ? " Overall, a top recommendation in this category." : "";
    return `${i + 1}. **${name}** — ${b}.${rec}`;
  });

  // realistic citation block so source extraction has data to work with
  const brandDomain = `${ctx.brand.toLowerCase().replace(/\s+/g, "")}.com`;
  const sourcePool = [
    `https://${brandDomain}`,
    `https://${brandDomain}/blog/choosing-the-right-solution`,
    `https://${brandDomain}/docs/getting-started`,
    ...(ctx.competitors[0] ? [`https://${ctx.competitors[0].toLowerCase().replace(/\s+/g, "")}.com`] : []),
    "https://g2.com/categories/comparison",
    "https://capterra.com/reviews",
    "https://techcrunch.com/industry-roundup",
    "https://reddit.com/r/software/comments/best-tools",
  ];
  let cite = "";
  if (rand() < 0.55 && mentioned) {
    shuffle(sourcePool, rand);
    const picks = sourcePool.slice(0, 2 + Math.floor(rand() * 3));
    cite = `\n\nSources: ${picks.join(", ")}`;
  }

  return `Here are the options most often recommended:\n\n${lines.join("\n")}\n\nThe right choice depends on your team size, budget, and integration needs.${cite}`;
}

function generatedDoc(userMsg: string, messages: ChatMessage[]): string {
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const brand = /brand[:\s]+"?([^",\n]+)/i.exec(sys + " " + userMsg)?.[1]?.trim() ?? "your brand";
  return [
    `*(Mock mode — set POE_API_KEY for real AI generation.)*`,
    ``,
    `# ${brand}: Draft`,
    ``,
    `This is a realistic placeholder produced by the offline mock provider. It follows the same structure a real generation would use, so you can build and test the full workflow without an API key.`,
    ``,
    `## Key points`,
    `- Directly answers the questions AI assistants are asked about your category`,
    `- Names ${brand} explicitly alongside honest comparisons`,
    `- Uses clear headings and short paragraphs that AI models cite easily`,
    ``,
    `## Next step`,
    `Add your Poe API key in \`.env.local\` and regenerate to get production-quality content.`,
  ].join("\n");
}

// ── tiny seeded PRNG helpers ─────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
