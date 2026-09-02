"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    </nav>
  );
}
