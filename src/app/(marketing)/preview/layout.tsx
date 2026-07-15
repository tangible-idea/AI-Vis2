import type { Metadata } from "next";

// the page itself is a client component; metadata lives here
export const metadata: Metadata = {
  title: "Free AI visibility preview",
  description:
    "Check how AI mentions your brand — free, no account needed. We ask ChatGPT, Claude, Gemini and Perplexity the questions your buyers ask and show you where you stand in about 30 seconds.",
  alternates: { canonical: "/preview" },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
