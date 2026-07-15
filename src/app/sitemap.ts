import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { LEGAL_DOCS } from "@/app/(marketing)/legal/content";

/** Public marketing pages only — the app itself is behind auth. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/preview", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/signup", priority: 0.6, changeFrequency: "monthly" },
    { path: "/login", priority: 0.3, changeFrequency: "monthly" },
    ...LEGAL_DOCS.map((p) => ({
      path: `/legal/${p.slug}`,
      priority: 0.2,
      changeFrequency: "yearly" as const,
    })),
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE.url}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
