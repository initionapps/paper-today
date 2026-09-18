import { addDays, addMonths, format, parseISO } from "date-fns";
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

/**
 * 'ספטמבר' — a month on its own, with no day and no year attached.
 *
 * Takes a 1-based month the way the annual view and the database both do
 * (`monthly_focus.month` is 1–12), and feeds `Date` the 0-based one it wants in
 * exactly one place, here, rather than at every call site. The day is set to
 * the 1st and the year is arbitrary: neither is rendered.
 */
export function monthName(month: number): string {
  return format(new Date(2000, month - 1, 1), "LLLL", { locale: he });
}

/** 'ספט׳' — for the twelve column headers, where the full name will not fit. */
export function shortMonthName(month: number): string {
  return format(new Date(2000, month - 1, 1), "LLL", { locale: he });
}

/** The month a `DayKey` falls in, 1-based. */
export function monthOf(day: DayKey): number {
  return parseISO(day).getMonth() + 1;
}

export function yearOf(day: DayKey): number {
  return parseISO(day).getFullYear();
}

/**
 * Shifts a (year, 1-based month) pair by `delta` months, rolling the year
 * over at either end — the general form of the ±1 stepping both the annual
 * view's rolling window and its month panel need. Mirrors `shiftDay`, but
 * delegates the overflow to date-fns rather than a `Date` day, since a month
 * has no day-of-month to preserve here (every caller passes the 1st).
 */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = addMonths(new Date(year, month - 1, 1), delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * `count` consecutive (year, month) pairs starting at (year, month) — the
 * annual view's rolling window, in place of a fixed Jan–Dec calendar year.
 */
export function monthsFrom(
  year: number,
  month: number,
  count: number,
): { year: number; month: number }[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(year, month, i));
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
