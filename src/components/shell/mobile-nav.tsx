"use client";

/**
 * The bottom bar, phones only.
 *
 * The desktop nav is a row of five pills plus a sign-out button. At 360px that
 * row needs 392px and is the single largest source of horizontal overflow in
 * the app — it pushes every page sideways. Rather than shrink it until it fits
 * (five Hebrew labels do not), phones get the pattern they expect instead: a
 * fixed bar at the bottom, thumb height, one destination per slot.
 *
 * Five slots, because that is what fits legibly at 360px: four routes and
 * `עוד`, which holds the two things that are not destinations you switch
 * between — Settings, and signing out.
 *
 * Everything here is `sm:hidden`; the desktop nav is untouched and simply
 * takes over from 640px up.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderKanban, ListChecks, MoreHorizontal, Sun, X } from "lucide-react";

import { signOut } from "@/lib/auth-actions";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

const DESTINATIONS = [
  { href: "/today", label: copy.mobileNav.today, Icon: Sun },
  { href: "/schedule", label: copy.mobileNav.schedule, Icon: CalendarDays },
  { href: "/tasks", label: copy.mobileNav.tasks, Icon: ListChecks },
  { href: "/projects", label: copy.mobileNav.projects, Icon: FolderKanban },
];

/** Routes that live behind `עוד` rather than in the bar. */
const MORE_ROUTES = ["/settings"];

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Same optimistic treatment as the desktop tabs: the slot lights on press,
  // and any change to the real route retires the guess. See `nav-tabs.tsx`.
  const [pending, setPending] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPending(null);
    if (moreOpen) setMoreOpen(false);
  }

  const shown = pending ?? pathname;
  const moreActive = MORE_ROUTES.some((r) => matches(shown, r));

  return (
    <>
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} pathname={pathname} />}

      <nav
        aria-label={copy.nav.today}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 sm:hidden",
          "border-t border-line-soft bg-surface/95 backdrop-blur-sm",
        )}
        /**
         * The bar sits on the home-indicator strip on modern phones. Padding
         * the inset — rather than adding a fixed number — keeps the row exactly
         * as tall as it needs to be on hardware that has no inset at all.
         */
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="flex items-stretch justify-around">
          {DESTINATIONS.map(({ href, label, Icon }) => {
            const active = matches(shown, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  prefetch={true}
                  onNavigate={() => setPending(href)}
                  aria-current={matches(pathname, href) ? "page" : undefined}
                  // min-h-[56px] rather than 44: the row is the primary control
                  // surface on this screen, and a 44px target with a label under
                  // an icon leaves nothing between the two.
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2",
                    "text-[11px] font-medium transition-colors",
                    active ? "text-blue" : "text-text-3",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.1 : 1.8} />
                  <span className="leading-none">{label}</span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={cn(
                "flex min-h-[56px] w-full cursor-pointer flex-col items-center justify-center gap-1 px-1 py-2",
                "text-[11px] font-medium transition-colors",
                moreActive || moreOpen ? "text-blue" : "text-text-3",
              )}
            >
              <MoreHorizontal size={21} strokeWidth={moreActive || moreOpen ? 2.1 : 1.8} />
              <span className="leading-none">{copy.mobileNav.more}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/**
 * What `עוד` opens: the things that are not destinations you flip between.
 *
 * A sheet rather than a sixth tab, because Settings is somewhere you go
 * occasionally and sign-out is not navigation at all — putting either in the
 * bar would spend a permanent slot on a rare action.
 */
function MoreSheet({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-text/25 backdrop-blur-[2px] sm:hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={copy.mobileNav.moreTitle}
    >
      <div
        className="w-full rounded-t-2xl border-t border-line-soft bg-surface pb-2 pt-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        {/* grab handle — pure affordance, tells you which way this closes */}
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" />

        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 className="text-[15px] font-semibold text-text">{copy.mobileNav.moreTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.mobileNav.close}
            className="-me-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-text-3 transition-colors hover:text-text-2"
          >
            <X size={19} strokeWidth={1.9} />
          </button>
        </div>

        <Link
          href="/settings"
          prefetch={true}
          onNavigate={onClose}
          aria-current={matches(pathname, "/settings") ? "page" : undefined}
          className={cn(
            "flex min-h-[52px] items-center px-4 text-[15px] transition-colors",
            matches(pathname, "/settings") ? "font-medium text-blue" : "text-text",
          )}
        >
          {copy.settings.title}
        </Link>

        {/* Same server action as the desktop nav — a plain form post, so it
            works without JS and needs no client handler of its own. */}
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-[52px] w-full cursor-pointer items-center px-4 text-start text-[15px] text-text-2 transition-colors hover:text-text"
          >
            {copy.auth.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
