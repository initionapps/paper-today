/**
 * The translation between a database row and a domain object.
 *
 * Three things differ, and they differ everywhere, so they are handled in one
 * place rather than at each call site:
 *
 *  1. Case. Columns are snake_case, the domain is camelCase.
 *  2. `order` is a reserved word in SQL, so the column is `sort_order`.
 *  3. `detail` is `string | undefined | null` in the domain and strictly
 *     nullable in the column. `undefined` sent to PostgREST means "leave this
 *     column alone", which is not what an unset detail means, so it is
 *     normalised to `null` on the way out.
 *
 * `user_id` is deliberately absent from every insert. The column defaults to
 * `auth.uid()` and the insert policy checks it, so ownership is decided by the
 * database from the caller's token. A payload that never names an owner cannot
 * name the wrong one.
 */
import type {
  DayLog,
  Note,
  NoteColor,
  PaletteColor,
  Project,
  Routine,
  RoutineLog,
  Task,
  TaskSize,
  TaskStatus,
  TimeBlock,
  WorkWindow,
} from "@/lib/types";

// ------------------------------------------------------------------ row types

export interface ProjectRow {
  id: string;
  name: string;
  color: string;
  description: string;
  notes: string;
  sort_order: number;
  archived_at: string | null;
}

export interface TaskRow {
  id: string;
  project_id: string | null;
  title: string;
  detail: string | null;
  size: TaskSize;
  status: TaskStatus;
  planned_date: string | null;
  due_date: string | null;
  is_important: boolean;
  sort_order: number;
  scheduled_start_min: number | null;
  scheduled_end_min: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface RoutineRow {
  id: string;
  title: string;
  weekdays: number[];
  fixed_start_min: number | null;
  fixed_end_min: number | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface RoutineLogRow {
  id: string;
  routine_id: string;
  day: string;
  completed_at: string | null;
  scheduled_start_min: number | null;
  scheduled_end_min: number | null;
}

export interface TimeBlockRow {
  id: string;
  day: string;
  title: string;
  start_min: number;
  end_min: number;
}

export interface WorkWindowRow {
  id: string;
  day: string;
  start_min: number;
  end_min: number;
}

export interface NoteRow {
  id: string;
  day: string;
  body: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
  z: number;
  created_at: string;
}

export interface DayLogRow {
  day: string;
  wrapped_at: string | null;
  reflection: string | null;
}

// ------------------------------------------------------------------ row → domain

/**
 * `color` is plain `text` in the database — the palette is the UI's business,
 * and a check constraint listing colours would have to be migrated every time
 * one is added. A value the app no longer knows still renders as *something*
 * rather than crashing, which is the right failure for an accent.
 */
export const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  color: r.color as PaletteColor,
  description: r.description,
  notes: r.notes,
  order: r.sort_order,
  archivedAt: r.archived_at,
});

export const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  detail: r.detail,
  projectId: r.project_id,
  size: r.size,
  status: r.status,
  plannedDate: r.planned_date,
  dueDate: r.due_date,
  isImportant: r.is_important,
  order: r.sort_order,
  scheduledStartMin: r.scheduled_start_min,
  scheduledEndMin: r.scheduled_end_min,
  completedAt: r.completed_at,
  createdAt: r.created_at,
});

export const toRoutine = (r: RoutineRow): Routine => ({
  id: r.id,
  title: r.title,
  weekdays: r.weekdays,
  fixedStartMin: r.fixed_start_min,
  fixedEndMin: r.fixed_end_min,
  order: r.sort_order,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
});

export const toRoutineLog = (r: RoutineLogRow): RoutineLog => ({
  id: r.id,
  routineId: r.routine_id,
  day: r.day,
  completedAt: r.completed_at,
  scheduledStartMin: r.scheduled_start_min,
  scheduledEndMin: r.scheduled_end_min,
});

export const toTimeBlock = (r: TimeBlockRow): TimeBlock => ({
  id: r.id,
  day: r.day,
  title: r.title,
  startMin: r.start_min,
  endMin: r.end_min,
});

export const toWorkWindow = (r: WorkWindowRow): WorkWindow => ({
  id: r.id,
  day: r.day,
  startMin: r.start_min,
  endMin: r.end_min,
});

export const toNote = (r: NoteRow): Note => ({
  id: r.id,
  day: r.day,
  body: r.body,
  color: r.color as NoteColor,
  x: r.x,
  y: r.y,
  rotation: r.rotation,
  z: r.z,
  createdAt: r.created_at,
});

export const toDayLog = (r: DayLogRow): DayLog => ({
  day: r.day,
  wrappedAt: r.wrapped_at,
  reflection: r.reflection,
});

// ------------------------------------------------------------------ domain → row

export const fromProject = (p: Project): ProjectRow => ({
  id: p.id,
  name: p.name,
  color: p.color,
  description: p.description,
  notes: p.notes,
  sort_order: p.order,
  archived_at: p.archivedAt,
});

export const fromTask = (t: Task): TaskRow => ({
  id: t.id,
  project_id: t.projectId,
  title: t.title,
  // `undefined` would tell PostgREST to leave the column as it is; an unset
  // detail means the column should be null.
  detail: t.detail ?? null,
  size: t.size,
  status: t.status,
  planned_date: t.plannedDate,
  due_date: t.dueDate,
  is_important: t.isImportant,
  sort_order: t.order,
  scheduled_start_min: t.scheduledStartMin,
  scheduled_end_min: t.scheduledEndMin,
  completed_at: t.completedAt,
  created_at: t.createdAt,
});

export const fromRoutine = (r: Routine): RoutineRow => ({
  id: r.id,
  title: r.title,
  weekdays: r.weekdays,
  fixed_start_min: r.fixedStartMin,
  fixed_end_min: r.fixedEndMin,
  sort_order: r.order,
  archived_at: r.archivedAt,
  created_at: r.createdAt,
});

export const fromRoutineLog = (l: RoutineLog): RoutineLogRow => ({
  id: l.id,
  routine_id: l.routineId,
  day: l.day,
  completed_at: l.completedAt,
  scheduled_start_min: l.scheduledStartMin,
  scheduled_end_min: l.scheduledEndMin,
});

export const fromTimeBlock = (b: TimeBlock): TimeBlockRow => ({
  id: b.id,
  day: b.day,
  title: b.title,
  start_min: b.startMin,
  end_min: b.endMin,
});

export const fromWorkWindow = (w: WorkWindow): WorkWindowRow => ({
  id: w.id,
  day: w.day,
  start_min: w.startMin,
  end_min: w.endMin,
});

export const fromNote = (n: Note): NoteRow => ({
  id: n.id,
  day: n.day,
  body: n.body,
  color: n.color,
  x: n.x,
  y: n.y,
  rotation: n.rotation,
  z: n.z,
  created_at: n.createdAt,
});

/**
 * No `id`. `day_logs` is upserted on `(user_id, day)` — a day log *is* the day,
 * and the row's own uuid is an implementation detail the domain never sees
 * (`DayLog` has no id field at all). On insert the column default supplies one.
 */
export const fromDayLog = (d: DayLog): DayLogRow => ({
  day: d.day,
  wrapped_at: d.wrappedAt,
  reflection: d.reflection,
});
