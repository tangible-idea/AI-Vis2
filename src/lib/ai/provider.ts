/**
 * AI provider abstraction. Engines (ChatGPT, Claude, …) are queried through
 * a single provider; swap implementations by changing getProvider().
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  /** One-shot completion against a specific model. */
  complete(model: string, messages: ChatMessage[]): Promise<string>;
  /** Streaming completion; yields text deltas. */
  stream(model: string, messages: ChatMessage[]): AsyncIterable<string>;
}

import { PoeProvider } from "./poe";
import { GlmProvider } from "./glm";
import { MockProvider } from "./mock";
import { ScraperProvider } from "./scraper";

let cached: AIProvider | null = null;

/**
 * SCAN provider — queries the engines. Poe answers the API-model engines; when
 * SCRAPER_API_URL is set the self-hosted scraper handles chatgpt/gemini against
 * the real consumer UIs. Falls back to a realistic mock without a Poe key.
 */
export function getProvider(): AIProvider {
  if (cached) return cached;
  const base: AIProvider = process.env.POE_API_KEY
    ? new PoeProvider(process.env.POE_API_KEY)
    : new MockProvider();
  cached = process.env.SCRAPER_API_URL
    ? new ScraperProvider(process.env.SCRAPER_API_URL, base)
    : base;
  return cached;
}

let cachedGen: AIProvider | null = null;

/**
 * GENERATION provider — content generation, the assistant and prompt
 * suggestions (not scans). Uses z.ai GLM (glm-4.7-flash, free) when GLM_API_KEY
 * is set; otherwise falls back to the scan provider so generation still works.
 */
export function getGenerationProvider(): AIProvider {
  if (cachedGen) return cachedGen;
  cachedGen = process.env.GLM_API_KEY
    ? new GlmProvider(process.env.GLM_API_KEY)
    : getProvider();
  return cachedGen;
}

/** True when SCANS run against the mock (no Poe key). */
export function isMockMode() {
  return !process.env.POE_API_KEY;
}

/** True when GENERATION runs against the mock (neither GLM nor Poe configured). */
export function isGenerationMockMode() {
  return !process.env.GLM_API_KEY && !process.env.POE_API_KEY;
}

/**
 * One-shot completion with bounded retries. Provider hiccups (rate limits,
 * transient 5xx, network) get two more attempts with exponential backoff +
 * jitter; auth/validation errors (4xx except 408/429) fail fast.
 */
export async function completeWithRetry(
  provider: AIProvider,
  model: string,
  messages: ChatMessage[],
  attempts = 3
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await provider.complete(model, messages);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      const retriable = status == null || status === 408 || status === 429 || status >= 500;
      if (!retriable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i + Math.random() * 500));
    }
  }
  throw lastErr;
}
