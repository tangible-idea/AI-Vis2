/**
 * i18n configuration — the single place that defines supported UI locales.
 * Translations live in ./locales/*.json (static JSON, no runtime services).
 */

export const LOCALES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "简体中文" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sightline_lang";
/** localStorage flag — set once the first-visit language prompt was answered. */
export const LANG_PROMPTED_KEY = "sightline_lang_prompted";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((l) => l.code === value);
}

export function localeLabel(code: Locale): string {
  return LOCALES.find((l) => l.code === code)?.label ?? code;
}

/** Maps a BCP-47 browser language to a supported locale, or null. */
export function matchBrowserLocale(lang: string | undefined | null): Locale | null {
  if (!lang) return null;
  const base = lang.toLowerCase().split("-")[0];
  return isLocale(base) ? base : null;
}

/**
 * First-visit prompt copy, written in the *detected* language so the user
 * understands it before switching. English never prompts (it's the default).
 */
export const SUGGEST_PROMPTS: Record<Exclude<Locale, "en">, { question: string; accept: string; decline: string }> = {
  ko: { question: "Sightline을 한국어로 보시겠어요?", accept: "한국어로 전환", decline: "영어로 계속" },
  ja: { question: "Sightlineを日本語で表示しますか？", accept: "日本語に切り替える", decline: "英語のまま" },
  zh: { question: "要以简体中文显示 Sightline 吗？", accept: "切换为中文", decline: "继续使用英文" },
  th: { question: "ต้องการใช้งาน Sightline เป็นภาษาไทยไหม?", accept: "เปลี่ยนเป็นภาษาไทย", decline: "ใช้ภาษาอังกฤษต่อ" },
  vi: { question: "Bạn muốn dùng Sightline bằng tiếng Việt?", accept: "Chuyển sang tiếng Việt", decline: "Giữ tiếng Anh" },
  id: { question: "Ingin menggunakan Sightline dalam Bahasa Indonesia?", accept: "Ganti ke Bahasa Indonesia", decline: "Tetap bahasa Inggris" },
  ms: { question: "Mahu menggunakan Sightline dalam Bahasa Melayu?", accept: "Tukar ke Bahasa Melayu", decline: "Kekal bahasa Inggeris" },
};
