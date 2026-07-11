import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { makeT, type TFunction } from "./translate";

/** Current UI locale for server components (cookie-based, defaults to English). */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Translation function for server components: `const t = await getT()`. */
export async function getT(): Promise<TFunction> {
  return makeT(await getLocale());
}
