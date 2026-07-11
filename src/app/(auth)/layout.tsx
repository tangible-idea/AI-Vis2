import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { LanguageSelector } from "@/components/language-selector";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dot-grid relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-sm font-bold text-paper">
          S
        </span>
        <span className="font-display text-xl">Sightline</span>
      </Link>
      {children}
      <LegalLinks className="mt-8 justify-center text-xs text-ink-faint" />
    </div>
  );
}
