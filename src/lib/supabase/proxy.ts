import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "./env";

/** Everything behind the nav. Unauthenticated visitors get sent to /login. */
const PROTECTED = ["/today", "/schedule", "/tasks", "/projects", "/settings"];

/** The auth pages themselves. A signed-in visitor has no business here. */
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Refreshes the Supabase session cookie and performs an *optimistic* redirect.
 *
 * Two things make this necessary rather than optional:
 *
 * 1. A server component cannot write cookies. Something has to sit in front of
 *    the render to rotate an expiring access token and write the new one back,
 *    or the session dies silently mid-visit.
 * 2. Next 16 is explicit that a proxy "should not be used as a full session
 *    management or authorization solution" and must avoid database calls,
 *    because it runs on every request including prefetches.
 *
 * Those two would normally fight: the usual Supabase recipe calls `getUser()`
 * here, which is a network round-trip to the auth server on every navigation.
 * This project's JWTs are signed with an **asymmetric key (ES256)**, so
 * `getClaims()` verifies the token locally against cached JWKS — a real
 * cryptographic check with no request to Supabase — and still refreshes the
 * session through the `setAll` handler when the token is close to expiry.
 *
 * The redirect here is a convenience, not the security boundary. The gate is
 * `requireUser()` in each protected page, and the guarantee underneath both is
 * RLS. If this file were deleted, no data would leak.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Written twice on purpose: onto the request so this render sees the
        // refreshed token, and onto a fresh response so the browser is told
        // about it too. Skipping either is the classic "logged out at random"
        // bug in the Supabase SSR setup.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Local verification. Also refreshes and re-writes the cookie when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;

  if (!signedIn && startsWithAny(pathname, PROTECTED)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    // so the user lands where they were going, once they're in
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  if (signedIn && startsWithAny(pathname, AUTH_PAGES)) {
    const to = request.nextUrl.clone();
    to.pathname = "/today";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return response;
}
