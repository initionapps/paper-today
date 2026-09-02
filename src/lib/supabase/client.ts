"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/**
 * The Supabase client for anything running in the browser — client components,
 * event handlers, the store once it stops being `localStorage`.
 *
 * Marked `"use client"` for the same reason `day-store.ts` is: importing it
 * from a server component is a mistake, and this makes that a build error
 * rather than a subtle runtime one. Server code uses `./server` instead.
 *
 * Call it wherever you need a client rather than exporting a shared instance —
 * `createBrowserClient` already returns the same underlying instance per
 * URL + key, so this is cheap, and a module-level singleton would be
 * constructed at import time, before the env check could report anything
 * useful.
 */
export function createClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}
