"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { longDate, weekdayName } from "@/lib/date";
import { formatDuration, type Capacity } from "@/lib/schedule";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey } from "@/lib/types";

import { WorkHoursEditor } from "./work-hours-editor";

export function ScheduleHeader({
  day,
  isToday,
  onPrev,
  onNext,
  onToday,
  scheduledCount,
  totalCount,
  scheduledMin,
  capacity,
  hasWindows,
}: {
  day: DayKey;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  scheduledCount: number;
  totalCount: number;
  scheduledMin: number;
  capacity: Capacity;
  hasWindows: boolean;
}) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 sm:gap-4">
        <div>
          <h1 className="font-display text-[1.5rem] sm:text-[2.1rem] font-bold leading-tight tracking-[-0.022em] text-text">
            {weekdayName(day)}
          </h1>
          <p className="mt-0.5 text-[13px] text-text-2 sm:mt-1 sm:text-[13.5px]">{longDate(day)}</p>
        </div>

        <div className="flex items-center gap-1">
          {/* RTL: previous is to the right, so the chevrons read outward */}
          <NavButton label={copy.schedule.prevDay} onClick={onPrev}>
            <ChevronRight size={17} strokeWidth={1.8} />
          </NavButton>
          <button
            type="button"
            onClick={onToday}
            disabled={isToday}
            className={cn(
              "rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              "min-h-11 sm:min-h-0 sm:py-1.5",
              isToday
                ? "cursor-default border-line-soft bg-canvas text-text-3"
                : "shadow-flat cursor-pointer border-line bg-surface text-text-2 hover:border-blue/35 hover:text-blue",
            )}
          >
            {copy.schedule.today}
          </button>
          <NavButton label={copy.schedule.nextDay} onClick={onNext}>
            <ChevronLeft size={17} strokeWidth={1.8} />
          </NavButton>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-y-2 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
        <span className="text-[12.5px] text-text-2 sm:text-[13px]">
          {copy.schedule.summary(scheduledCount, totalCount, formatDuration(scheduledMin))}
        </span>

        {hasWindows && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-3 sm:text-[12px]">
            <Stat label={copy.schedule.capacity.work} value={formatDuration(capacity.workMin)} />
            <Stat label={copy.schedule.capacity.blocked} value={formatDuration(capacity.blockedMin)} />
            <Stat
              label={copy.schedule.capacity.scheduled}
              value={formatDuration(capacity.scheduledMin)}
            />
            <Stat
              label={copy.schedule.capacity.remaining}
              value={formatDuration(capacity.remainingMin)}
              tone="blue"
            />
          </span>
        )}

        <WorkHoursEditor day={day} className="self-start sm:ms-auto sm:self-auto" />
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "blue" }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{label}</span>
      <span className={cn("ltr-run tabular-nums font-medium", tone === "blue" ? "text-blue" : "text-text-2")}>
        {value}
      </span>
    </span>
  );
}

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
      // 44px on a phone, the desktop 32px from sm: up — the three day controls
      // sit side by side and were the easiest thing on this screen to mis-tap.
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-surface hover:text-text-2 sm:h-8 sm:w-8"
    >
      {children}
    </button>
  );
}
