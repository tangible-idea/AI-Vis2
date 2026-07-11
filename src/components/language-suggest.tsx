"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import {
  LANG_PROMPTED_KEY,
  LOCALE_COOKIE,
  matchBrowserLocale,
  SUGGEST_PROMPTS,
  type Locale,
} from "@/lib/i18n/config";

/**
 * First-visit language suggestion. If the browser language is a supported
 * non-English locale and the visitor has never chosen a language, offer a
 * small non-intrusive prompt — never switch automatically.
 */
export function LanguageSuggest() {
  const { locale, setLocale } = useLocale();
  const [suggested, setSuggested] = useState<Exclude<Locale, "en"> | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(LANG_PROMPTED_KEY)) return;
      if (document.cookie.includes(`${LOCALE_COOKIE}=`)) return; // already chose
      const detected = matchBrowserLocale(navigator.language);
      if (detected && detected !== "en" && detected !== locale) {
        setSuggested(detected as Exclude<Locale, "en">);
      }
    } catch {
      // storage unavailable — skip the prompt
    }
  }, [locale]);

  if (!suggested) return null;
  const prompt = SUGGEST_PROMPTS[suggested];

  function answer(accept: boolean) {
    try {
      localStorage.setItem(LANG_PROMPTED_KEY, "1");
    } catch {}
    if (accept && suggested) setLocale(suggested);
    setSuggested(null);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs animate-rise rounded-xl border border-line bg-surface p-4 shadow-pop">
      <p className="text-sm font-medium text-ink">🌐 {prompt.question}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => answer(true)}
          className="cursor-pointer rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-ink/85"
        >
          {prompt.accept}
        </button>
        <button
          onClick={() => answer(false)}
          className="cursor-pointer rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-hover"
        >
          {prompt.decline}
        </button>
      </div>
    </div>
  );
}
