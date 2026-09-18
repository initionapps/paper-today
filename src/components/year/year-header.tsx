"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { shortMonthName } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

/**
 * The visible 12-month range, and the two arrows that shift it by one month.
 * Deliberately the same shape as the Schedule's day header — title on one
 * side, prev / here / next on the other — so the two time-navigating screens
 * are learned once.
 *
 * `start`/`end` are the window's first and last months, not a calendar year —
 * see the note on `windowStart` in `year-view.tsx` for why this is a genuinely
 * different piece of state from the month panel's own prev/next, not the same
 * one renamed. Shifting this window by a month must not also relocate whatever
 * month the panel happens to have open: the two used to share one `year` when
 * the view was a fixed Jan–Dec grid, where that coupling was harmless because
 * a "year" was the only thing either surface could mean by "context." Once the
 * window can straddle two calendar years, keeping them coupled would make a
 * one-month window nudge silently jump the open panel by a whole year instead
 * — worse than doing nothing, so the two are independent state instead.
 */
export function YearHeader({
  start,
  end,
  isCurrent,
  onPrev,
  onNext,
  onToday,
}: {
  start: { year: number; month: number };
  end: { year: number; month: number };
  /** Whether the window sits at its default anchor (2 months back from the
   * real current month) — not whether `start` itself is the current month,
   * since the default no longer puts the current month first. This is what
   * disables the "today" control, so "already there" has to mean "already at
   * the window `onToday` would produce," not "starts on today's month." */
  isCurrent: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const sameYear = start.year === end.year;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 sm:gap-4">
      <div>
        <h1 className="font-display text-[1.5rem] font-bold leading-tight tracking-[-0.022em] text-text sm:text-[2.1rem]">
          {copy.year.title}
        </h1>
        {/* Only the numeric years are isolated, not the whole line — this is
            Hebrew text with two numbers in it, not a bare number the way the
            single-year label used to be, so forcing the whole thing ltr would
            flip the month abbreviations themselves. */}
        <p className="mt-0.5 text-[13px] text-text-2 sm:mt-1 sm:text-[13.5px]">
          {shortMonthName(start.month)}
          {!sameYear && (
            <>
              {" "}
              <span className="ltr-run tabular-nums">{start.year}</span>
            </>
          )}
          {" – "}
          {shortMonthName(end.month)} <span className="ltr-run tabular-nums">{end.year}</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        {/* RTL: previous is to the right, so the chevrons read outward. */}
        <NavButton label={copy.year.prevRange} onClick={onPrev}>
          <ChevronRight size={17} strokeWidth={1.8} />
        </NavButton>
        <button
          type="button"
          onClick={onToday}
          disabled={isCurrent}
          className={cn(
            "rounded-full border px-3.5 text-[13px] font-medium transition-colors",
            "min-h-11 sm:min-h-0 sm:py-1.5",
            isCurrent
              ? "cursor-default border-line-soft bg-canvas text-text-3"
              : "shadow-flat cursor-pointer border-line bg-surface text-text-2 hover:border-blue/35 hover:text-blue",
          )}
        >
          {copy.year.today}
        </button>
        <NavButton label={copy.year.nextRange} onClick={onNext}>
          <ChevronLeft size={17} strokeWidth={1.8} />
        </NavButton>
      </div>
    </header>
  );
}

/** 44px on a phone, 32px from `sm` up — the same control the Schedule uses. */
function NavButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-surface hover:text-text-2 sm:h-8 sm:w-8"
    >
      {children}
    </button>
  );
}
