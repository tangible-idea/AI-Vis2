export interface AnalyzedResponse {
  brand_mentioned: boolean;
  /** 1-based rank of the brand among all named entities/list items, if listed. */
  brand_position: number | null;
  recommended: boolean;
  cited: boolean;
  competitors_mentioned: string[];
}

const RECOMMEND_PATTERNS = [
  "recommend",
  "top pick",
  "top choice",
  "best option",
  "best choice",
  "stands out",
  "would suggest",
  "go-to",
];

/**
 * String-first analysis of an engine response. Cheap and deterministic;
 * covers the common listicle/answer formats engines return.
 */
export function analyzeResponse(
  text: string,
  brand: string,
  competitors: string[]
): AnalyzedResponse {
  const lower = text.toLowerCase();
  const brandRe = nameRegex(brand);
  const brand_mentioned = brandRe.test(text);

  // position: order of first appearance among brand + competitors,
  // preferring explicit numbered-list rank when present
  let brand_position: number | null = null;
  if (brand_mentioned) {
    brand_position = listRank(text, brand) ?? appearanceRank(text, brand, competitors);
  }

  // recommended: brand appears near recommendation language (same sentence/line)
  let recommended = false;
  if (brand_mentioned) {
    const segments = text.split(/(?<=[.!?])\s+|\n/);
    recommended = segments.some(
      (s) =>
        nameRegex(brand).test(s) &&
        RECOMMEND_PATTERNS.some((p) => s.toLowerCase().includes(p))
    );
    // rank 1 in a list counts as an implicit recommendation
    if (!recommended && listRank(text, brand) === 1) recommended = true;
  }

  const cited =
    brand_mentioned &&
    (lower.includes("source") ||
      lower.includes("according to") ||
      new RegExp(`${escapeRe(domainish(brand))}\\.[a-z]{2,}`, "i").test(text));

  const competitors_mentioned = competitors.filter((c) => nameRegex(c).test(text));

  return { brand_mentioned, brand_position, recommended, cited, competitors_mentioned };
}

/** Rank in an explicit numbered list ("3. **Brand** — …"), if the brand is in one. */
function listRank(text: string, brand: string): number | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (m && nameRegex(brand).test(m[2])) return parseInt(m[1], 10);
  }
  return null;
}

/** Fallback rank: order of first mention among all tracked names. */
function appearanceRank(text: string, brand: string, competitors: string[]): number {
  const entries = [brand, ...competitors]
    .map((name) => ({ name, idx: text.search(nameRegex(name)) }))
    .filter((e) => e.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  return entries.findIndex((e) => e.name === brand) + 1;
}

function nameRegex(name: string): RegExp {
  return new RegExp(`(?<![\\w])${escapeRe(name.trim())}(?![\\w])`, "i");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function domainish(brand: string) {
  return brand.toLowerCase().replace(/[^a-z0-9]/g, "");
}
