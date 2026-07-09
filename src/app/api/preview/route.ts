import { NextResponse, type NextRequest } from "next/server";
import { getProvider, isMockMode, type ChatMessage } from "@/lib/ai/provider";
import { ENGINES, ENGINE_IDS } from "@/lib/ai/engines";
import { mockContextMessage } from "@/lib/ai/mock";
import { analyzeResponse } from "@/lib/scan/analyzer";
import { computeScores, type ResultRow } from "@/lib/scan/scoring";
import { PREVIEW_COOKIE, PREVIEW_LIMIT, type PreviewResult } from "@/lib/preview";

export const maxDuration = 120;

const SCAN_SYSTEM_PROMPT =
  "You are a helpful assistant. Answer the user's question the way you normally would, naming specific products, companies or services where relevant.";

/**
 * POST { brand, industry, description? } → anonymous quick AEO/GEO preview.
 * Runs a reduced prompt set against every engine, in-memory only (nothing is
 * persisted), and returns top-line numbers. Full breakdowns require sign-up.
 * Capped per browser via cookie.
 */
export async function POST(request: NextRequest) {
  let body: { brand?: string; industry?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const brand = String(body.brand ?? "").trim();
  const industry = String(body.industry ?? "").trim();
  if (!brand || !industry) {
    return NextResponse.json({ error: "Brand and industry are required" }, { status: 400 });
  }

  const used = parseInt(request.cookies.get(PREVIEW_COOKIE)?.value ?? "0", 10) || 0;
  if (used >= PREVIEW_LIMIT) {
    return NextResponse.json(
      {
        error: `You've used all ${PREVIEW_LIMIT} free previews. Create a free account to keep scanning — and unlock the full breakdown.`,
        code: "limit",
      },
      { status: 403 }
    );
  }

  // reduced prompt set — enough signal for a teaser, cheap to run
  const prompts = [
    `What are the best ${industry} options right now?`,
    `Which ${industry} provider would you recommend for a small business?`,
    `Is ${brand} a good choice for ${industry}?`,
  ];

  const provider = getProvider();
  const jobs = ENGINES.flatMap((engine) =>
    prompts.map((prompt) => ({ engine, prompt }))
  );

  const rows: (ResultRow & { prompt: string; response_text: string })[] = [];
  await Promise.all(
    jobs.map(async ({ engine, prompt }) => {
      const messages: ChatMessage[] = [
        { role: "system", content: SCAN_SYSTEM_PROMPT },
        ...(isMockMode() ? [mockContextMessage(brand, [])] : []),
        { role: "user", content: prompt },
      ];
      try {
        const text = await provider.complete(engine.poeModel, messages);
        rows.push({ engine: engine.id, prompt, response_text: text, ...analyzeResponse(text, brand, []) });
      } catch (err) {
        console.error(`[preview] ${engine.id} failed:`, err);
      }
    })
  );

  if (!rows.length) {
    return NextResponse.json({ error: "All engine calls failed — please try again." }, { status: 502 });
  }

  const scores = computeScores(rows, brand, [], ENGINE_IDS);

  const topEntry = Object.entries(scores.engineScores).sort((a, b) => b[1] - a[1])[0];
  const topEngine = topEntry
    ? { label: ENGINES.find((e) => e.id === topEntry[0])?.label ?? topEntry[0], score: topEntry[1] }
    : null;

  const sampleRow = rows.find((r) => r.brand_mentioned) ?? rows[0];
  const sample = sampleRow
    ? {
        prompt: sampleRow.prompt,
        mentioned: sampleRow.brand_mentioned,
        excerpt: sampleRow.response_text.replace(/\s+/g, " ").slice(0, 220) + "…",
      }
    : null;

  const result: PreviewResult = {
    score: scores.overall,
    mentionRate: scores.mentionRate,
    coverage: scores.coverage,
    enginesScanned: ENGINES.length,
    promptsRun: prompts.length,
    topEngine,
    sample,
    previewsLeft: PREVIEW_LIMIT - used - 1,
  };

  const res = NextResponse.json(result);
  res.cookies.set(PREVIEW_COOKIE, String(used + 1), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}
