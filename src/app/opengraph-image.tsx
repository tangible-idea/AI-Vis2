import { ImageResponse } from "next/og";
import { SITE } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE.name} — ${SITE.tagline}`;

/**
 * Default social preview for every page (Twitter/X reuses it via
 * summary_large_image). Night background + accent green, matching the
 * marketing hero.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: SITE.colors.night,
          color: SITE.colors.paper,
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: SITE.colors.paper,
              color: SITE.colors.night,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 44 }}>{SITE.name}</div>
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 72,
            lineHeight: 1.1,
            maxWidth: 950,
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          <span>Does AI</span>
          <span style={{ color: SITE.colors.green, fontStyle: "italic" }}>recommend</span>
          <span>your brand?</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            color: "rgba(250, 249, 246, 0.65)",
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          AI visibility monitoring across ChatGPT, Claude, Gemini, Perplexity and Google AI
          Overviews — with concrete actions to improve it.
        </div>
      </div>
    ),
    size
  );
}
