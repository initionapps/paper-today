import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * The PKCE landing route: Supabase's verify endpoint bounces here with a
 * `code`, which is exchanged for a session.
 *
 * **Its weakness is structural.** The exchange needs the code verifier cookie
 * that was set in the browser which *started* the flow. Open the email on a
 * different device — or, as happened here, in a different browser from the one
 * that submitted the form — and there is no verifier to exchange with, so a
 * perfectly valid link fails. `/auth/confirm` exists for exactly that reason
 * and is the flow the email templates should point at.
 *
 * Everything that fails lands on /login with a flag, so the page can explain
 * itself rather than showing a blank form. Failures are logged with their real
 * code: an expired link, a consumed link and a missing verifier are the same
 * sentence on screen and must not be the same thing in the log.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/today";

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "link");

  const supabaseError = searchParams.get("error");
  if (supabaseError || !code) {
    console.error(
      `[auth] callback rejected before exchange — supabase_error=${supabaseError ?? "none"} ` +
        `error_code=${searchParams.get("error_code") ?? "?"} hasCode=${Boolean(code)}`,
    );
    return NextResponse.redirect(failed);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(
      `[auth] exchangeCodeForSession failed — code=${error.code ?? "?"} ` +
        `status=${error.status ?? "?"} next=${safeNext}: ${error.message}`,
    );
    return NextResponse.redirect(failed);
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
