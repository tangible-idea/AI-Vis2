import type { Metadata } from "next";

// the page itself is a client component; metadata lives here
export const metadata: Metadata = {
  title: "Start free",
  description:
    "Create a free Sightline account and run your first AI visibility scan across ChatGPT, Claude, Gemini and Perplexity in minutes.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
