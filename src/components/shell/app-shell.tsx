import { MobileNav } from "./mobile-nav";
import { NavTabs } from "./nav-tabs";

import { cn } from "@/lib/cn";

/**
 * One bounded column on a cool canvas. The day stays finite because the column
 * is finite — not because it pretends to be a piece of paper.
 *
 * Three widths, because three screens genuinely need different room:
 *
 *   reading  900px   the default. A column you read down.
 *   wide    1180px   the Schedule: a sidebar beside the rail.
 *   matrix  1520px   the annual view, and only it.
 *
 * `matrix` exists because months of *readable text* do not fit in a reading
 * column. The annual matrix scrolls sideways on any screen by design — its
 * month column is sized to be read (160px), not to make twelve fit — so this
 * width is not there to prevent the scroll. It decides how much of the year
 * is in view before it: 1520 minus the 176px project column is 8.4 month
 * columns, about eight months. At `wide`'s 1180 it would have been five and a
 * half, which is too little of a year to plan against.
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
const MAX_WIDTH = {
  reading: "max-w-[900px]",
  wide: "max-w-[1180px]",
  matrix: "max-w-[1520px]",
} as const;

export function AppShell({
  children,
  width = "reading",
}: {
  children: React.ReactNode;
  width?: keyof typeof MAX_WIDTH;
}) {
  return (
    <>
      <div
        className={cn(
          "mx-auto min-h-screen w-full px-4 pt-5 sm:px-8 sm:pt-14",
          MAX_WIDTH[width],
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
