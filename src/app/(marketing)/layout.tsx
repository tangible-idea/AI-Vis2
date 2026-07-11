import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { LanguageSelector } from "@/components/language-selector";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-paper">
              S
            </span>
            <span className="font-display text-lg">Sightline</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4">
            <Link
              href="/preview"
              className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
            >
              Free preview
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-medium text-paper hover:bg-ink/85"
            >
              Start free
            </Link>
            <LanguageSelector className="hidden sm:inline-flex" />
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-ink-faint">
          <span className="font-display text-sm text-ink-soft">Sightline</span>
          <span>AI Visibility Intelligence · © 2026</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
            <Link href="/signup" className="hover:text-ink">
              Start free
            </Link>
            <LegalLinks />
          </div>
        </div>
      </footer>
    </div>
  );
}
