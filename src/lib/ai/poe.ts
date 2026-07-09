import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "./provider";

/**
 * Poe exposes an OpenAI-compatible endpoint where the `model` field selects
 * the underlying engine (GPT-4o, Claude-Sonnet-4.5, Gemini-2.5-Pro,
 * Perplexity-Sonar, …) — one key covers every engine we scan.
 */
export class PoeProvider implements AIProvider {
  name = "poe";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.poe.com/v1",
    });
  }

  async complete(model: string, messages: ChatMessage[]): Promise<string> {
    const res = await this.client.chat.completions.create({
      model,
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  async *stream(model: string, messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
