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
