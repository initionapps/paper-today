/**
 * Domain types. These mirror `supabase/migrations/0001_init.sql` one-for-one so
 * that the eventual Supabase swap replaces the store's internals without
 * touching a component.
 *
 * Convention: a `DayKey` is a local calendar day as 'YYYY-MM-DD'. It is never a
 * Date object and never a timestamp — a day is a place, not a moment.
 */

export type DayKey = string;

export type TaskSize = "big" | "medium" | "small";
export type TaskStatus = "open" | "done" | "archived";

/** Palette keys, not hex. The UI owns colour; rows only name it. */
/**
 * Project accents, ordered by hue. Purely additive over the original five —
 * every stored value stays valid, so widening this needed no migration.
 *
 * `amber` is deliberately absent: it is reserved for warnings, and a project
 * dot in the warning colour would blunt that signal.
 */
export type PaletteColor =
  | "blue"
  | "sky"
  | "indigo"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose"
  | "orange"
  | "lime"
  | "green"
  | "teal"
  | "slate";
export type NoteColor = "blue" | "lavender" | "mint" | "sky" | "grey";

export interface Project {
  id: string;
  name: string;
  /** Accent only — a dot beside a task, a hairline on a card. Never a fill. */
  color: PaletteColor;
  /** One line of context, shown wherever the project appears. */
  description: string;
  /** Long-form room: decisions, links, half-thoughts. Project page only. */
  notes: string;
  order: number;
  /**
   * The whole of a project's status: `null` is active, a timestamp is
   * archived — and it records when. No separate status field to disagree with.
   */
  archivedAt: string | null;
}

export interface Task {
  id: string;
  title: string;
  /** One quiet line under the title. Not a rich-text body. */
  detail?: string | null;
  projectId: string | null;

  /** Persistent — survives into tomorrow, All Tasks and Projects. */
  size: TaskSize;
  status: TaskStatus;

  /**
   * When I intend to work on it. Only ever changed by an explicit user action.
   * `null` = backlog. Only tasks whose plannedDate is today appear on Today.
   */
  plannedDate: DayKey | null;

  /**
   * The deadline. Independent of plannedDate — being planned after the due
   * date just means you're late, which is a state worth being able to see.
   */
  dueDate: DayKey | null;

  /**
   * A manual, binary marker — important or not, and nothing in between.
   * Deliberately not a priority scale, and deliberately independent of `size`:
   * a big task is not automatically important, and a small one can be.
   *
   * It sorts, groups and filters nothing. It only draws a heart.
   */
  isImportant: boolean;

  /** Fractional rank within (plannedDate, size). Midpoint insert on reorder. */
  order: number;

  /**
   * Schedule block, minutes from local midnight. A task has no duration of its
   * own: a block's length is end - start, derived at render, never stored.
   */
  scheduledStartMin: number | null;
  scheduledEndMin: number | null;

  completedAt: string | null;
  createdAt: string;
}

/**
 * Template. Never materialised into `tasks` — a routine occurrence is a
 * `RoutineLog` row, not a task.
 */
export interface Routine {
  id: string;
  title: string;
  /**
   * 0 = Sunday … 6 = Saturday. This *is* the recurrence: 7 entries means every
   * day, 1 means weekly, anything between is a chosen set. A separate mode
   * field would be a second value describing the same fact, free to disagree.
   */
  weekdays: number[];
  /**
   * Optional fixed time on the template. When set, the routine is drawn on the
   * rail every day it applies, with no dragging. A single day can still
   * override it — see `RoutineLog`.
   */
  fixedStartMin: number | null;
  fixedEndMin: number | null;
  order: number;
  /** `null` = active. Same single-source-of-truth rule as `Project`. */
  archivedAt: string | null;
  createdAt: string;
}

/** The three recurrence shapes `weekdays` can take, derived never stored. */
export type Recurrence = "daily" | "weekdays" | "weekly";

export function recurrenceOf(weekdays: number[]): Recurrence {
  if (weekdays.length >= 7) return "daily";
  if (weekdays.length === 1) return "weekly";
  return "weekdays";
}

/**
 * Per-day fact about a routine, and the whole of the override model. Absent ⇒
 * untouched: not done, and using the template's time if it has one.
 *
 * A non-null `scheduledStartMin` overrides the template **for this date only**.
 */
export interface RoutineLog {
  id: string;
  routineId: string;
  /** A real day that happened, not an intention — unrelated to plannedDate. */
  day: DayKey;
  completedAt: string | null;
  scheduledStartMin: number | null;
  scheduledEndMin: number | null;
}

/**
 * Sticky note. Structurally not a task: no size, no status, no project, no
 * link to `tasks`. `x`/`y` are 0–1 fractions of the notes area, measured from
 * the inline start edge so they read the same in RTL and LTR.
 *
 * `rotation` is retained by the data model but the current visual language
 * does not apply it — a tilted note reads as paper.
 */
export interface Note {
  id: string;
  day: DayKey;
  body: string;
  color: NoteColor;
  x: number;
  y: number;
  rotation: number;
  z: number;
  createdAt: string;
}

export interface DayLog {
  day: DayKey;
  wrappedAt: string | null;
  reflection: string | null;
}

/**
 * Meetings, lunch, travel. Structurally not a task: no status, no project, no
 * size, no completion. Title, start, end — that is the whole model.
 */
export interface TimeBlock {
  id: string;
  day: DayKey;
  title: string;
  startMin: number;
  endMin: number;
}

/**
 * When you are available to work. No title — a window isn't a thing that
 * happens. A day with no windows has not been told yet, which is different
 * from a day with no availability.
 */
export interface WorkWindow {
  id: string;
  day: DayKey;
  startMin: number;
  endMin: number;
}

/** Where a task lands in All Tasks, derived from plannedDate against today. */
export type DateBucket = "overdue" | "today" | "tomorrow" | "upcoming" | "none";

export const DATE_BUCKETS: readonly DateBucket[] = [
  "overdue",
  "today",
  "tomorrow",
  "upcoming",
  "none",
] as const;

/** The three task sections of the day, top to bottom. */
export const TASK_SIZES: readonly TaskSize[] = ["big", "medium", "small"] as const;
