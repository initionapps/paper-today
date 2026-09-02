import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * The token-hash alternative to /auth/callback.
 *
 * Not used by the stock email templates, and not required — but the PKCE code
 * exchange in /auth/callback needs the verifier cookie set by the browser that
 * *started* the flow, so signing up on a laptop and opening the email on a
 * phone cannot complete there. This route verifies a `token_hash` directly and
 * works from any device.
 *
 * To switch, point the email templates at
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .EmailActionType }}
 * Leaving the templates alone keeps /auth/callback in charge; both can coexist.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/today";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/today";

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "link");

  if (!tokenHash || !type) {
    console.error(
      `[auth] confirm rejected — hasTokenHash=${Boolean(tokenHash)} type=${type ?? "none"}`,
    );
    return NextResponse.redirect(failed);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error(
      `[auth] verifyOtp failed — code=${error.code ?? "?"} status=${error.status ?? "?"} ` +
        `type=${type}: ${error.message}`,
    );
    return NextResponse.redirect(failed);
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
