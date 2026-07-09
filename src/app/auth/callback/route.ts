import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation exchange endpoint. Handles both the PKCE
 * `code` flow and the `token_hash` OTP links Supabase sends for email
 * confirmation, then forwards the user into the app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  let errorMessage: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    errorMessage = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    errorMessage = error?.message ?? null;
  } else {
    errorMessage =
      url.searchParams.get("error_description") ?? "Missing confirmation code";
  }

  if (errorMessage) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", errorMessage);
    return NextResponse.redirect(loginUrl);
  }

  // New users go straight to onboarding; returning users to their dashboard.
  let destination = next;
  if (destination === "/dashboard") {
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true });
    if (!count) destination = "/onboarding";
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
