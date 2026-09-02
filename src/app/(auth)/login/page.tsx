"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  AuthCard,
  AuthField,
  AuthLink,
  AuthLinks,
  AuthMessage,
  AuthSubmit,
} from "@/components/auth/auth-form";
import { signIn, type AuthFormState } from "@/lib/auth-actions";
import { copy } from "@/lib/copy";

function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});

  // A dead confirmation or recovery link redirects here rather than showing a
  // blank form on a page the user can do nothing with.
  const linkError = params.get("error") === "link" ? copy.auth.linkExpired : undefined;

  return (
    <AuthCard title={copy.auth.signInTitle} subtitle={copy.auth.signInSubtitle}>
      <form action={action}>
        <input type="hidden" name="next" value={params.get("next") ?? "/today"} />
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
          autoComplete="current-password"
        />
        <AuthSubmit label={copy.auth.signInAction} pending={pending} />
      </form>

      <AuthMessage error={state.error ?? linkError} notice={state.notice} />

      <AuthLinks>
        <AuthLink href="/forgot-password">{copy.auth.toForgot}</AuthLink>
        <AuthLink href="/signup">{copy.auth.toSignUp}</AuthLink>
      </AuthLinks>
    </AuthCard>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep the route prerenderable
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
