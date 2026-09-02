"use client";

import { copy } from "@/lib/copy";
import { longDate, weekdayName } from "@/lib/date";
import type { DayKey } from "@/lib/types";

export function DayHeader({ day, done, total }: { day: DayKey; done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-[-0.025em] text-text">
          {weekdayName(day)}
        </h1>
        <p className="mt-1.5 text-[14px] text-text-2">{longDate(day)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3 pb-2">
        <span className="text-[13px] tabular-nums text-text-2">
          {total === 0 ? copy.header.empty : copy.header.progress(done, total)}
        </span>
        {total > 0 && (
          <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
            <span
              className="block h-full rounded-full bg-green transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </div>
    </header>
  );
}
