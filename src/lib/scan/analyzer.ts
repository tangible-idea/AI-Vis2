import type { CitationSource, SourceType } from "../types";

export interface AnalyzedResponse {
  brand_mentioned: boolean;
  /** 1-based rank of the brand among all named entities/list items, if listed. */
  brand_position: number | null;
  recommended: boolean;
  cited: boolean;
  competitors_mentioned: string[];
  sources: CitationSource[];
}

export interface AnalyzerContext {
  /** Brand website, for classifying official sources. */
  brandWebsite?: string | null;
  /** Competitor websites, for classifying competitor sources. */
  competitorWebsites?: (string | null)[];
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
  competitors: string[],
  ctx: AnalyzerContext = {}
): AnalyzedResponse {
  const lower = text.toLowerCase();
  // the tracked domain is the canonical entity identifier — a domain
  // mention counts as a brand mention even when the name isn't spelled out
  const brandHost = hostOf(ctx.brandWebsite);
  const brand_mentioned =
    nameRegex(brand).test(text) || (!!brandHost && lower.includes(brandHost));

  // position: order of first appearance among brand + competitors,
  // preferring explicit numbered-list rank when present
  let brand_position: number | null = null;
  if (brand_mentioned) {
    brand_position = listRank(text, brand) ?? appearanceRank(text, brand, competitors);
  }

  // recommended: brand (by name or domain) appears near recommendation
  // language (same sentence/line)
  let recommended = false;
  if (brand_mentioned) {
    const segments = text.split(/(?<=[.!?])\s+|\n/);
    recommended = segments.some(
      (s) =>
        (nameRegex(brand).test(s) || (!!brandHost && s.toLowerCase().includes(brandHost))) &&
        RECOMMEND_PATTERNS.some((p) => s.toLowerCase().includes(p))
    );
    // rank 1 in a list counts as an implicit recommendation
    if (!recommended && listRank(text, brand) === 1) recommended = true;
  }

  const sources = extractSources(text, brand, ctx);

  const cited =
    sources.some((s) => s.type === "official") ||
    (brand_mentioned &&
      (lower.includes("source") ||
        lower.includes("according to") ||
        new RegExp(`${escapeRe(domainish(brand))}\\.[a-z]{2,}`, "i").test(text)));

  const competitors_mentioned = competitors.filter((c) => nameRegex(c).test(text));

  return { brand_mentioned, brand_position, recommended, cited, competitors_mentioned, sources };
}

// ── citation source extraction ───────────────────────────────

const REVIEW_SITES = ["g2.com", "capterra.com", "trustpilot.com", "gartner.com", "getapp.com", "softwareadvice.com", "clutch.co", "yelp.com", "tripadvisor.com", "producthunt.com", "trustradius.com"];
const NEWS_SITES = ["techcrunch.com", "forbes.com", "reuters.com", "bloomberg.com", "nytimes.com", "theverge.com", "wired.com", "businessinsider.com", "cnbc.com", "wsj.com", "zdnet.com", "venturebeat.com"];

/**
 * Pulls cited URLs/domains out of an engine answer: markdown links, bare
 * URLs, and "Sources: a.com, b.com" style lists. Deduped by domain+path.
 */
export function extractSources(text: string, brand: string, ctx: AnalyzerContext): CitationSource[] {
  const found = new Map<string, CitationSource>();

  const add = (raw: string, title?: string) => {
    const url = raw.replace(/[).,;\]]+$/, "");
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      const u = new URL(withProto);
      const domain = u.hostname.replace(/^www\./, "").toLowerCase();
      if (!domain.includes(".") || domain.length < 4) return;
      const key = `${domain}${u.pathname === "/" ? "" : u.pathname}`;
      if (!found.has(key)) {
        found.set(key, {
          url: withProto,
          domain,
          type: classifySource(domain, u.pathname, brand, ctx),
          ...(title ? { title: title.slice(0, 120) } : {}),
        });
      }
    } catch {
      /* not a URL */
    }
  };

  // markdown links (link text doubles as the page title) + bare URLs
  for (const m of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) add(m[2], m[1]);
  for (const m of text.matchAll(/(?<!\()https?:\/\/[^\s)\]"'<>]+/g)) add(m[0]);
  // "Sources: acme.com, g2.com" style bare-domain lists
  for (const line of text.split("\n")) {
    if (/^\s*(sources?|references?|citations?)\s*:/i.test(line)) {
      for (const m of line.matchAll(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(\/[^\s,;]*)?/gi)) {
        add(m[0]);
      }
    }
  }

  return [...found.values()].slice(0, 12);
}

function hostOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function classifySource(domain: string, path: string, brand: string, ctx: AnalyzerContext): SourceType {
  const brandHost = hostOf(ctx.brandWebsite);
  if ((brandHost && (domain === brandHost || domain.endsWith(`.${brandHost}`))) || domain.startsWith(`${domainish(brand)}.`)) {
    // brand-owned domain: still distinguish its content sections
    if (/\/docs|documentation|developer/i.test(path)) return "docs";
    if (/^help\.|^support\.|\/help|\/support|\/kb/i.test(domain + path)) return "knowledge_base";
    if (/^blog\.|\/blog/i.test(domain + path)) return "blog";
    return "official";
  }
  for (const w of ctx.competitorWebsites ?? []) {
    const h = hostOf(w);
    if (h && (domain === h || domain.endsWith(`.${h}`))) return "competitor";
  }
  if (REVIEW_SITES.some((s) => domain === s || domain.endsWith(`.${s}`))) return "review";
  if (NEWS_SITES.some((s) => domain === s || domain.endsWith(`.${s}`))) return "news";
  if (/\/docs|documentation|developer/i.test(path)) return "docs";
  if (/^help\.|^support\.|\/help|\/support|\/kb/i.test(domain + path)) return "knowledge_base";
  if (/^blog\.|\/blog/i.test(domain + path)) return "blog";
  return "third_party";
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
