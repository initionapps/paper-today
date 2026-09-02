/**
 * Turning a `PersistedSlice` — the shape the store and every backup file use —
 * into the row payload `restore_backup` expects.
 *
 * Two things happen here, and they have to happen together.
 *
 * **Ids become uuids.** A backup written before this change carries the old
 * eight-character ids, and a slice read out of a browser's localStorage does
 * too. `rowIdFor` maps them, deterministically and per user.
 *
 * **References are mapped through the same function as their targets.** A
 * task's `projectId` is derived with the `projects` scope, not the `tasks` one,
 * because it has to come out as the id the project row was actually given. Get
 * that wrong and the payload is not rejected — it is accepted with every task
 * silently orphaned, which is far worse.
 */
import { rowIdFor } from "@/lib/supabase/ids";
import {
  fromDayLog,
  fromNote,
  fromProject,
  fromRoutine,
  fromRoutineLog,
  fromTask,
  fromTimeBlock,
  fromWorkWindow,
} from "@/lib/supabase/mappers";
import type { PersistedSlice } from "@/lib/store/day-store";

export interface RestorePayload {
  motto: string;
  projects: object[];
  routines: object[];
  tasks: object[];
  routine_logs: object[];
  time_blocks: object[];
  work_windows: object[];
  notes: object[];
  day_logs: object[];
}

export async function buildPayload(
  userId: string,
  slice: PersistedSlice,
): Promise<RestorePayload> {
  const projectId = async (id: string) => rowIdFor(userId, "projects", id);
  const routineId = async (id: string) => rowIdFor(userId, "routines", id);

  const projects = await Promise.all(
    slice.projects.map(async (p) => ({ ...fromProject(p), id: await projectId(p.id) })),
  );

  const routines = await Promise.all(
    slice.routines.map(async (r) => ({ ...fromRoutine(r), id: await routineId(r.id) })),
  );

  const tasks = await Promise.all(
    slice.tasks.map(async (t) => ({
      ...fromTask(t),
      id: await rowIdFor(userId, "tasks", t.id),
      // through the *projects* scope — this must equal the id above
      project_id: t.projectId === null ? null : await projectId(t.projectId),
    })),
  );

  const routine_logs = await Promise.all(
    slice.routineLogs.map(async (l) => ({
      ...fromRoutineLog(l),
      id: await rowIdFor(userId, "routine_logs", l.id),
      routine_id: await routineId(l.routineId),
    })),
  );

  const time_blocks = await Promise.all(
    slice.timeBlocks.map(async (b) => ({
      ...fromTimeBlock(b),
      id: await rowIdFor(userId, "time_blocks", b.id),
    })),
  );

  const work_windows = await Promise.all(
    slice.workWindows.map(async (w) => ({
      ...fromWorkWindow(w),
      id: await rowIdFor(userId, "work_windows", w.id),
    })),
  );

  const notes = await Promise.all(
    slice.notes.map(async (n) => ({ ...fromNote(n), id: await rowIdFor(userId, "notes", n.id) })),
  );

  // `DayLog` has no id of its own, so the day is what identifies it.
  const day_logs = await Promise.all(
    slice.dayLogs.map(async (d) => ({
      ...fromDayLog(d),
      id: await rowIdFor(userId, "day_logs", d.day),
    })),
  );

  return {
    motto: slice.motto,
    projects,
    routines,
    tasks,
    routine_logs,
    time_blocks,
    work_windows,
    notes,
    day_logs,
  };
}

/**
 * Rows that the database's CHECK constraints will refuse, found before anything
 * is sent rather than as a failed transaction.
 *
 * Deliberately *not* a repair pass. An archived task that kept its completion
 * time is valid — `0004` was widened so it would be — and the remaining cases
 * are genuine inconsistencies that should be reported rather than quietly
 * rewritten.
 */
export function findInvalidRows(slice: PersistedSlice): string[] {
  const problems: string[] = [];

  for (const t of slice.tasks) {
    if (t.status === "open" && t.completedAt !== null) {
      problems.push(`המשימה "${t.title}" פתוחה אך רשום לה זמן השלמה`);
    }
    if (t.status === "done" && t.completedAt === null) {
      problems.push(`המשימה "${t.title}" מסומנת כהושלמה אך חסר לה זמן השלמה`);
    }
    if (t.scheduledEndMin !== null && t.scheduledStartMin === null) {
      problems.push(`למשימה "${t.title}" יש שעת סיום ללא שעת התחלה`);
    }
    if (
      t.scheduledStartMin !== null &&
      t.scheduledEndMin !== null &&
      t.scheduledEndMin <= t.scheduledStartMin
    ) {
      problems.push(`למשימה "${t.title}" יש שעת סיום שאינה אחרי ההתחלה`);
    }
  }

  const projectIds = new Set(slice.projects.map((p) => p.id));
  for (const t of slice.tasks) {
    if (t.projectId !== null && !projectIds.has(t.projectId)) {
      problems.push(`המשימה "${t.title}" מקושרת לפרויקט שאינו קיים`);
    }
  }

  const routineIds = new Set(slice.routines.map((r) => r.id));
  for (const l of slice.routineLogs) {
    if (!routineIds.has(l.routineId)) {
      problems.push(`רשומת שגרה מ-${l.day} מקושרת לשגרה שאינה קיימת`);
    }
  }

  const spans = [
    ...slice.timeBlocks.map((b) => [b.startMin, b.endMin, `האירוע "${b.title}"`] as const),
    ...slice.workWindows.map((w) => [w.startMin, w.endMin, `חלון עבודה ב-${w.day}`] as const),
  ];
  for (const [start, end, what] of spans) {
    if (start < 0 || end > 1440 || end <= start) {
      problems.push(`${what} מוגדר בשעות לא תקינות`);
    }
  }

  const seenLogs = new Set<string>();
  for (const l of slice.routineLogs) {
    const key = `${l.routineId}|${l.day}`;
    if (seenLogs.has(key)) problems.push(`יש שתי רשומות לאותה שגרה ב-${l.day}`);
    seenLogs.add(key);
  }

  const seenDays = new Set<string>();
  for (const d of slice.dayLogs) {
    if (seenDays.has(d.day)) problems.push(`יש שתי רשומות סיכום ליום ${d.day}`);
    seenDays.add(d.day);
  }

  return problems;
}
