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
  fromGoalMonthlyFocus,
  fromGoalMonthlyKpi,
  fromMonthlyFocus,
  fromNote,
  fromProject,
  fromProjectGoal,
  fromRoutine,
  fromRoutineLog,
  fromTask,
  fromTimeBlock,
  fromWorkWindow,
} from "@/lib/supabase/mappers";
import type { PersistedSlice } from "@/lib/store/day-store";
import { MAX_FOCUS_ITEMS, MAX_GOALS } from "@/lib/types";

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
  monthly_focus: object[];
  project_goals: object[];
  goal_monthly_focus: object[];
  goal_monthly_kpi: object[];
}

export async function buildPayload(
  userId: string,
  slice: PersistedSlice,
): Promise<RestorePayload> {
  const projectId = async (id: string) => rowIdFor(userId, "projects", id);
  const routineId = async (id: string) => rowIdFor(userId, "routines", id);
  const goalId = async (id: string) => rowIdFor(userId, "project_goals", id);

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

  // Like `DayLog`, `MonthlyFocus` has no id of its own — the natural key stands
  // in for one when deriving the uuid the row will be inserted under. And like
  // a task's project, `project_id` goes through the **projects** scope so it
  // comes out as the id the project row was actually given; deriving it here
  // would silently orphan every cell instead of failing.
  const monthly_focus = await Promise.all(
    slice.monthlyFocus.map(async (f) => ({
      ...fromMonthlyFocus(f),
      id: await rowIdFor(userId, "monthly_focus", `${f.projectId}:${f.year}:${f.month}`),
      project_id: await projectId(f.projectId),
    })),
  );

  const project_goals = await Promise.all(
    slice.goals.map(async (g) => ({ ...fromProjectGoal(g), id: await goalId(g.id), project_id: await projectId(g.projectId) })),
  );

  // Like `MonthlyFocus`, `GoalMonthlyFocus` has no id of its own. `goal_id`
  // goes through the **project_goals** scope (not a fresh derivation here) for
  // the same reason a task's `project_id` does — it has to land on the id the
  // goal row was actually given, or every cell silently orphans instead of
  // failing loudly.
  const goal_monthly_focus = await Promise.all(
    slice.goalMonthlyFocus.map(async (f) => ({
      ...fromGoalMonthlyFocus(f),
      id: await rowIdFor(userId, "goal_monthly_focus", `${f.goalId}:${f.year}:${f.month}`),
      goal_id: await goalId(f.goalId),
      project_id: await projectId(f.projectId),
    })),
  );

  // Same shape as `goal_monthly_focus` above, one field instead of an array.
  const goal_monthly_kpi = await Promise.all(
    slice.goalMonthlyKpi.map(async (f) => ({
      ...fromGoalMonthlyKpi(f),
      id: await rowIdFor(userId, "goal_monthly_kpi", `${f.goalId}:${f.year}:${f.month}`),
      goal_id: await goalId(f.goalId),
      project_id: await projectId(f.projectId),
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
    monthly_focus,
    project_goals,
    goal_monthly_focus,
    goal_monthly_kpi,
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

  // Everything `0007` will refuse, caught here instead of as a rolled-back
  // transaction. Whitespace-only items are checked here and not in the database
  // because a CHECK constraint cannot hold the subquery that would need.
  const projectName = new Map(slice.projects.map((p) => [p.id, p.name]));
  const seenCells = new Set<string>();
  for (const f of slice.monthlyFocus) {
    const where = `${projectName.get(f.projectId) ?? f.projectId} · ${f.month}/${f.year}`;

    if (!projectName.has(f.projectId)) {
      problems.push(`יעד חודשי (${where}) מקושר לפרויקט שאינו קיים`);
    }
    if (!Number.isInteger(f.month) || f.month < 1 || f.month > 12) {
      problems.push(`ליעד חודשי (${where}) יש חודש לא תקין`);
    }
    if (!Number.isInteger(f.year) || f.year < 2000 || f.year > 2100) {
      problems.push(`ליעד חודשי (${where}) יש שנה לא תקינה`);
    }
    if (f.items.length === 0) {
      problems.push(`ליעד חודשי (${where}) אין אף פריט`);
    }
    if (f.items.length > MAX_FOCUS_ITEMS) {
      problems.push(`ליעד חודשי (${where}) יש יותר מ-${MAX_FOCUS_ITEMS} פריטים`);
    }
    if (f.items.some((i) => i.trim() === "")) {
      problems.push(`ליעד חודשי (${where}) יש פריט ריק`);
    }

    const key = `${f.projectId}|${f.year}|${f.month}`;
    if (seenCells.has(key)) problems.push(`יש שתי רשומות ליעד חודשי (${where})`);
    seenCells.add(key);
  }

  // Goals, and their own monthly focus — same checks, one layer deeper.
  const goalsByProject = new Map<string, number>();
  const goalTitle = new Map<string, string>();
  const goalProject = new Map<string, string>();
  for (const g of slice.goals) {
    goalTitle.set(g.id, g.title);
    goalProject.set(g.id, g.projectId);
    if (!projectName.has(g.projectId)) {
      problems.push(`המטרה "${g.title}" מקושרת לפרויקט שאינו קיים`);
    }
    goalsByProject.set(g.projectId, (goalsByProject.get(g.projectId) ?? 0) + 1);

    // Everything `0012`/`0015`'s CHECK constraints will refuse, caught here
    // instead of as a rolled-back transaction — same reasoning as the focus
    // checks above. `kpi` is either fully populated or `null` by the type,
    // but a hand-edited or older backup file isn't bound by that at runtime.
    if (g.kpi) {
      if (!g.kpi.label.trim()) {
        problems.push(`למטרה "${g.title}" יש מדד (KPI) ללא שם`);
      }
      if (!(g.kpi.target > 0)) {
        problems.push(`למטרה "${g.title}" יש מדד (KPI) עם יעד שאינו גדול מאפס`);
      }
    }
  }
  for (const [projectId, count] of goalsByProject) {
    if (count > MAX_GOALS) {
      problems.push(`לפרויקט "${projectName.get(projectId) ?? projectId}" יש יותר מ-${MAX_GOALS} מטרות`);
    }
  }

  const seenGoalCells = new Set<string>();
  for (const f of slice.goalMonthlyFocus) {
    const title = goalTitle.get(f.goalId) ?? f.goalId;
    const where = `${title} · ${f.month}/${f.year}`;

    if (!goalTitle.has(f.goalId)) {
      problems.push(`יעד חודשי (${where}) מקושר למטרה שאינה קיימת`);
    } else if (goalProject.get(f.goalId) !== f.projectId) {
      // Exactly the case the composite FK exists to prevent — reported here
      // as a validation message rather than left to surface as a rolled-back
      // restore, same as every other check in this function.
      problems.push(`יעד חודשי (${where}) משויך לפרויקט שאינו הפרויקט של המטרה`);
    }
    if (!Number.isInteger(f.month) || f.month < 1 || f.month > 12) {
      problems.push(`ליעד חודשי (${where}) יש חודש לא תקין`);
    }
    if (!Number.isInteger(f.year) || f.year < 2000 || f.year > 2100) {
      problems.push(`ליעד חודשי (${where}) יש שנה לא תקינה`);
    }
    if (f.items.length === 0) {
      problems.push(`ליעד חודשי (${where}) אין אף פריט`);
    }
    if (f.items.length > MAX_FOCUS_ITEMS) {
      problems.push(`ליעד חודשי (${where}) יש יותר מ-${MAX_FOCUS_ITEMS} פריטים`);
    }
    if (f.items.some((i) => i.trim() === "")) {
      problems.push(`ליעד חודשי (${where}) יש פריט ריק`);
    }

    const key = `${f.goalId}|${f.year}|${f.month}`;
    if (seenGoalCells.has(key)) problems.push(`יש שתי רשומות ליעד חודשי (${where})`);
    seenGoalCells.add(key);
  }

  // A goal's monthly KPI values — same checks, `goal_monthly_kpi`'s own
  // CHECK constraints (`0014`) instead of `goal_monthly_focus`'s.
  const seenGoalKpiCells = new Set<string>();
  for (const f of slice.goalMonthlyKpi) {
    const title = goalTitle.get(f.goalId) ?? f.goalId;
    const where = `${title} · ${f.month}/${f.year}`;

    if (!goalTitle.has(f.goalId)) {
      problems.push(`ערך מדד חודשי (${where}) מקושר למטרה שאינה קיימת`);
    } else if (goalProject.get(f.goalId) !== f.projectId) {
      problems.push(`ערך מדד חודשי (${where}) משויך לפרויקט שאינו הפרויקט של המטרה`);
    }
    if (!Number.isInteger(f.month) || f.month < 1 || f.month > 12) {
      problems.push(`לערך מדד חודשי (${where}) יש חודש לא תקין`);
    }
    if (!Number.isInteger(f.year) || f.year < 2000 || f.year > 2100) {
      problems.push(`לערך מדד חודשי (${where}) יש שנה לא תקינה`);
    }
    if (!Number.isFinite(f.value) || f.value < 0) {
      problems.push(`לערך מדד חודשי (${where}) יש ערך לא תקין`);
    }

    const key = `${f.goalId}|${f.year}|${f.month}`;
    if (seenGoalKpiCells.has(key)) problems.push(`יש שתי רשומות לערך מדד חודשי (${where})`);
    seenGoalKpiCells.add(key);
  }

  return problems;
}
