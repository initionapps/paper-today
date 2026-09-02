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
import { signUp, type AuthFormState } from "@/lib/auth-actions";
import { copy } from "@/lib/copy";

export default function SignUpPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  // Email confirmation is on, so a successful signup returns no session and
  // no redirect — it returns a notice. Hide the form once that happens, or the
  // page invites a second submission that would only error.
  const done = Boolean(state.notice);

  return (
    <AuthCard title={copy.auth.signUpTitle} subtitle={copy.auth.signUpSubtitle}>
      {!done && (
        <form action={action}>
          <AuthField
            label={copy.auth.email}
            name="email"
            type="email"
            autoComplete="email"
          />
          <AuthField
            label={copy.auth.password}
            name="password"
            type="password"
            autoComplete="new-password"
          />
          <AuthSubmit label={copy.auth.signUpAction} pending={pending} />
        </form>
      )}

      <AuthMessage error={state.error} notice={state.notice} />

      <AuthLinks>
        <AuthLink href="/login">{copy.auth.toSignIn}</AuthLink>
      </AuthLinks>
    </AuthCard>
  );
}
