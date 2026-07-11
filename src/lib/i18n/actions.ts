"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "./config";

/**
 * Persists the UI language: cookie for everyone, profile column for
 * authenticated users so the preference follows them across devices.
 */
export async function persistUiLanguage(locale: string) {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ ui_language: locale }).eq("id", user.id);
  }
}
