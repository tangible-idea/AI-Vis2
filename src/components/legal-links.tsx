import Link from "next/link";
import { cn } from "@/lib/utils";

export const LEGAL_PAGES = [
  { slug: "privacy", label: "Privacy" },
  { slug: "terms", label: "Terms" },
  { slug: "cookies", label: "Cookies" },
  { slug: "acceptable-use", label: "Acceptable use" },
  { slug: "refunds", label: "Refunds" },
] as const;

/** Legal footer links, shown across marketing, auth, app and share pages. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      {LEGAL_PAGES.map((p) => (
        <Link key={p.slug} href={`/legal/${p.slug}`} className="hover:text-ink">
          {p.label}
        </Link>
      ))}
    </span>
  );
}
