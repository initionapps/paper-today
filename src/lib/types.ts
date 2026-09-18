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

/**
 * A short named direction inside a project — the layer the annual view hangs
 * monthly focus on when a project is big enough to want one. MVP-deliberately
 * thin: a title, a position, and at most one optional KPI *definition*. No
 * status, no due date, no progress beyond that one KPI — those stay
 * explicitly out of scope. The KPI's actual month-by-month numbers live
 * separately, in `GoalMonthlyKpi` — see the note there for why.
 *
 * `order` is a plain integer (0-based), not the fractional `sort_order` every
 * other list here uses. A goal list is capped at five, so rewriting every
 * position on a reorder costs nothing, and a float earns its keep only on
 * lists large or busy enough that rewriting the whole thing would not — see
 * `0009_project_goals.sql`.
 */
export interface ProjectGoal {
  id: string;
  projectId: string;
  title: string;
  order: number;
  /**
   * At most one simple measurable indicator's *definition*, or none. `null`,
   * not an optional key — the same "nullable field, not optional field"
   * convention as `archivedAt`. See `GoalKpi` and `0012_project_goals_kpi.sql`.
   */
  kpi: GoalKpi | null;
}

/**
 * A KPI's fixed definition — deliberately thin: a label, where it's headed,
 * and an optional unit. No history, no formula, no second KPI, no status
 * colour. What NOT to look for here: a "current" value. That used to live on
 * this type (`0012`) and was wrong — a KPI is meant to show progress *across
 * months*, and a single number on the goal can only ever hold the latest one,
 * overwriting history on every edit. Each month's actual measurement is a
 * `GoalMonthlyKpi` row instead, exactly the same move `MonthlyFocus` already
 * made relative to a project. See `0014`–`0015` for the migration.
 *
 * `target` is a plain number rather than an integer because "24,000 ₪ /
 * month" and "2.5" are both legitimate values; the database enforces
 * `target > 0` (`0012`), and this type mirrors that rather than re-deriving
 * it. Both `label` and `target` are required together — a goal either has a
 * complete KPI definition or `kpi: null`, never a half-filled one. `unit`
 * stays independently optional: "3 workouts a week" is a complete KPI
 * without one.
 *
 * `targetLabel` (`0017`) is a separate, optional, free-text *sentence* for
 * display — "12,000 איש ברשימת תפוצה", "Readiness 80", "3 אימונים בשבוע".
 * `target` remains the only number anything measures against or ever
 * calculates from; `targetLabel` is never parsed back into one. See
 * `kpiTargetText` for how the two combine when something needs one line of
 * text to show.
 */
export interface GoalKpi {
  label: string;
  target: number;
  unit: string | null;
  targetLabel: string | null;
}

/**
 * The one line of text to show for a goal's KPI target, wherever a sentence
 * rather than a bare number is needed — `targetLabel` if the goal has one,
 * otherwise a plain fallback built from the numeric `target` and `unit`.
 * Shared by the annual matrix's goal-column line and the Project screen's
 * own summary, so the two can never show two different resolutions of the
 * same goal's target.
 */
export function kpiTargetText(kpi: GoalKpi): string {
  const label = kpi.targetLabel?.trim();
  if (label) return label;
  const target = kpi.target.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return kpi.unit ? `${target} ${kpi.unit}` : target;
}

/**
 * One month's actual measurement toward a goal's KPI — `GoalMonthlyFocus`'s
 * sibling, one more time, for the identical reason: a goal's KPI can have at
 * most one number per calendar month, keyed by `(goalId, year, month)`, with
 * no `id` of its own for the same reason `MonthlyFocus`/`GoalMonthlyFocus`
 * have none — the natural key already answers "which row is this."
 *
 * No row for a month means no measurement that month, not a zero — a real
 * zero is `value: 0` and is a perfectly legitimate measurement (a KPI can
 * start there). Gaps are expected and normal: the annual matrix simply shows
 * nothing in a month nobody measured, exactly like an empty focus cell.
 */
export interface GoalMonthlyKpi {
  goalId: string;
  projectId: string;
  year: number;
  /** 1 = January … 12 = December. */
  month: number;
  value: number;
}

/** The cap, in one place. The database enforces it too (a trigger, since a
 * per-sibling-group row count can't be expressed as a CHECK) — this is what
 * stops the UI offering a sixth box, not what makes the rule true. */
export const MAX_GOALS = 5;

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

/**
 * Up to three things that matter for one project in one month — the annual map.
 *
 * Structurally **not** a task, and deliberately so: no status, no completion, no
 * due date, no size, no assignee, no percentage. Nothing here is ever
 * materialised into `tasks`, and All Tasks never reads it. It answers "what is
 * this project actually about in March", which is a different question from
 * "what do I do today".
 *
 * No `id`. The natural key is (projectId, year, month) and that is what the
 * row is upserted on — the same shape as `DayLog`, where the day *is* the
 * identity and the row's uuid is an implementation detail the domain never
 * sees. One cell, one row.
 *
 * `items` is ordered and holds 1–3 entries, **never 0**: a month with nothing
 * in it has no row at all, exactly as an untouched routine has no `RoutineLog`.
 * Removing the last item deletes the row rather than storing an empty array.
 */
export interface MonthlyFocus {
  projectId: string;
  year: number;
  /** 1 = January … 12 = December. */
  month: number;
  items: string[];
}

/**
 * `MonthlyFocus`'s sibling, not a variant of it — owned by a goal instead of
 * directly by a project. A project's monthly focus lives in one table or the
 * other, never both at once in the UI's intent, though the database has no
 * trouble holding rows in each simultaneously (see `0010`'s note on why this
 * is two tables and not one column added to the first).
 *
 * Also no `id`, for the same reason: the natural key here is `(goalId, year,
 * month)` — a goal id is globally unique, so `projectId` doesn't need to be
 * part of the key to make it correct, only carried alongside it so the
 * database can enforce that the goal actually belongs to that project.
 */
export interface GoalMonthlyFocus {
  goalId: string;
  projectId: string;
  year: number;
  month: number;
  items: string[];
}

/**
 * The cap, in one place. The database enforces it too
 * (`monthly_focus_items_bounded` / `goal_monthly_focus_items_bounded`) — this
 * is what stops the UI offering a fourth box in the first place, not what
 * makes the rule true. Shared by both `MonthlyFocus` and `GoalMonthlyFocus`:
 * the cap is a fact about a "focus cell," not about which table it lives in.
 */
export const MAX_FOCUS_ITEMS = 3;

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
