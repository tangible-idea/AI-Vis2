/**
 * Competitor identity resolution. Competitors are entered as domains/URLs;
 * we derive a display name from the site's <title> when reachable, falling
 * back to a cleaned-up domain. Favicons come from Google's public favicon
 * service (no API key) with a letter placeholder as final fallback.
 */

export interface ResolvedCompetitor {
  name: string;
  website: string; // normalized https:// origin
  domain: string;
}

/** Extracts a bare domain from free-form input ("https://x.com/a", "x.com"). */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    // require a dot so plain names ("acme") aren't treated as domains
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** "acme-corp.co.uk" → "Acme Corp" — the offline fallback name. */
export function nameFromDomain(domain: string): string {
  const base = domain.split(".")[0];
  return base
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
 * Resolves free-form competitor input to { name, website }. Domain inputs
 * get a title fetch (short timeout, best-effort); plain names pass through.
 */
export async function resolveCompetitorInput(
  input: string
): Promise<{ name: string; website: string | null }> {
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
