import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/pricing", "/preview", "/redeem", "/how-it-works"];

export async function updateSession(request: NextRequest) {
  // Plain `next()` on purpose. `NextResponse.next({ request })` makes Next
  // buffer the whole response, which silently disables streaming for every
  // page in the app — Suspense fallbacks stop flushing early and a page is
  // held back by its slowest section. Nothing has been changed on the request
  // at this point, so forwarding it here buys nothing; the one place it is
  // genuinely needed (refreshed auth cookies) still uses it, in setAll below.
  let supabaseResponse = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // only here does the request actually differ — server components in
          // this same request must read the refreshed tokens, not the expired
          // ones. Costs streaming on token-refresh requests alone.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims verifies the JWT locally (cached JWKS) on asymmetric-key
  // projects — no auth-server round trip per request, unlike getUser().
  // Symmetric-key projects fall back to getUser() internally, and expired
  // sessions still refresh via the cookie handlers above. Middleware only
  // gates redirects; data access stays protected by RLS + per-route getUser.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/legal/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
