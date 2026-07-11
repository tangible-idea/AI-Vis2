"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { makeT, type TFunction } from "./translate";
import { persistUiLanguage } from "./actions";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

/**
 * Client i18n context. The initial locale comes from the server (cookie),
 * so server- and client-rendered strings always agree. Switching updates
 * the cookie + profile and refreshes so server components re-render too.
 */
export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      // immediate client cookie so the very next request is correct;
      // the server action then persists it (and the profile) authoritatively
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
      void persistUiLanguage(next).then(() => router.refresh());
    },
    [router]
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): I18nContextValue {
  return useContext(I18nContext);
}

/** Translation hook for client components. */
export function useT(): TFunction {
  const { locale } = useContext(I18nContext);
  return useMemo(() => makeT(locale), [locale]);
}
