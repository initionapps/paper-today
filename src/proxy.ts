import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * `proxy.ts`, not `middleware.ts`.
 *
 * Next 16 deprecated the `middleware` file convention and renamed it to
 * `proxy` — same behaviour, different file and export name. Every Supabase
 * guide still published says `middleware.ts` with `export function middleware`;
 * that shape is deprecated here. It lives in `src/` because `app/` does.
 *
 * All the reasoning about what belongs in this layer is in
 * `lib/supabase/proxy.ts`.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Everything except static assets — and except `/auth/*`.
   *
   * That exclusion is not tidiness. The proxy calls `getClaims()`, which
   * refreshes an expiring session before the route runs. On the auth callback
   * routes that is actively harmful: a visitor arriving with a *stale* cookie
   * makes the proxy attempt a refresh that fails
   * (`POST /token` → 400 "Refresh Token Not Found"), and that failure can
   * clear the very cookies — including the PKCE verifier — that the callback
   * is about to need. The callback and confirm routes establish the session
   * themselves; they neither need nor want one refreshed underneath them.
   */
  matcher: [
    // `env-check` is TEMPORARY, and excluded for the same class of reason as
    // `auth/`: this proxy calls `supabaseEnv()`, which throws when either
    // variable is missing, so a misconfigured deployment 500s on every matched
    // route — including the page whose whole purpose is to say what is
    // misconfigured. Remove this along with the route.
    "/((?!auth/|env-check|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
