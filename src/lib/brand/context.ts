import type { SupabaseClient } from "@supabase/supabase-js";
import { industryPhrase, normalizeIndustry } from "../types";
import type { Competitor, Project } from "../types";

/**
 * Brand Profile → Brand Context.
 *
 * The **Brand Profile** is what the user fills in (project row + competitors);
 * it is the single source of truth for brand information. The **Brand Context**
 * is the lightweight normalized object derived from it — no AI, no network, no
 * storage of its own — that every feature (Monitoring, AI Visibility Scans,
 * Prompt Explorer, Sources, Reports, Recommendations) reuses so brand matching
 * behaves identically everywhere.
 *
 * Matching evidence is ranked, strongest first:
 *   1. Domain / Website   2. Company / Brand   3. Business Description
 *   4. Industry           5. Competitors
 * See `./match` — the only place matching is implemented.
 */

export type AppPlatform = "ios" | "android";

/** How many competitor slots the Brand Profile editor exposes. */
export const BRAND_PROFILE_COMPETITOR_SLOTS = 3;

/** A monitored app listing — iOS and Android are always separate projects. */
export interface AppIdentity {
  platform: AppPlatform;
  /** Store identifier: numeric App Store id, or the Play package name. */
  id: string;
  storeUrl: string;
}

/** The editable Brand Profile. Mirrors the project row plus its competitors. */
export interface BrandProfile {
  projectId: string;
  /** Company / Brand. */
  company: string;
  /** Website / Domain / App URL. */
  website: string;
  /** Brand Logo URL (optional). */
  logoUrl: string | null;
  industry: string;
  /** Primary Market (ISO country code). */
  market: string;
  /** Preferred Language (content language code). */
  language: string;
  /** Business Description (optional). */
  description: string | null;
  competitors: { name: string; website: string | null }[];
  /** Google Trends geo override; null falls back to the primary market. */
  trendsGeo: string | null;
}

/** A brand-like entity (the tracked brand or a competitor), normalized. */
export interface BrandEntity {
  name: string;
  domain: string | null;
  /** Name variants matched in text: the name itself, legal-suffix-stripped, domain base. */
  aliases: string[];
  /** Bare-name matches for this entity need corroborating evidence. */
  ambiguous: boolean;
}

/** The shared, reusable Brand Context. Derived — never stored, never AI-generated. */
export interface BrandContext {
  projectId: string;
  /** Company / Brand, as displayed. */
  brand: string;
  /** Canonical domain ("acme.com"), or null for app-store projects. */
  domain: string | null;
  /** Normalized https origin, or the store URL for app projects. */
  website: string;
  app: AppIdentity | null;
  logoUrl: string | null;
  /** Normalized industry id. */
  industry: string;
  /** In-sentence industry wording ("software & SaaS"). */
  industryPhrase: string;
  /** Primary Market (ISO country code). */
  market: string;
  language: string;
  description: string | null;
  /** Salient terms lifted from the description — corroborating evidence only. */
  descriptionTerms: string[];
  /** The tracked brand as a matchable entity. */
  self: BrandEntity;
  competitors: BrandEntity[];
  /** Google Trends geo — the override when set, otherwise the primary market. */
  trendsGeo: string;
}

// ── identity normalization ───────────────────────────────────

/** "https://www.acme.com/x" | "acme.com" → "acme.com" (canonical form). */
export function canonicalDomain(website: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

const APP_STORE_HOSTS = ["apps.apple.com", "itunes.apple.com"];
const PLAY_STORE_HOST = "play.google.com";

/**
 * Recognizes App Store / Google Play listings. App projects have no brand
 * domain of their own, so matching leans on the app name and store id instead
 * of a hostname — and iOS/Android listings stay independent projects because
 * their store URLs differ.
 */
export function parseAppUrl(website: string): AppIdentity | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (APP_STORE_HOSTS.includes(host)) {
    const m = /\/id(\d+)/.exec(url.pathname);
    return m ? { platform: "ios", id: m[1], storeUrl: url.toString() } : null;
  }
  if (host === PLAY_STORE_HOST && url.pathname.startsWith("/store/apps")) {
    const id = url.searchParams.get("id");
    return id ? { platform: "android", id, storeUrl: url.toString() } : null;
  }
  return null;
}

/** Legal-entity suffixes stripped when deriving name aliases. */
const LEGAL_SUFFIXES =
  /\b(inc|inc\.|llc|l\.l\.c\.|ltd|ltd\.|limited|corp|corp\.|corporation|co|co\.|company|gmbh|ag|s\.a\.|sa|sas|sarl|bv|nv|oy|ab|as|plc|pty|pte|kk|k\.k\.|주식회사|株式会社)\b/gi;

/** Name variants worth matching in free text ("Acme Inc." → "Acme Inc.", "Acme"). */
function aliasesFor(name: string, domain: string | null): string[] {
  const out = new Set<string>();
  const clean = name.trim();
  if (clean) {
    out.add(clean);
    const stripped = clean.replace(LEGAL_SUFFIXES, "").replace(/[,·]/g, " ").replace(/\s+/g, " ").trim();
    if (stripped.length >= 2) out.add(stripped);
  }
  // the domain's base label is often the brand as engines spell it ("acme.com" → "Acme")
  if (domain) {
    const base = domain.split(".")[0];
    if (base.length >= 3) out.add(base);
  }
  return [...out];
}

/**
 * Words too common to identify a brand on their own. A bare match on an
 * ambiguous alias needs corroboration (domain, description, industry or a
 * competitor in the same answer) before it counts as a mention — this is what
 * stops "Apex", "Nova" or "Base" from producing false matches.
 */
const AMBIGUOUS_WORDS = new Set([
  "app", "apps", "base", "best", "beta", "boost", "box", "brand", "build", "care", "cloud",
  "core", "data", "flow", "focus", "go", "grow", "home", "hub", "info", "lab", "labs", "link",
  "live", "loop", "market", "meta", "mint", "next", "note", "nova", "one", "open", "pay",
  "peak", "pilot", "plan", "plus", "prime", "pro", "pulse", "shop", "site", "spark", "stack",
  "start", "store", "study", "sync", "team", "tech", "up", "wave", "wise", "work", "zone",
]);

/** True when the alias set is too generic to stand alone as brand evidence. */
function isAmbiguous(aliases: string[]): boolean {
  // multi-word names are specific enough; single short/common words are not
  return aliases.every((a) => {
    const t = a.trim().toLowerCase();
    return !t.includes(" ") && (t.length <= 3 || AMBIGUOUS_WORDS.has(t));
  });
}

function entity(name: string, website: string | null): BrandEntity {
  const domain = website ? canonicalDomain(website) : null;
  const usableDomain = domain && domain.includes(".") && !parseAppUrl(website ?? "") ? domain : null;
  const aliases = aliasesFor(name, usableDomain);
  return { name: name.trim(), domain: usableDomain, aliases, ambiguous: isAmbiguous(aliases) };
}

const DESCRIPTION_STOPWORDS = new Set([
  "that", "this", "with", "from", "your", "their", "them", "they", "have", "help", "helps",
  "into", "more", "most", "other", "than", "then", "when", "where", "which", "while", "about",
  "also", "been", "being", "such", "only", "over", "under", "using", "used", "make", "makes",
  "company", "business", "platform", "solution", "solutions", "service", "services", "provide",
  "provides", "providing", "offer", "offers", "customers", "clients", "users", "people",
]);

/**
 * Salient terms from the Business Description. Used only as corroborating
 * evidence for ambiguous brand names — never as a match on its own.
 */
export function descriptionTerms(description: string | null): string[] {
  if (!description) return [];
  const seen = new Set<string>();
  for (const raw of description.toLowerCase().split(/[^\p{L}\p{N}+&-]+/u)) {
    const term = raw.replace(/^[-+&]+|[-+&]+$/g, "");
    if (term.length < 4 || DESCRIPTION_STOPWORDS.has(term)) continue;
    seen.add(term);
    if (seen.size >= 16) break;
  }
  return [...seen];
}

// ── profile → context ────────────────────────────────────────

/** Builds the Brand Profile from the stored project row and its competitors. */
export function toBrandProfile(
  project: Project,
  competitors: Pick<Competitor, "name" | "website">[] = []
): BrandProfile {
  return {
    projectId: project.id,
    company: project.name,
    website: project.website,
    logoUrl: project.logo_url,
    industry: project.industry,
    market: project.country,
    language: project.language,
    description: project.description,
    competitors: competitors.map((c) => ({ name: c.name, website: c.website })),
    trendsGeo: project.trends_geo ?? null,
  };
}

/**
 * Derives the Brand Context. Pure, cheap and deterministic — safe to call per
 * request; there is nothing to cache and nothing to persist.
 */
export function buildBrandContext(profile: BrandProfile): BrandContext {
  const app = parseAppUrl(profile.website);
  const self = entity(profile.company, profile.website);
  const industry = normalizeIndustry(profile.industry);

  return {
    projectId: profile.projectId,
    brand: profile.company.trim(),
    domain: self.domain,
    website: profile.website,
    app,
    logoUrl: profile.logoUrl,
    industry,
    industryPhrase: industryPhrase(profile.industry).trim(),
    market: profile.market,
    language: profile.language,
    description: profile.description,
    descriptionTerms: descriptionTerms(profile.description),
    self,
    competitors: profile.competitors
      .filter((c) => c.name.trim())
      .map((c) => entity(c.name, c.website)),
    trendsGeo: profile.trendsGeo || profile.market,
  };
}

/** Convenience: project row + competitors → Brand Context in one step. */
export function brandContextFor(
  project: Project,
  competitors: Pick<Competitor, "name" | "website">[] = []
): BrandContext {
  return buildBrandContext(toBrandProfile(project, competitors));
}

/**
 * Loads the Brand Context for a project. Works with both the RLS-scoped and
 * the service-role client, so server components, routes and the scan runner
 * all take the same path.
 */
export async function loadBrandContext(
  db: SupabaseClient,
  projectId: string
): Promise<BrandContext | null> {
  const [{ data: project }, { data: competitors }] = await Promise.all([
    db.from("projects").select("*").eq("id", projectId).single(),
    db.from("competitors").select("name, website").eq("project_id", projectId).order("position"),
  ]);
  if (!project) return null;
  return brandContextFor(project as Project, competitors ?? []);
}

/** Display label for the brand's identity — domain, or the app store listing. */
export function brandIdentityLabel(ctx: BrandContext): string {
  if (ctx.domain) return ctx.domain;
  if (ctx.app) return ctx.app.platform === "ios" ? `App Store · ${ctx.app.id}` : ctx.app.id;
  return ctx.brand;
}
