import { addDays, format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import type { DateBucket, DayKey } from "./types";

/** Local calendar day as 'YYYY-MM-DD'. Never UTC — a day is where you are. */
export function toDayKey(date: Date): DayKey {
  return format(date, "yyyy-MM-dd");
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function shiftDay(day: DayKey, days: number): DayKey {
  return toDayKey(addDays(parseISO(day), days));
}

export function tomorrowOf(day: DayKey): DayKey {
  return shiftDay(day, 1);
}

/** 'יום שלישי' */
export function weekdayName(day: DayKey): string {
  return format(parseISO(day), "EEEE", { locale: he });
}

/** '11 באוגוסט 2026' */
export function longDate(day: DayKey): string {
  return format(parseISO(day), "PPP", { locale: he });
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayIndex(day: DayKey): number {
  return parseISO(day).getDay();
}

/** 545 → '9:05'. Always rendered inside an .ltr-run wrapper. */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 'ג׳, 11 באוג׳' — for group headings and date chips. */
export function shortDate(day: DayKey): string {
  return format(parseISO(day), "EEEEEE, d בMMM", { locale: he });
}

/**
 * DayKeys are zero-padded 'YYYY-MM-DD', so lexicographic order *is* calendar
 * order. No Date objects, no timezone to get wrong.
 */
export function isBeforeDay(a: DayKey, b: DayKey): boolean {
  return a < b;
}

/**
 * Which All Tasks group a task belongs to. `null` planned date is the backlog;
 * anything still open with a date in the past is overdue rather than invisible.
 */
export function dateBucket(plannedDate: DayKey | null, today: DayKey): DateBucket {
  if (plannedDate === null) return "none";
  if (plannedDate < today) return "overdue";
  if (plannedDate === today) return "today";
  if (plannedDate === tomorrowOf(today)) return "tomorrow";
  return "upcoming";
}

/** A deadline that has already passed, on a task that is still open. */
export function isOverdue(dueDate: DayKey | null, today: DayKey): boolean {
  return dueDate !== null && dueDate < today;
}
