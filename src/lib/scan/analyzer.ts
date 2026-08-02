import {
  aliasRegex,
  classifySource,
  matchBrand,
  matchCompetitors,
  textHasEntityName,
  type BrandContext,
  type BrandEntity,
} from "../brand";
import type { CitationSource } from "../types";

export interface AnalyzedResponse {
  brand_mentioned: boolean;
  /** 1-based rank of the brand among all named entities/list items, if listed. */
  brand_position: number | null;
  recommended: boolean;
  cited: boolean;
  competitors_mentioned: string[];
  sources: CitationSource[];
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
 * String-first analysis of an engine response. Cheap and deterministic; covers
 * the common listicle/answer formats engines return. All brand/competitor
 * identity decisions are delegated to the shared Brand Context matcher — this
 * file only interprets *where* in the answer the brand landed.
 */
export function analyzeResponse(text: string, ctx: BrandContext): AnalyzedResponse {
  const lower = text.toLowerCase();
  const match = matchBrand(text, ctx);
  const brand_mentioned = match.mentioned;

  // position: order of first appearance among brand + competitors,
  // preferring explicit numbered-list rank when present
  const competitors_mentioned = matchCompetitors(text, ctx);
  const brand_position = brand_mentioned
    ? (listRank(text, ctx.self) ?? appearanceRank(text, ctx))
    : null;

  // recommended: the brand (by name or domain) appears near recommendation
  // language in the same sentence/line
  let recommended = false;
  if (brand_mentioned) {
    const segments = text.split(/(?<=[.!?])\s+|\n/);
    recommended = segments.some(
      (s) => mentionsSelf(s, ctx) && RECOMMEND_PATTERNS.some((p) => s.toLowerCase().includes(p))
    );
    // rank 1 in a list counts as an implicit recommendation
    if (!recommended && listRank(text, ctx.self) === 1) recommended = true;
  }

  const sources = extractSources(text, ctx);

  const cited =
    sources.some((s) => s.type === "official") ||
    (brand_mentioned &&
      !!ctx.domain &&
      (lower.includes(ctx.domain) || lower.includes("source") || lower.includes("according to")));

  return { brand_mentioned, brand_position, recommended, cited, competitors_mentioned, sources };
}

// ── citation source extraction ───────────────────────────────

/**
 * Pulls cited URLs/domains out of an engine answer: markdown links, bare
 * URLs, and "Sources: a.com, b.com" style lists. Deduped by domain+path.
 */
export function extractSources(text: string, ctx: BrandContext): CitationSource[] {
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
          type: classifySource(domain, u.pathname, ctx),
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

// ── position helpers ─────────────────────────────────────────

/** Brand present in this fragment — by domain or by any name alias. */
function mentionsSelf(fragment: string, ctx: BrandContext): boolean {
  if (ctx.domain && fragment.toLowerCase().includes(ctx.domain)) return true;
  return textHasEntityName(fragment, ctx.self);
}

/** Rank in an explicit numbered list ("3. **Brand** — …"), if the brand is in one. */
function listRank(text: string, self: BrandEntity): number | null {
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (m && textHasEntityName(m[2], self)) return parseInt(m[1], 10);
  }
  return null;
}

/** Fallback rank: order of first mention among all tracked entities. */
function appearanceRank(text: string, ctx: BrandContext): number {
  const entries = [ctx.self, ...ctx.competitors]
    .map((e) => ({ entity: e, idx: firstIndex(text, e) }))
    .filter((e) => e.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  return entries.findIndex((e) => e.entity === ctx.self) + 1;
}

/** Earliest position of any of the entity's aliases (or its domain) in the text. */
function firstIndex(text: string, e: BrandEntity): number {
  let best = -1;
  const consider = (idx: number) => {
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  };
  for (const alias of e.aliases) consider(text.search(aliasRegex(alias, "iu")));
  if (e.domain) consider(text.toLowerCase().indexOf(e.domain));
  return best;
}
