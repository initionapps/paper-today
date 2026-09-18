"use client";

/**
 * The annual map: a rolling 12-month window × projects × up to three things
 * that matter. Two surfaces over one set of state. The matrix is for *seeing*
 * the window; the month panel is for *writing* one month of it. Which of the
 * two you get is decided by the viewport in CSS rather than by a stored flag,
 * so there is no viewport guess to get wrong during hydration:
 *
 *   desktop, no month open   matrix          (month panel is `sm:hidden`)
 *   desktop, month open      month panel
 *   phone,   default         month panel     (matrix is `hidden sm:block`)
 *   phone,   matrix asked for matrix
 *
 * Each component is rendered once. The alternative — rendering both and letting
 * media queries pick — would put a second copy of every cell in the DOM.
 *
 * The window (`windowStart`, below) and the month panel's open month
 * (`openMonth`) are deliberately two independent pieces of state, not one
 * renamed. Before the window could roll, both surfaces shared a single `year`
 * — harmless, because "year" was the only context either surface had. Once the
 * matrix can show 12 months straddling two calendar years, that coupling would
 * mean shifting the window by one month could silently relocate whatever month
 * the panel had open by a whole year. So the window shifts by month, the open
 * month steps by month, and neither one moves the other — see the longer note
 * on `YearHeader`.
 *
 * Both live here as plain state, not in the URL — the same choice the
 * Schedule makes for its day, and for the same reason: every route in this
 * app is dynamic, so routing a month change would spend a server round trip
 * on something that is already in memory. The cost is that a month is not
 * linkable and the browser's back button leaves the page rather than closing
 * the panel, which is why the way back is always on screen rather than
 * implied.
 */
import { useState } from "react";

import { useDayStore, activeProjects } from "@/lib/store/day-store";
import { useAccountReady } from "@/lib/supabase/account";
import { monthOf, shiftMonth, todayKey, yearOf } from "@/lib/date";
import { cn } from "@/lib/cn";

import { AnnualMatrix } from "./annual-matrix";
import { MonthFocus } from "./month-focus";
import { YearHeader } from "./year-header";

/** A (year, 1-based month) pair — the shared shape for both the matrix's
 * rolling window anchor and the month panel's open cell. */
type MonthCell = { year: number; month: number };

export function YearView() {
  const hydrated = useAccountReady();

  const today = todayKey();
  const thisYear = yearOf(today);
  const thisMonth = monthOf(today);
  const todayCell: MonthCell = { year: thisYear, month: thisMonth };

  /** The window's default anchor: 2 months back, the current month, then 9
   * forward. A pure current-month-first window was tried first and read as
   * forward-only planning with no way to see what led into it — a goal you're
   * mid-way through in, say, November needs September and October on screen
   * to make sense of, not just the nine months still ahead. 2 back rather
   * than more keeps the emphasis on what's ahead (9 of the 12 months), which
   * is still the point of an annual *planning* view. */
  const defaultWindowStart = shiftMonth(thisYear, thisMonth, -2);

  /** The first of the 12 months the matrix currently shows. Anchored on
   * `defaultWindowStart` — see the note in `YearHeader` for why this is
   * independent of `openMonth`. */
  const [windowStart, setWindowStart] = useState<MonthCell>(defaultWindowStart);
  /** `null` = no month has been opened; the phone still shows the current one. */
  const [openMonth, setOpenMonth] = useState<MonthCell | null>(null);
  /** Phones only: the matrix was asked for explicitly. */
  const [matrixOnPhone, setMatrixOnPhone] = useState(false);

  const projects = useDayStore((s) => s.projects);
  const monthlyFocus = useDayStore((s) => s.monthlyFocus);
  const goals = useDayStore((s) => s.goals);
  const goalMonthlyFocus = useDayStore((s) => s.goalMonthlyFocus);
  const goalMonthlyKpi = useDayStore((s) => s.goalMonthlyKpi);

  // Archived projects keep their focus rows in the database — archiving sets a
  // timestamp and deletes nothing — they simply stop being listed here, and
  // restoring the project brings its column back with the data still in it.
  const active = activeProjects(projects);

  const cell = openMonth ?? todayCell;

  /** Step the month panel by one month, rolling the year over at either end.
   * Does not touch the matrix's window — see the file-level note above. */
  const stepMonth = (delta: number) => {
    setOpenMonth(shiftMonth(cell.year, cell.month, delta));
  };

  /** One control, both surfaces: close the month on desktop, open the matrix on a phone. */
  const showYear = () => {
    setOpenMonth(null);
    setMatrixOnPhone(true);
  };

  const openMonthPanel = (target: MonthCell) => {
    setOpenMonth(target);
    setMatrixOnPhone(false);
  };

  if (!hydrated) return <div className="min-h-[70vh]" />;

  const isDefaultWindow =
    windowStart.year === defaultWindowStart.year && windowStart.month === defaultWindowStart.month;

  return (
    <>
      <YearHeader
        start={windowStart}
        end={shiftMonth(windowStart.year, windowStart.month, 11)}
        isCurrent={isDefaultWindow}
        onPrev={() => setWindowStart((w) => shiftMonth(w.year, w.month, -1))}
        onNext={() => setWindowStart((w) => shiftMonth(w.year, w.month, 1))}
        onToday={() => setWindowStart(defaultWindowStart)}
      />

      {openMonth === null && (
        <div className={matrixOnPhone ? "block" : "hidden sm:block"}>
          <AnnualMatrix
            projects={active}
            goals={goals}
            goalMonthlyFocus={goalMonthlyFocus}
            goalMonthlyKpi={goalMonthlyKpi}
            windowStart={windowStart}
            today={todayCell}
            onOpenMonth={openMonthPanel}
          />
        </div>
      )}

      <div
        className={cn(
          openMonth === null
            ? matrixOnPhone
              ? "hidden"
              : "sm:hidden"
            : "block",
        )}
      >
        <MonthFocus
          projects={active}
          focus={monthlyFocus}
          goals={goals}
          goalMonthlyFocus={goalMonthlyFocus}
          goalMonthlyKpi={goalMonthlyKpi}
          year={cell.year}
          month={cell.month}
          isCurrentMonth={cell.year === thisYear && cell.month === thisMonth}
          onPrevMonth={() => stepMonth(-1)}
          onNextMonth={() => stepMonth(1)}
          onShowYear={showYear}
        />
      </div>
    </>
  );
}
