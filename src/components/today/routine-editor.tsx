"use client";

import { useState } from "react";

import { Popover, PopoverLabel } from "@/components/ui/popover";
import { DAY_MIN, MIN_BLOCK_MIN, formatClock, parseClock } from "@/lib/schedule";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { recurrenceOf, type Recurrence, type Routine } from "@/lib/types";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export interface RoutineDraft {
  title: string;
  weekdays: number[];
  fixedStartMin: number | null;
  fixedEndMin: number | null;
}

/**
 * Create and edit in one small panel. Recurrence is not stored — the three
 * buttons just shape `weekdays`, and which one looks selected is derived back
 * from it, so the two can never disagree.
 */
export function RoutineEditor({
  open,
  onClose,
  onSave,
  routine,
  align = "start",
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: RoutineDraft) => void;
  /** Absent = creating. */
  routine?: Routine;
  align?: "start" | "end";
}) {
  if (!open) return null;
  return (
    <Popover open onClose={onClose} align={align} className="w-[19rem]">
      <EditorBody routine={routine} onClose={onClose} onSave={onSave} />
    </Popover>
  );
}

function EditorBody({
  routine,
  onClose,
  onSave,
}: {
  routine?: Routine;
  onClose: () => void;
  onSave: (draft: RoutineDraft) => void;
}) {
  const [title, setTitle] = useState(routine?.title ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(routine?.weekdays ?? ALL_DAYS);
  const [startMin, setStartMin] = useState<number | null>(routine?.fixedStartMin ?? null);
  const [endMin, setEndMin] = useState<number | null>(routine?.fixedEndMin ?? null);

  const mode = recurrenceOf(weekdays);

  const pickMode = (next: Recurrence) => {
    if (next === "daily") setWeekdays(ALL_DAYS);
    // keep the earliest chosen day so the switch isn't destructive
    else if (next === "weekly") setWeekdays([weekdays[0] ?? 0]);
    else if (weekdays.length >= 7) setWeekdays([0, 1, 2, 3, 4]);
  };

  const toggleDay = (day: number) => {
    if (mode === "weekly") return setWeekdays([day]);
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day];
    // a routine that never happens isn't a routine
    if (next.length > 0) setWeekdays(next);
  };

  const setStart = (value: string) => {
    const min = parseClock(value);
    if (min === null) return setClearTime();
    const next = Math.min(min, DAY_MIN - MIN_BLOCK_MIN);
    setStartMin(next);
    setEndMin((e) => Math.max(e ?? next + 60, next + MIN_BLOCK_MIN));
  };

  const setEnd = (value: string) => {
    const min = parseClock(value);
    if (min === null || startMin === null) return;
    setEndMin(Math.max(min, startMin + MIN_BLOCK_MIN));
  };

  const setClearTime = () => {
    setStartMin(null);
    setEndMin(null);
  };

  const canSave = title.trim().length > 0 && weekdays.length > 0;

  const save = () => {
    if (!canSave) return;
    onSave({ title, weekdays, fixedStartMin: startMin, fixedEndMin: startMin === null ? null : endMin });
    onClose();
  };

  return (
    <div>
      <PopoverLabel>{routine ? copy.routines.editTitle : copy.routines.newTitle}</PopoverLabel>

      <div className="px-1.5 pb-2">
        <input
          autoFocus
          value={title}
          aria-label={copy.a11y.routineTitle}
          placeholder={copy.routines.titlePlaceholder}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13.5px] text-text outline-none transition-colors placeholder:text-text-3 focus:border-blue/45 focus:ring-2 focus:ring-blue/20"
        />
      </div>

      <PopoverLabel>{copy.routines.recurrence}</PopoverLabel>
      <div className="flex gap-1 px-1.5 pb-1.5">
        {(["daily", "weekdays", "weekly"] as const).map((option) => (
          <Chip key={option} active={mode === option} onClick={() => pickMode(option)} className="flex-1">
            {copy.routines[option]}
          </Chip>
        ))}
      </div>

      {mode !== "daily" && (
        <div className="flex justify-between gap-1 px-1.5 pb-2">
          {ALL_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              aria-label={copy.a11y.toggleWeekday(copy.routines.weekdayInitials[day])}
              aria-pressed={weekdays.includes(day)}
              onClick={() => toggleDay(day)}
              className={cn(
                "h-7 w-7 cursor-pointer rounded-full border text-[11.5px] transition-colors",
                weekdays.includes(day)
                  ? "border-teal/40 bg-teal/12 text-teal"
                  : "border-line text-text-3 hover:bg-canvas hover:text-text-2",
              )}
            >
              {copy.routines.weekdayInitials[day]}
            </button>
          ))}
        </div>
      )}

      <PopoverLabel>{copy.routines.fixedTime}</PopoverLabel>
      <div className="flex items-center gap-1.5 px-1.5 pb-1">
        <TimeField
          value={startMin}
          ariaLabel={copy.a11y.routineStart}
          onChange={setStart}
        />
        <span className="text-[12px] text-text-3">–</span>
        <TimeField
          value={endMin}
          ariaLabel={copy.a11y.routineEnd}
          onChange={setEnd}
          disabled={startMin === null}
        />
      </div>
      <div className="px-2.5 pb-2">
        {startMin === null ? (
          <p className="text-[11px] leading-relaxed text-text-3">{copy.routines.fixedTimeHint}</p>
        ) : (
          <button
            type="button"
            onClick={setClearTime}
            className="cursor-pointer text-[11.5px] text-text-3 transition-colors hover:text-text-2"
          >
            {copy.routines.clearTime}
          </button>
        )}
      </div>

      <div className="my-1 h-px bg-line-soft" />

      <div className="flex items-center justify-between px-1.5 pb-0.5 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg px-2 py-1.5 text-[13px] text-text-3 transition-colors hover:text-text-2"
        >
          {copy.routines.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="cursor-pointer rounded-full bg-teal px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-teal/90 disabled:opacity-40"
        >
          {copy.routines.save}
        </button>
      </div>
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border px-2 py-1.5 text-[12px] transition-colors",
        active
          ? "border-teal/40 bg-teal/10 text-teal"
          : "border-line text-text-3 hover:bg-canvas hover:text-text-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

function TimeField({
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: number | null;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="time"
      dir="ltr"
      step={900}
      disabled={disabled}
      value={value === null ? "" : formatClock(value)}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px] tabular-nums text-text-2 outline-none transition-colors focus:border-blue/45 focus:ring-2 focus:ring-blue/20 disabled:opacity-40"
    />
  );
}
