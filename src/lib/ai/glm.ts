import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "./provider";

// z.ai's OpenAI-compatible endpoint. Override for the mainland (bigmodel.cn)
// endpoint or a future path via GLM_BASE_URL.
const GLM_BASE_URL = process.env.GLM_BASE_URL?.trim() || "https://api.z.ai/api/paas/v4";
// glm-4.7-flash is z.ai's free tier. Override the exact id with GLM_MODEL.
const GLM_MODEL = process.env.GLM_MODEL?.trim() || "glm-4.7-flash";

/**
 * z.ai GLM provider (OpenAI-compatible), used for GENERATION only (content,
 * assistant, prompt suggestions). One model (GLM_MODEL) serves every call, so
 * the `model` argument callers pass is ignored. Scans stay on Poe/scraper.
 */
export class GlmProvider implements AIProvider {
  name = "glm";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: GLM_BASE_URL });
  }

  async complete(_model: string, messages: ChatMessage[]): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: GLM_MODEL,
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  async *stream(_model: string, messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: GLM_MODEL,
      messages,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
