/**
 * Shared site identity for SEO / AI discoverability — the single source of
 * truth behind metadata, robots, sitemap, manifest, llms.txt and JSON-LD.
 */

export const SITE = {
  name: "Sightline",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.app",
  title: "Sightline — AI Visibility Monitoring & AI Search Optimization",
  tagline: "See how AI talks about your brand — and improve it",
  description:
    "Sightline monitors your brand's visibility across ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews, benchmarks you against competitors, and generates the content that improves how AI search recommends you.",
  themeColor: "#faf9f6",
  /** Brand marks (match the in-app logo: ink square, paper "S", accent green). */
  colors: { ink: "#1c1b16", paper: "#faf9f6", accent: "#0e7b43", night: "#14130f", green: "#35d07f" },
} as const;

/** Serializes a JSON-LD object for a <script type="application/ld+json"> tag. */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
