"use client";

import { useMemo, useState } from "react";
import { Clock, Plus, X } from "lucide-react";

import { Popover, PopoverLabel } from "@/components/ui/popover";
import { useDayStore } from "@/lib/store/day-store";
import { DAY_MIN, MIN_BLOCK_MIN as MIN_SPAN, formatClock, parseClock } from "@/lib/schedule";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey } from "@/lib/types";

/**
 * Availability for the selected day. Windows are stored merged, so editing one
 * to overlap another quietly collapses them into a single window rather than
 * double-counting the day's capacity.
 */
export function WorkHoursEditor({ day, className }: { day: DayKey; className?: string }) {
  const [open, setOpen] = useState(false);
  // select the raw slice; deriving inside the selector would hand zustand a new
  // array every render and spin useSyncExternalStore forever
  const allWindows = useDayStore((s) => s.workWindows);
  const setWorkWindows = useDayStore((s) => s.setWorkWindows);
  const mergeWorkWindows = useDayStore((s) => s.mergeWorkWindows);
  /**
   * Store order, deliberately *not* sorted by start time. Sorting here would
   * re-order the rows mid-edit — type "1" of "13:00" and the row jumps above
   * its neighbour, so the "3" lands in a different window. Chronological order
   * is restored when the editor closes.
   */
  const windows = useMemo(
    () => allWindows.filter((w) => w.day === day),
    [allWindows, day],
  );

  const write = (next: { id?: string; startMin: number; endMin: number }[]) =>
    setWorkWindows(day, next);

  /**
   * Editing one edge nudges the other rather than ever dropping the row.
   * Deleting a window because it was momentarily inverted mid-typing is how
   * you lose work you meant to keep.
   */
  const patch = (index: number, field: "startMin" | "endMin", value: string) => {
    const min = parseClock(value);
    if (min === null) return;

    write(
      windows.map((w, i) => {
        if (i !== index) return w;
        if (field === "startMin") {
          const startMin = Math.min(min, DAY_MIN - MIN_SPAN);
          return { ...w, startMin, endMin: Math.max(w.endMin, startMin + MIN_SPAN) };
        }
        const endMin = Math.max(min, MIN_SPAN);
        return { ...w, endMin, startMin: Math.min(w.startMin, endMin - MIN_SPAN) };
      }),
    );
  };

  // overlaps are tidied once, on the way out
  const close = () => {
    setOpen(false);
    mergeWorkWindows(day);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] transition-colors",
          windows.length === 0
            ? "text-amber hover:bg-amber/10"
            : "text-text-3 hover:bg-surface hover:text-text-2",
        )}
      >
        <Clock size={13} strokeWidth={1.8} />
        {windows.length === 0
          ? copy.schedule.workHoursEmpty
          : windows.map((w) => `${formatClock(w.startMin)}–${formatClock(w.endMin)}`).join(" · ")}
      </button>

      <Popover open={open} onClose={close} className="w-72">
        <PopoverLabel>{copy.schedule.workHours}</PopoverLabel>

        <div className="flex flex-col gap-1.5 px-2 pb-2 pt-1">
          {windows.map((w, index) => (
            <div key={w.id} className="flex items-center gap-1.5">
              <TimeField
                value={w.startMin}
                ariaLabel={copy.a11y.blockStart}
                onChange={(v) => patch(index, "startMin", v)}
              />
              <span className="text-[12px] text-text-3">–</span>
              <TimeField
                value={w.endMin}
                ariaLabel={copy.a11y.blockEnd}
                onChange={(v) => patch(index, "endMin", v)}
              />
              <button
                type="button"
                aria-label={copy.schedule.removeWindow}
                onClick={() => write(windows.filter((_, i) => i !== index))}
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-3 transition-colors hover:bg-canvas hover:text-rose"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}

          {windows.length === 0 && (
            <button
              type="button"
              onClick={() => write([{ startMin: 9 * 60, endMin: 17 * 60 }])}
              className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-blue/35 hover:bg-blue-soft hover:text-blue"
            >
              {copy.schedule.setDefaultHours}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const last = windows[windows.length - 1];
              const start = last ? Math.min(last.endMin + 30, DAY_MIN - 60) : 9 * 60;
              write([...windows, { startMin: start, endMin: Math.min(start + 120, DAY_MIN) }]);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-text-3 transition-colors hover:bg-canvas hover:text-text-2"
          >
            <Plus size={13} strokeWidth={2} />
            {copy.schedule.addWindow}
          </button>
        </div>
      </Popover>
    </div>
  );
}

function TimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="time"
      dir="ltr"
      step={900}
      value={formatClock(value)}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px] tabular-nums text-text-2 outline-none transition-colors focus:border-blue/45 focus:ring-2 focus:ring-blue/20"
    />
  );
}
