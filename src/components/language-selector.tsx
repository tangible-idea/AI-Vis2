"use client";

import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { isLocale, localeLabel, LOCALES, type Locale } from "@/lib/i18n/config";

/** 🌐 language dropdown — shown top-right across marketing, auth and app. */
export function LanguageSelector({ className }: { className?: string }) {
  const { locale, setLocale, pending } = useLocale();

  return (
    <span className={`relative inline-flex items-center ${className ?? ""}`}>
      <span aria-hidden className="pointer-events-none absolute left-2 text-sm leading-none">
        🌐
      </span>
      <select
        value={locale}
        onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
        aria-label="Language"
        className={`cursor-pointer appearance-none rounded-lg border border-line bg-surface py-1.5 pl-8 pr-7 text-xs font-medium text-ink-soft hover:bg-hover hover:text-ink focus:outline-none ${pending ? "animate-pulse opacity-60" : ""}`}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-ink-faint" />
    </span>
  );
}

/**
 * One-shot sync: applies the authenticated user's saved profile language
 * when it differs from the device (e.g. first visit on a new device).
 */
export function SyncLanguage({ profileLanguage }: { profileLanguage: string | null }) {
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    if (profileLanguage && isLocale(profileLanguage) && profileLanguage !== locale) {
      setLocale(profileLanguage as Locale);
    }
    // run once on mount — profile language wins over an unset/stale device cookie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export { localeLabel };
