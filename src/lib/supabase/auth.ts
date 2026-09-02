import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "./server";

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * The identity of the current request, or `null`.
 *
 * `getClaims()` rather than `getSession()`: the session is read from cookies,
 * and the SDK's own guidance is that a cookie-sourced user object must not be
 * trusted. `getClaims()` verifies the JWT signature — locally, against this
 * project's asymmetric (ES256) signing key — so the id it returns is one the
 * auth server actually issued.
 *
 * Wrapped in React's `cache()` so a render pass that checks the user in a
 * layout and again in a page verifies once, not twice.
 */
export const getOptionalUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

/**
 * The app-level authorization gate. Every protected page calls this.
 *
 * The proxy already redirects anonymous visitors, but that is a convenience:
 * it runs before the route and can be bypassed by anything that reaches a page
 * another way. This runs *in* the page, next to the data, which is where Next
 * recommends the real check lives. RLS remains the boundary underneath both —
 * if this were removed, queries would still return nothing.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}
