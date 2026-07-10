import type { Engine } from "../types";

/**
 * How an engine's answers are collected. The measurement layer is modular:
 * today every engine is queried through the provider abstraction
 * (lib/ai/provider.ts) using the model that powers its consumer product —
 * the closest approximation of what a real user sees that is officially
 * supported. Swap `collection` per engine as consumer-grade collectors
 * (search-grounded APIs, official surfaces) become available, without
 * touching the scan pipeline.
 */
export type CollectionMethod = "model-emulation" | "search-grounded" | "consumer-surface";

export interface EngineInfo {
  id: Engine;
  label: string;
  /** Poe model name (https://poe.com — OpenAI-compatible API). */
  poeModel: string;
  color: string;
  collection: CollectionMethod;
}

export const ENGINES: EngineInfo[] = [
  { id: "chatgpt", label: "ChatGPT", poeModel: "GPT-4o", color: "#10a37f", collection: "model-emulation" },
  { id: "claude", label: "Claude", poeModel: "Claude-Sonnet-4.5", color: "#d97757", collection: "model-emulation" },
  { id: "gemini", label: "Gemini", poeModel: "Gemini-2.5-Pro", color: "#4285f4", collection: "model-emulation" },
  { id: "perplexity", label: "Perplexity", poeModel: "Perplexity-Sonar", color: "#1691a2", collection: "search-grounded" },
  { id: "google_ai", label: "Google AI Overview", poeModel: "Gemini-2.5-Flash", color: "#ea8600", collection: "search-grounded" },
];

export const ENGINE_IDS = ENGINES.map((e) => e.id);

export function engineInfo(id: Engine | string): EngineInfo {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[0];
}

/** Model used for the platform's own reasoning (analysis, content, assistant). */
export const WORKHORSE_MODEL = "Claude-Sonnet-4.5";
