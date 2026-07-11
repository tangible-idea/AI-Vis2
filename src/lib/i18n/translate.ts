import type { Locale } from "./config";
import en from "./locales/en.json";
import ko from "./locales/ko.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import th from "./locales/th.json";
import vi from "./locales/vi.json";
import id from "./locales/id.json";
import ms from "./locales/ms.json";

type Dict = { [key: string]: string | Dict };

const DICTIONARIES: Record<Locale, Dict> = { en, ko, ja, zh, th, vi, id, ms };

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Resolves a translation key with {var} interpolation.
 * Fallback chain: locale → English → the key itself (never blank).
 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const raw = lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES.en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

export function makeT(locale: Locale): TFunction {
  return (key, vars) => translate(locale, key, vars);
}
