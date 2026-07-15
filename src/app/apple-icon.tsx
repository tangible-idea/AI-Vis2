import { ImageResponse } from "next/og";
import { SITE } from "@/lib/seo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — same mark as icon.svg, rendered as PNG at build time. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: SITE.colors.ink,
          borderRadius: 36,
          color: SITE.colors.paper,
          fontSize: 110,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
        }}
      >
        S
      </div>
    ),
    size
  );
}
