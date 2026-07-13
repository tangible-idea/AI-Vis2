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
import { MockProvider } from "./mock";

let cached: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cached) return cached;
  cached = process.env.POE_API_KEY
    ? new PoeProvider(process.env.POE_API_KEY)
    : new MockProvider();
  return cached;
}

export function isMockMode() {
  return !process.env.POE_API_KEY;
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
