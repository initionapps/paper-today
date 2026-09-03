import { MobileNav } from "./mobile-nav";
import { NavTabs } from "./nav-tabs";

import { cn } from "@/lib/cn";

/**
 * One bounded column on a cool canvas. The day stays finite because the column
 * is finite — not because it pretends to be a piece of paper.
 *
 * `wide` is for the Schedule alone, which needs a sidebar beside the rail.
 *
 *
 * PHONES
 *
 * Two things change below `sm`, and nothing above it:
 *
 * 1. **Gutters shrink to 16px.** `px-7` (28px) was chosen so drag handles have
 *    a margin to live in; on a 360px screen it spends 56px of a 360px viewport
 *    on empty space, which is why cards looked cramped and titles wrapped
 *    early. The handles are a pointer affordance and there is no hover on a
 *    phone, so the gutter has nothing to protect there.
 * 2. **The top runs tighter.** `pt-10` above a large title left the first
 *    actual content below the fold on a short screen.
 *
 * The bottom padding is for the fixed nav bar: content has to be able to
 * scroll clear of it, including past the home-indicator inset.
 */
export function AppShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <div
        className={cn(
          "mx-auto min-h-screen w-full px-4 pt-5 sm:px-8 sm:pt-14",
          wide ? "max-w-[1180px]" : "max-w-[900px]",
        )}
        style={{
          // Room for the bottom bar on phones; the desktop value (`pb-32`)
          // applies from `sm` up, where the bar is hidden.
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)",
        }}
      >
        <NavTabs />
        {children}
      </div>
      <MobileNav />
    </>
  );
}
