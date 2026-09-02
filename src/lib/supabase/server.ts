import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseEnv } from "./env";

/**
 * The Supabase client for server components, server actions and route
 * handlers. Importing `next/headers` is what keeps this off the client: a
 * client component that imports this file fails to build, which is the point.
 *
 * **Create a new one per request — never share it across requests.** It is
 * bound to *this* request's cookies, so a cached instance would serve one
 * visitor's session to another.
 *
 * `cookies()` is async in Next 16, hence the `await`. There is no auth yet, so
 * nothing writes cookies today; `setAll` is wired up anyway because the client
 * warns when it needs to write and can't, and the omission is a documented
 * source of hard-to-debug session bugs once auth does land.
 */
export async function createClient() {
  const { url, publishableKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Thrown when called while rendering a server component, where the
          // response headers are already on their way out. Safe to ignore:
          // cookies can only be set from a server action or route handler, and
          // once auth exists a middleware will do the refreshing instead.
        }
      },
    },
  });
}
