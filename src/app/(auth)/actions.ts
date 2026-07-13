"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  /** Set when a confirmation email was sent and the user must verify. */
  sent?: boolean;
  email?: string;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return (
    h.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

export async function login(_prev: AuthState | null, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: error.message };
  redirect(String(formData.get("next") || "/dashboard"));
}

export async function signup(
  _prev: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const origin = await siteOrigin();
  // only allow internal destinations (e.g. /redeem for lifetime activation)
  const rawNext = String(formData.get("next") ?? "");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/onboarding";

  const { data, error } = await supabase.auth.signUp({
    email,
    password: String(formData.get("password")),
    options: {
      data: { full_name: String(formData.get("name") ?? "") },
      // Confirmation links land on /auth/callback, which exchanges the code
      // and forwards the user onward.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message };

  // Email confirmation enabled → no session yet; tell the user to check mail.
  if (!data.session) return { sent: true, email };

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
