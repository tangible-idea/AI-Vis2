import type { Engine } from "../types";

export interface EngineInfo {
  id: Engine;
  label: string;
  /** Poe model name (https://poe.com — OpenAI-compatible API). */
  poeModel: string;
  color: string;
}

export const ENGINES: EngineInfo[] = [
  { id: "chatgpt", label: "ChatGPT", poeModel: "GPT-4o", color: "#10a37f" },
  { id: "claude", label: "Claude", poeModel: "Claude-Sonnet-4.5", color: "#d97757" },
  { id: "gemini", label: "Gemini", poeModel: "Gemini-2.5-Pro", color: "#4285f4" },
  { id: "perplexity", label: "Perplexity", poeModel: "Perplexity-Sonar", color: "#1691a2" },
];

export const ENGINE_IDS = ENGINES.map((e) => e.id);

export function engineInfo(id: Engine | string): EngineInfo {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[0];
}

/** Model used for the platform's own reasoning (analysis, content, assistant). */
export const WORKHORSE_MODEL = "Claude-Sonnet-4.5";
