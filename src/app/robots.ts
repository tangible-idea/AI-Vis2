import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * Crawl policy: public marketing pages are open to every crawler (search
 * and AI alike — being cited by AI engines is the product's own advice);
 * the authenticated app, APIs and tokenized share links stay out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/share/",
          "/dashboard",
          "/monitor",
          "/prompts",
          "/sources",
          "/trends",
          "/optimize",
          "/timeline",
          "/improve",
          "/benchmarks",
          "/reports",
          "/billing",
          "/settings",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
