import type { SourceType } from "../types";
import type { BrandContext, BrandEntity } from "./context";

/**
 * The one and only brand-matching implementation. Every feature that needs to
 * decide "does this text/citation belong to the tracked brand?" calls in here
 * with a Brand Context — nothing re-derives its own rules.
 *
 * Evidence priority (highest first):
 *   1. Domain / Website     — unambiguous, always decisive
 *   2. Company / Brand      — decisive unless the name is generic
 *   3. Business Description — corroborates an ambiguous name
 *   4. Industry             — corroborates an ambiguous name
 *   5. Competitors          — corroborates an ambiguous name
 */

export type MatchEvidence = "domain" | "app" | "name";
export type Corroborator = "description" | "industry" | "competitor";

export interface BrandMatch {
  mentioned: boolean;
  /** Strongest evidence found, or null when the brand is absent. */
  via: MatchEvidence | null;
  /** Supporting signals that let an ambiguous name match stand. */
  corroboration: Corroborator[];
  /** 0–1. Domain evidence scores 1; a corroborated ambiguous name scores lowest. */
  confidence: number;
}

// ── primitives ───────────────────────────────────────────────

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Scripts that don't separate words with spaces, or that glue particles on. */
const UNSPACED_SCRIPT =
  /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/**
 * Boundary-aware pattern for one alias. JS `\b` only understands ASCII word
 * characters, so boundaries are spelled out with Unicode property escapes —
 * and dropped at either end when the adjacent character belongs to an
 * unspaced script, because "테이블링은" and "テーブリングは" are the brand plus a
 * particle, not a different word.
 */
export function aliasPattern(alias: string): string {
  const a = alias.trim();
  const lead = UNSPACED_SCRIPT.test(a[0] ?? "") ? "" : "(?<![\\p{L}\\p{N}])";
  const trail = UNSPACED_SCRIPT.test(a[a.length - 1] ?? "") ? "" : "(?![\\p{L}\\p{N}])";
  return `${lead}${escapeRe(a)}${trail}`;
}

/** Compiled form of `aliasPattern`, for a single alias. */
export function aliasRegex(alias: string, flags = "iu"): RegExp {
  return new RegExp(aliasPattern(alias), flags);
}

/** True when any of the entity's name variants appears in the text. */
export function textHasEntityName(text: string, e: BrandEntity): boolean {
  return e.aliases.some((a) => aliasRegex(a).test(text));
}

/** True when the entity's own domain appears anywhere in the text. */
export function textHasEntityDomain(text: string, e: BrandEntity): boolean {
  return !!e.domain && text.toLowerCase().includes(e.domain);
}

/** Which corroborating signals (priority 3–5) the text carries. */
export function corroboratorsIn(text: string, ctx: BrandContext): Corroborator[] {
  const lower = text.toLowerCase();
  const found: Corroborator[] = [];
  if (ctx.descriptionTerms.some((term) => lower.includes(term))) found.push("description");
  if (ctx.industryPhrase && lower.includes(ctx.industryPhrase.toLowerCase())) found.push("industry");
  if (ctx.competitors.some((c) => textHasEntityDomain(text, c) || textHasEntityName(text, c))) {
    found.push("competitor");
  }
  return found;
}

// ── brand & competitor matching ──────────────────────────────

/**
 * Does this text mention the tracked brand? Domain evidence wins outright; a
 * name match on a generic brand ("Base", "Nova") only counts when the answer
 * also carries description, industry or competitor context — which is what
 * keeps same-name companies out of the results.
 */
export function matchBrand(text: string, ctx: BrandContext): BrandMatch {
  const corroboration = corroboratorsIn(text, ctx);

  if (textHasEntityDomain(text, ctx.self)) {
    return { mentioned: true, via: "domain", corroboration, confidence: 1 };
  }
  if (ctx.app && text.toLowerCase().includes(ctx.app.id.toLowerCase())) {
    return { mentioned: true, via: "app", corroboration, confidence: 0.95 };
  }
  if (textHasEntityName(text, ctx.self)) {
    if (!ctx.self.ambiguous) {
      return { mentioned: true, via: "name", corroboration, confidence: 0.9 };
    }
    if (corroboration.length) {
      return { mentioned: true, via: "name", corroboration, confidence: 0.6 };
    }
  }
  return { mentioned: false, via: null, corroboration, confidence: 0 };
}

/** Names of the competitors mentioned in the text, same evidence rules. */
export function matchCompetitors(text: string, ctx: BrandContext): string[] {
  return ctx.competitors
    .filter((c) => {
      if (textHasEntityDomain(text, c)) return true;
      if (!textHasEntityName(text, c)) return false;
      if (!c.ambiguous) return true;
      // an ambiguous competitor name needs the same corroboration the brand does
      return corroboratorsIn(text, ctx).length > 0 || matchBrand(text, ctx).mentioned;
    })
    .map((c) => c.name);
}

/** The brand reference used inside generated prompts: "Acme (acme.com)". */
export function brandRef(ctx: BrandContext): string {
  if (ctx.domain) return `${ctx.brand} (${ctx.domain})`;
  if (ctx.app) return `${ctx.brand} (${ctx.app.platform === "ios" ? "iOS App Store" : "Google Play"})`;
  return ctx.brand;
}

// ── citation source classification ───────────────────────────

const REVIEW_SITES = ["g2.com", "capterra.com", "trustpilot.com", "gartner.com", "getapp.com", "softwareadvice.com", "clutch.co", "yelp.com", "tripadvisor.com", "producthunt.com", "trustradius.com"];
const NEWS_SITES = ["techcrunch.com", "forbes.com", "reuters.com", "bloomberg.com", "nytimes.com", "theverge.com", "wired.com", "businessinsider.com", "cnbc.com", "wsj.com", "zdnet.com", "venturebeat.com"];

function hostMatches(domain: string, target: string | null): boolean {
  return !!target && (domain === target || domain.endsWith(`.${target}`));
}

/** True when the cited domain is the brand's own (or a subdomain of it). */
export function isBrandDomain(domain: string, ctx: BrandContext): boolean {
  return hostMatches(domain, ctx.self.domain);
}

/** The competitor that owns this cited domain, if any. */
export function competitorForDomain(domain: string, ctx: BrandContext): BrandEntity | null {
  return ctx.competitors.find((c) => hostMatches(domain, c.domain)) ?? null;
}

function sectionType(domain: string, path: string): SourceType | null {
  if (/\/docs|documentation|developer/i.test(path)) return "docs";
  if (/^help\.|^support\.|\/help|\/support|\/kb/i.test(domain + path)) return "knowledge_base";
  if (/^blog\.|\/blog/i.test(domain + path)) return "blog";
  return null;
}

/**
 * Classifies a cited URL against the Brand Context. Ownership is decided by
 * domain only — never by a fuzzy brand-name-looks-like-the-domain guess, which
 * is what used to mark unrelated same-name sites as "official".
 */
export function classifySource(domain: string, path: string, ctx: BrandContext): SourceType {
  if (isBrandDomain(domain, ctx)) return sectionType(domain, path) ?? "official";
  if (competitorForDomain(domain, ctx)) return "competitor";
  // app-store listings for the monitored app are the brand's own presence
  if (ctx.app && domain.endsWith("apple.com") && path.includes(`id${ctx.app.id}`)) return "official";
  if (ctx.app && domain === "play.google.com" && path.includes(ctx.app.id)) return "official";
  if (REVIEW_SITES.some((s) => hostMatches(domain, s))) return "review";
  if (NEWS_SITES.some((s) => hostMatches(domain, s))) return "news";
  return sectionType(domain, path) ?? "third_party";
}

// ── presentation ─────────────────────────────────────────────

/**
 * Splits text on brand-name occurrences so the UI can highlight them. Uses the
 * same alias set as matching, so what the Sources page highlights is exactly
 * what the scan counted.
 */
export function brandSegments(text: string, ctx: BrandContext): { text: string; isBrand: boolean }[] {
  const aliases = [...ctx.self.aliases].sort((a, b) => b.length - a.length).filter(Boolean);
  if (!aliases.length) return [{ text, isBrand: false }];
  const re = new RegExp(`(${aliases.map(aliasPattern).join("|")})`, "giu");
  const lookup = new Set(aliases.map((a) => a.toLowerCase()));
  return text
    .split(re)
    .filter((s) => s !== "")
    .map((s) => ({ text: s, isBrand: lookup.has(s.toLowerCase()) }));
}
