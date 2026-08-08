/**
 * Competitor identity resolution. Competitors are entered as domains/URLs;
 * we derive a display name from the site's <title> when reachable, falling
 * back to a cleaned-up domain. Favicons come from Google's public favicon
 * service (no API key) with a letter placeholder as final fallback.
 */

import { canonicalDomain, parseAppUrl, type AppIdentity } from "./brand";

export interface ResolvedCompetitor {
  name: string;
  website: string; // normalized https:// origin
  domain: string;
}

/**
 * Extracts a bare domain from free-form input ("https://x.com/a", "x.com").
 * Canonicalization is the Brand Context's — this only adds the "must look
 * like a domain" rule so plain names ("acme") aren't treated as one.
 */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const host = canonicalDomain(raw);
  return host.includes(".") ? host : null;
}

/** "acme-corp" → "Acme Corp". */
function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "acme-corp.co.uk" → "Acme Corp" — the offline fallback name. */
export function nameFromDomain(domain: string): string {
  return titleCase(domain.split(".")[0]);
}

/**
 * A readable name from a store listing when its page can't be fetched:
 * ".../app/acme-bookings/id123" → "Acme Bookings", "com.acme.bookings" →
 * "Bookings".
 */
function nameFromAppUrl(app: AppIdentity): string {
  if (app.platform === "android") return titleCase(app.id.split(".").pop() ?? app.id);
  const slug = new URL(app.storeUrl).pathname
    .split("/")
    .filter(Boolean)
    .find((part, i, parts) => parts[i + 1]?.startsWith("id"));
  return slug ? titleCase(slug) : "App";
}

export function faviconUrl(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return null;
  }
}

/**
 * Resolves free-form competitor input to { name, website }. Domains and app
 * store listings both get a title fetch (short timeout, best-effort); plain
 * names pass through.
 *
 * A store listing keeps its full URL rather than being reduced to
 * "apps.apple.com" — the store host identifies Apple, not the competitor, and
 * the Brand Context already knows to match app entities by name instead of by
 * hostname.
 */
export async function resolveCompetitorInput(
  input: string
): Promise<{ name: string; website: string | null }> {
  const app = parseAppUrl(input.trim());
  if (app) {
    const title = await fetchSiteTitle(app.storeUrl);
    return { name: title ?? nameFromAppUrl(app), website: app.storeUrl };
  }

  const domain = normalizeDomain(input);
  if (!domain) return { name: input.trim(), website: null };

  const website = `https://${domain}`;
  const title = await fetchSiteTitle(website);
  return { name: title ?? nameFromDomain(domain), website };
}

async function fetchSiteTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SightlineBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 60_000);
    const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html);
    if (!m) return null;
    return cleanTitle(m[1]);
  } catch {
    return null;
  }
}

/** "Acme — CRM for teams | Acme Inc." → "Acme" (brand segment only). */
function cleanTitle(title: string): string | null {
  const decoded = title
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  const first = decoded.split(/\s*[|–—·:-]\s+/)[0]?.trim();
  if (!first || first.length < 2) return null;
  return first.length > 48 ? first.slice(0, 48).trim() : first;
}
