/**
 * The two public Supabase settings, read in one place.
 *
 * Read as *literal* `process.env.NEXT_PUBLIC_…` expressions on purpose. Next
 * inlines these into the browser bundle at build time by substituting that
 * exact text, so a computed lookup (`process.env[name]`) would compile to
 * `undefined` on the client while still working on the server — the kind of
 * bug that only shows up in one half of the app.
 *
 * Both values are publishable by design. The secret/service-role key is
 * deliberately absent: nothing here may reach the browser that shouldn't.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

/**
 * Fails at the call site with a name, rather than handing a client a blank
 * URL and letting it fail later as an unexplained network error.
 */
export function supabaseEnv(): SupabaseEnv {
  if (!url || !publishableKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Supabase is not configured — missing ${missing}. ` +
        "Add it to .env.local, then restart the dev server: NEXT_PUBLIC_ values " +
        "are read at build time, so a running server won't pick up the change.",
    );
  }

  return { url, publishableKey };
}

/** True when both settings are present. For diagnostics that must not throw. */
export function hasSupabaseEnv(): boolean {
  return Boolean(url && publishableKey);
}
