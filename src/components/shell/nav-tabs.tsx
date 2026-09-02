"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth-actions";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/today", label: copy.nav.today },
  { href: "/schedule", label: copy.nav.schedule },
  { href: "/tasks", label: copy.nav.tasks },
  { href: "/projects", label: copy.nav.projects },
  { href: "/settings", label: copy.settings.title },
];

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * Soft pills. The active one is a raised white surface, nothing more.
 *
 * The pill moves on *click*, not on arrival.
 *
 * `usePathname()` only changes once the navigation has committed, and these
 * routes are dynamic — every click waits on a server round trip before the
 * router updates. Driving the highlight from the pathname alone therefore made
 * the whole app feel slow even when it wasn't: you pressed a tab and nothing
 * acknowledged the press. The pill is now painted from an optimistic guess and
 * the pathname corrects it.
 *
 * `onNavigate` rather than `onClick` on purpose: it fires only for navigations
 * the router actually performs, so ⌘/ctrl-click and middle-click — which open
 * a new tab and leave this page where it is — do not move the pill.
 */
export function NavTabs() {
  const pathname = usePathname();

  /** Where a click says we are going, until the router says where we are. */
  const [pending, setPending] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);

  // Adjusting state during render, rather than in an effect — the pattern this
  // codebase already uses for the date picker's draft value. *Any* change to
  // the real route retires the guess, whether it arrived where we predicted or
  // somewhere else entirely (back/forward, a redirect, a second click). That is
  // also what stops a failed or cancelled navigation leaving the wrong pill
  // lit: the moment the route resolves anywhere, the guess is dropped.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPending(null);
  }

  // What to paint. The pathname is still the source of truth for *where we
  // are* — see `aria-current` below.
  const shown = pending ?? pathname;

  return (
    <nav className="mb-10 flex items-center gap-1">
      {TABS.map((tab) => {
        // /projects stays lit while you're inside /projects/<id>
        const active = matches(shown, tab.href);
        const isCurrentPage = matches(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            /**
             * Every one of these routes is dynamic — each page calls
             * `requireUser()`, which reads cookies. On the default
             * (`prefetch={null}`) a dynamic route is only prefetched as far as
             * the nearest `loading.js` boundary, and this app deliberately has
             * none: adding them stopped the production build hydrating at all.
             * So with the default, these five links prefetched *nothing* and
             * every tab click paid a full server round trip.
             *
             * `true` prefetches the whole route, boundary or not. There are
             * five links, they are always on screen, and the payload is ~2KB
             * each — the cost is trivial and it is paid before the click rather
             * than during it.
             */
            prefetch={true}
            onNavigate={() => setPending(tab.href)}
            /**
             * Deliberately the *real* pathname, not the optimistic one. The
             * pill is a visual promise; `aria-current="page"` is a factual
             * claim about which page you are on, and announcing a page change
             * before it has happened would be a lie to a screen reader. It
             * catches up a beat later, when the route commits.
             */
            aria-current={isCurrentPage ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-all duration-200",
              active
                ? "shadow-flat bg-surface text-text"
                : "text-text-2 hover:bg-surface/70 hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        );
      })}

      {/* Pushed to the inline end, away from the tabs: signing out is not a
          destination, and it should not sit in the rhythm of things you click
          to move around. A plain form post, so it works without JS. */}
      <form action={signOut} className="ms-auto">
        <button
          type="submit"
          className={cn(
            "cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] text-text-3",
            "transition-colors hover:bg-surface/70 hover:text-text-2",
          )}
        >
          {copy.auth.signOut}
        </button>
      </form>
    </nav>
  );
}
