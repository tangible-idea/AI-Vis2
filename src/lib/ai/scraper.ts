import type { AIProvider, ChatMessage } from "./provider";
import { ENGINES } from "./engines";

/**
 * Provider backed by the self-hosted Playwright scraper (scrapers/server.py),
 * which drives the real consumer web UIs. Only the engines the scraper
 * implements (chatgpt, gemini) are routed to it; everything else goes to the
 * wrapped fallback provider (Poe or mock).
 *
 * The scraper API is asynchronous — POST /scan returns a job id immediately
 * and the job is polled until done. Jobs run one at a time server-side, so
 * concurrent completions queue there; expect minutes per answer.
 */

/** Engines the scraper implements, keyed by the poeModel the runner passes. */
const SCRAPER_ENGINE_BY_MODEL = new Map(
  ENGINES.filter((e) => e.id === "chatgpt" || e.id === "gemini").map((e) => [e.poeModel, e.id])
);

const POLL_INTERVAL_MS = 5_000;
/** Give a job time to sit in the scraper's serial queue and still finish. */
const JOB_DEADLINE_MS = 10 * 60_000;
/** Per-answer budget forwarded to the scraper. */
const SCRAPE_TIMEOUT_S = 120;

interface ScanJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  hint: string | null;
  result: {
    ready: boolean;
    ok: boolean;
    error: string | null;
    results: { answer: string; ok: boolean; error: string | null }[];
  } | null;
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export class ScraperProvider implements AIProvider {
  name = "scraper";

  constructor(
    private baseUrl: string,
    private fallback: AIProvider
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async complete(model: string, messages: ChatMessage[]): Promise<string> {
    const engine = SCRAPER_ENGINE_BY_MODEL.get(model);
    if (!engine) return this.fallback.complete(model, messages);

    // The scraper types one question into a chat UI — no system prompt slot.
    const prompt = [...messages].reverse().find((m) => m.role === "user")?.content;
    if (!prompt) throw httpError("no user message to send to scraper", 400);

    const submit = await fetch(`${this.baseUrl}/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine, prompt, timeout: SCRAPE_TIMEOUT_S }),
      cache: "no-store",
    });
    if (!submit.ok) {
      throw httpError(`scraper submit failed: HTTP ${submit.status}`, submit.status);
    }
    const { job_id } = (await submit.json()) as ScanJob;

    const deadline = Date.now() + JOB_DEADLINE_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const res = await fetch(`${this.baseUrl}/scan/${job_id}`, { cache: "no-store" });
      if (res.status === 404) {
        // in-memory job store — a vanished id means the scraper restarted
        throw httpError("scraper job lost (server restarted, likely OOM)", 500);
      }
      if (!res.ok) continue; // transient poll hiccup; keep waiting
      const job = (await res.json()) as ScanJob;

      if (job.status === "done") {
        return job.result?.results[0]?.answer ?? "";
      }
      if (job.status === "failed") {
        const detail = [job.error, job.hint].filter(Boolean).join(" — ");
        // a missing login session won't heal between retries; fail fast (4xx)
        const permanent = job.error?.includes("--login") ?? false;
        throw httpError(`scraper job failed: ${detail}`, permanent ? 401 : 500);
      }
    }
    throw httpError("scraper job timed out", 408);
  }

  async *stream(model: string, messages: ChatMessage[]): AsyncIterable<string> {
    if (!SCRAPER_ENGINE_BY_MODEL.has(model)) {
      yield* this.fallback.stream(model, messages);
      return;
    }
    // the scraper collects the full answer server-side; emit it in one chunk
    yield await this.complete(model, messages);
  }
}
