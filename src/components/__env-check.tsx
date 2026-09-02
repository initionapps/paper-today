"use client";

/**
 * TEMPORARY production diagnostic — the browser half.
 *
 * This answers the one question the server cannot: what did the *build* bake
 * into the client bundle? `NEXT_PUBLIC_` values are not read from the
 * environment in the browser — Next substitutes the literal text
 * `process.env.NEXT_PUBLIC_X` with a string at build time. So a variable added
 * to Vercel *after* the last deployment is present for server code at runtime
 * and absent from the browser bundle, and only comparing the two shows it.
 *
 * Reads the literals directly rather than through `supabaseEnv()`, which throws
 * when something is missing — a diagnostic must report, not crash.
 */
import { FactsTable, factsFrom } from "@/lib/env-facts";

// Must be the literal expressions, or Next will not substitute them.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function BrowserEnvFacts() {
  return <FactsTable title="Browser bundle (inlined at build time)" facts={factsFrom(url, key)} />;
}
