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
import { requestPasswordReset, type AuthFormState } from "@/lib/auth-actions";
import { copy } from "@/lib/copy";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {},
  );

  // The notice is identical whether or not the address is registered, so
  // hiding the form afterwards is not a tell — it happens either way.
  const sent = Boolean(state.notice);

  return (
    <AuthCard title={copy.auth.forgotTitle} subtitle={copy.auth.forgotSubtitle}>
      {!sent && (
        <form action={action}>
          <AuthField
            label={copy.auth.email}
            name="email"
            type="email"
            autoComplete="email"
          />
          <AuthSubmit label={copy.auth.forgotAction} pending={pending} />
        </form>
      )}

      <AuthMessage error={state.error} notice={state.notice} />

      <AuthLinks>
        <AuthLink href="/login">{copy.auth.backToSignIn}</AuthLink>
      </AuthLinks>
    </AuthCard>
  );
}
