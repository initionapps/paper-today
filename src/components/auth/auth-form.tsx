"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

/**
 * The shared shape of every auth screen. Same visual language as the rest of
 * the app — cool canvas, one white card, hairline borders, blue as the only
 * accent — just centred and narrow, because there is nothing else on the page.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[380px]">
      <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.015em] text-text">
        {title}
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{subtitle}</p>

      <div className="shadow-flat mt-6 rounded-2xl border border-line-soft bg-surface p-5">
        {children}
      </div>
    </div>
  );
}

/**
 * Email and password are Latin-only content inside an RTL page. `dir="ltr"`
 * with a start-aligned value keeps the caret, the text and the placeholder
 * behaving — the same reason times are wrapped in `.ltr-run` elsewhere — while
 * the label above it stays in the page's own direction.
 */
export function AuthField({
  label,
  name,
  type,
  autoComplete,
  defaultValue,
}: {
  label: string;
  name: string;
  type: "email" | "password";
  autoComplete: string;
  defaultValue?: string;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1.5 block text-[12px] font-medium text-text-2">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        dir="ltr"
        className={cn(
          "w-full rounded-lg border border-line bg-surface px-3 py-2 text-start text-[14px] text-text",
          "outline-none transition-colors placeholder:text-text-3",
          "focus:border-blue/45 focus:ring-2 focus:ring-blue/20",
        )}
      />
    </label>
  );
}

export function AuthSubmit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "mt-5 w-full cursor-pointer rounded-lg bg-blue px-4 py-2.5 text-[14px] font-medium text-white",
        "transition-all duration-200 hover:bg-blue/90",
        "disabled:cursor-default disabled:opacity-60",
      )}
    >
      {pending ? copy.auth.working : label}
    </button>
  );
}

/** Errors are rose, confirmations are quiet — never a green success banner. */
export function AuthMessage({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "mt-4 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed",
        error ? "bg-rose/8 text-rose" : "bg-canvas text-text-2",
      )}
    >
      {error ?? notice}
    </p>
  );
}

export function AuthLinks({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-col gap-2 text-center">{children}</div>;
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12.5px] text-text-2 transition-colors hover:text-blue"
    >
      {children}
    </Link>
  );
}
