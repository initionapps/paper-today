"use client";

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

/** Soft pills. The active one is a raised white surface, nothing more. */
export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-10 flex items-center gap-1">
      {TABS.map((tab) => {
        // /projects stays lit while you're inside /projects/<id>
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
