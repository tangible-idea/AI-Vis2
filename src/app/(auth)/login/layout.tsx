import type { Metadata } from "next";

// the page itself is a client component; metadata lives here
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to Sightline to see how AI talks about your brand.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
