"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { copy } from "@/lib/copy";

/** Supabase's own minimum. Stated here so the message can say the number. */
const MIN_PASSWORD = 6;

export interface AuthFormState {
  error?: string;
  notice?: string;
}

const readCredentials = (formData: FormData) => ({
  email: String(formData.get("email") ?? "").trim(),
  password: String(formData.get("password") ?? ""),
});

/**
 * Records why an auth call failed, without letting that reach the user.
 *
 * The messages these actions return are deliberately vague — they must not
 * reveal whether an address is registered. That vagueness is for the browser,
 * not for us: `over_email_send_rate_limit` and "wrong password" are the same
 * sentence on screen and must not be the same thing in the logs. Never logs
 * the address or the password.
 */
function logAuthFailure(operation: string, error: { message: string; code?: string; status?: number } | null) {
  if (!error) return;
  console.error(
    `[auth] ${operation} failed — code=${error.code ?? "?"} status=${error.status ?? "?"}: ${error.message}`,
  );
}

/** Absolute URL for email links, derived from the request rather than hardcoded. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email) return { error: copy.auth.emailRequired };
  if (!password) return { error: copy.auth.passwordRequired };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logAuthFailure("signInWithPassword", error);
    // Distinguish only the one case the user can act on. Everything else
    // collapses to the same message so a wrong password and an unknown
    // address are indistinguishable.
    if (error.code === "email_not_confirmed") {
      return { error: copy.auth.emailNotConfirmed };
    }
    return { error: copy.auth.invalidCredentials };
  }

  const next = String(formData.get("next") ?? "") || "/today";
  // only ever an in-app path — an absolute URL here would be an open redirect
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/today");
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email) return { error: copy.auth.emailRequired };
  if (password.length < MIN_PASSWORD) {
    return { error: copy.auth.passwordTooShort(MIN_PASSWORD) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=/today` },
  });

  if (error) {
    logAuthFailure("signUp", error);
    if (error.code === "weak_password") {
      return { error: copy.auth.passwordTooShort(MIN_PASSWORD) };
    }
    return { error: copy.auth.genericError };
  }

  // Email confirmation is enabled, so there is no session yet. The profiles
  // row already exists by now — the trigger on auth.users fired on insert.
  return { notice: copy.auth.confirmSent };
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: copy.auth.emailRequired };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Points at the token_hash route, not the PKCE one. A recovery link is
    // routinely opened somewhere other than where it was requested — another
    // browser, a phone — and the PKCE exchange cannot work there, because the
    // code verifier cookie lives in the browser that submitted the form. The
    // token hash carries its own proof and verifies from anywhere.
    //
    // This only takes effect once the "Reset Password" email template points
    // here too; see docs/SCHEMA.md is not the place — the template lives in
    // the Supabase dashboard under Authentication → Emails.
    redirectTo: `${await origin()}/auth/confirm?next=/reset-password`,
  });

  // The *response* is never shown to the user — reporting success only for
  // registered addresses would turn this form into an account-existence
  // oracle. But it must still be recorded: swallowing it entirely made a
  // rate-limited send look identical to a delivered one, and left nothing to
  // diagnose from. Server-side only; the caller's message never changes.
  logAuthFailure("resetPasswordForEmail", error);

  return { notice: copy.auth.resetSent };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) {
    return { error: copy.auth.passwordTooShort(MIN_PASSWORD) };
  }

  const supabase = await createClient();

  // The recovery link established a session on the way in. Without one the
  // link was expired, already used, opened in a different browser — or revoked
  // out from under it by a global sign-out elsewhere.
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    logAuthFailure("getClaims (reset)", claimsError);
    return { error: copy.auth.linkExpired };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // The gap that hid `403 Session not found` behind "something went wrong".
    logAuthFailure("updateUser", error);
    return {
      error: error.code === "weak_password"
        ? copy.auth.passwordTooShort(MIN_PASSWORD)
        : copy.auth.genericError,
    };
  }

  redirect("/today");
}

export async function signOut() {
  const supabase = await createClient();

  // `scope: "local"` — sign out *this* session only.
  //
  // The SDK's default is `global`, which revokes every session the user has
  // anywhere. That is almost never what "Log out" means on a personal app:
  // closing the tab on a laptop should not sign you out on your phone. It also
  // reaches sessions the user is not looking at, including a live password
  // recovery session — which is exactly how a recovery link that had just
  // verified successfully ended up failing its password update with
  // `403 Session not found`.
  //
  // Use `global` only for a deliberate "sign out everywhere" control, and give
  // it its own button so the reach is the user's choice.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  logAuthFailure("signOut", error);

  redirect("/login");
}
