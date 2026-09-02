"use client";

import { useActionState } from "react";

import {
  AuthCard,
  AuthField,
  AuthLink,
  AuthLinks,
  AuthMessage,
  AuthSubmit,
} from "@/components/auth/auth-form";
import { updatePassword, type AuthFormState } from "@/lib/auth-actions";
import { copy } from "@/lib/copy";

/**
 * Reached only through a recovery link, which establishes a session on the way
 * in via /auth/callback. It is deliberately *not* in the proxy's AUTH_PAGES
 * list: the user is signed in by the time they arrive, and bouncing them to
 * /today would make the link useless.
 *
 * If the link was expired, already used, or opened in another browser, there
 * is no session — the action reports that rather than silently failing.
 */
export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    updatePassword,
    {},
  );

  return (
    <AuthCard title={copy.auth.resetTitle} subtitle={copy.auth.resetSubtitle}>
      <form action={action}>
        <AuthField
          label={copy.auth.newPassword}
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <AuthSubmit label={copy.auth.resetAction} pending={pending} />
      </form>

      <AuthMessage error={state.error} notice={state.notice} />

      <AuthLinks>
        <AuthLink href="/forgot-password">{copy.auth.toForgot}</AuthLink>
        <AuthLink href="/login">{copy.auth.backToSignIn}</AuthLink>
      </AuthLinks>
    </AuthCard>
  );
}
