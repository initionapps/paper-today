import { NavTabs } from "./nav-tabs";

import { cn } from "@/lib/cn";

/**
 * One bounded column on a cool canvas. The day stays finite because the column
 * is finite — not because it pretends to be a piece of paper.
 *
 * `wide` is for the Schedule alone, which needs a sidebar beside the rail.
 */
export function AppShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    // px-7 rather than px-5: the drag handles live in this gutter, and on a
    // phone there is no other margin for them to sit in
    <div
      className={cn(
        "mx-auto min-h-screen w-full px-7 pb-32 pt-10 sm:px-8 sm:pt-14",
        wide ? "max-w-[1180px]" : "max-w-[900px]",
      )}
    >
      <NavTabs />
      {children}
    </div>
  );
}
