/**
 * Every read and write the app makes against its own data.
 *
 * Nothing here filters by `user_id`. That is not an omission — row level
 * security adds `user_id = auth.uid()` to every statement below, so a select
 * returns this user's rows and an update cannot reach anyone else's. Writing
 * the predicate by hand as well would suggest the app is what keeps accounts
 * apart, and it is not: if a query here were wrong, the database would still
 * refuse. Inserts likewise omit `user_id` entirely and let the column default
 * to `auth.uid()`.
 *
 * The functions are plain async calls that throw on failure. Sequencing,
 * ownership checks and retries belong to the write queue, not here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { PersistedSlice } from "@/lib/store/day-store";
import {
  fromDayLog,
  fromNote,
  fromProject,
  fromRoutine,
  fromRoutineLog,
  fromTask,
  fromTimeBlock,
  fromWorkWindow,
  toDayLog,
  toNote,
  toProject,
  toRoutine,
  toRoutineLog,
  toTask,
  toTimeBlock,
  toWorkWindow,
  type DayLogRow,
  type NoteRow,
  type ProjectRow,
  type RoutineLogRow,
  type RoutineRow,
  type TaskRow,
  type TimeBlockRow,
  type WorkWindowRow,
} from "@/lib/supabase/mappers";
import type {
  DayLog,
  Note,
  Project,
  Routine,
  RoutineLog,
  Task,
  TimeBlock,
  WorkWindow,
} from "@/lib/types";

/** The nine tables, in an order that satisfies the foreign keys. */
export const TABLES = [
  "projects",
  "routines",
  "tasks",
  "routine_logs",
  "time_blocks",
  "work_windows",
  "notes",
  "day_logs",
] as const;

export type TableName = (typeof TABLES)[number];

function client(): SupabaseClient {
  return createClient();
}

/** Turns a PostgREST error into something with a stack and a readable message. */
function fail(op: string, error: { message: string; code?: string; details?: string } | null): never {
  const code = error?.code ? ` [${error.code}]` : "";
  const detail = error?.details ? ` — ${error.details}` : "";
  throw new Error(`${op} failed${code}: ${error?.message ?? "unknown error"}${detail}`);
}

// ------------------------------------------------------------------ read

/**
 * The whole account in one go.
 *
 * Nine small selects in parallel. The data is a personal planner's — hundreds
 * of rows, not thousands — so paging it would add moving parts to save nothing.
 * If any one of them fails the whole load fails, because a partially loaded
 * store is indistinguishable from a store whose missing rows were deleted, and
 * the write path would then happily persist that misreading.
 */
export async function loadAll(): Promise<PersistedSlice> {
  const db = client();

  const [profile, projects, routines, tasks, routineLogs, timeBlocks, workWindows, notes, dayLogs] =
    await Promise.all([
      db.from("profiles").select("motto").maybeSingle(),
      db.from("projects").select("id,name,color,description,notes,sort_order,archived_at"),
      db.from("routines").select("id,title,weekdays,fixed_start_min,fixed_end_min,sort_order,archived_at,created_at"),
      db.from("tasks").select(
        "id,project_id,title,detail,size,status,planned_date,due_date,is_important,sort_order,scheduled_start_min,scheduled_end_min,completed_at,created_at",
      ),
      db.from("routine_logs").select("id,routine_id,day,completed_at,scheduled_start_min,scheduled_end_min"),
      db.from("time_blocks").select("id,day,title,start_min,end_min"),
      db.from("work_windows").select("id,day,start_min,end_min"),
      db.from("notes").select("id,day,body,color,x,y,rotation,z,created_at"),
      db.from("day_logs").select("day,wrapped_at,reflection"),
    ]);

  if (profile.error) fail("load profile", profile.error);
  if (projects.error) fail("load projects", projects.error);
  if (routines.error) fail("load routines", routines.error);
  if (tasks.error) fail("load tasks", tasks.error);
  if (routineLogs.error) fail("load routine_logs", routineLogs.error);
  if (timeBlocks.error) fail("load time_blocks", timeBlocks.error);
  if (workWindows.error) fail("load work_windows", workWindows.error);
  if (notes.error) fail("load notes", notes.error);
  if (dayLogs.error) fail("load day_logs", dayLogs.error);

  return {
    // A profile row always exists — the signup trigger makes it — but a null
    // here would mean an account whose trigger did not fire, and an empty
    // motto is a better answer than a crash on the way into the app.
    motto: (profile.data as { motto: string } | null)?.motto ?? "",
    projects: ((projects.data ?? []) as ProjectRow[]).map(toProject),
    routines: ((routines.data ?? []) as RoutineRow[]).map(toRoutine),
    tasks: ((tasks.data ?? []) as TaskRow[]).map(toTask),
    routineLogs: ((routineLogs.data ?? []) as RoutineLogRow[]).map(toRoutineLog),
    timeBlocks: ((timeBlocks.data ?? []) as TimeBlockRow[]).map(toTimeBlock),
    workWindows: ((workWindows.data ?? []) as WorkWindowRow[]).map(toWorkWindow),
    notes: ((notes.data ?? []) as NoteRow[]).map(toNote),
    dayLogs: ((dayLogs.data ?? []) as DayLogRow[]).map(toDayLog),
  };
}

/** Row counts per table, for reconciling an import without pulling the rows. */
export async function countAll(): Promise<Record<TableName, number>> {
  const db = client();
  const results = await Promise.all(
    TABLES.map((t) => db.from(t).select("*", { count: "exact", head: true })),
  );
  const counts = {} as Record<TableName, number>;
  TABLES.forEach((t, i) => {
    const r = results[i];
    if (r.error) fail(`count ${t}`, r.error);
    counts[t] = r.count ?? 0;
  });
  return counts;
}

// ------------------------------------------------------------------ write

/**
 * Upsert rather than update, uniformly.
 *
 * The store creates a row in memory and asks for it to be saved; whether that
 * is the row's first save or its fiftieth is a distinction the caller would
 * have to track and could get wrong. Upsert makes a repeated write harmless,
 * which is also what makes a retry safe.
 */
async function upsert(table: TableName, row: object, onConflict?: string): Promise<void> {
  const { error } = await client()
    .from(table)
    .upsert(row, onConflict ? { onConflict } : undefined);
  if (error) fail(`upsert ${table}`, error);
}

async function remove(table: TableName, column: string, value: string): Promise<void> {
  const { error } = await client().from(table).delete().eq(column, value);
  if (error) fail(`delete from ${table}`, error);
}

export const saveProject = (p: Project) => upsert("projects", fromProject(p));
export const saveTask = (t: Task) => upsert("tasks", fromTask(t));
export const saveRoutine = (r: Routine) => upsert("routines", fromRoutine(r));
export const saveRoutineLog = (l: RoutineLog) => upsert("routine_logs", fromRoutineLog(l));
export const saveTimeBlock = (b: TimeBlock) => upsert("time_blocks", fromTimeBlock(b));
export const saveWorkWindow = (w: WorkWindow) => upsert("work_windows", fromWorkWindow(w));
export const saveNote = (n: Note) => upsert("notes", fromNote(n));

/**
 * Keyed by `(user_id, day)`, not by id: `DayLog` has no id in the domain, and
 * wrapping the same day twice must update the day rather than add a second row.
 */
export const saveDayLog = (d: DayLog) => upsert("day_logs", fromDayLog(d), "user_id,day");

export const deleteTask = (id: string) => remove("tasks", "id", id);
export const deleteTimeBlock = (id: string) => remove("time_blocks", "id", id);
export const deleteNote = (id: string) => remove("notes", "id", id);
export const deleteWorkWindow = (id: string) => remove("work_windows", "id", id);
export const deleteRoutineLog = (id: string) => remove("routine_logs", "id", id);
export const deleteDayLog = (day: string) => remove("day_logs", "day", day);

/** The motto is a column on the profile, which the signup trigger created. */
export async function saveMotto(motto: string): Promise<void> {
  const db = client();
  const { data, error: claimsError } = await db.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) fail("save motto", claimsError ?? { message: "no authenticated user" });
  const { error } = await db.from("profiles").update({ motto }).eq("id", id);
  if (error) fail("save motto", error);
}

/**
 * Replace everything this account has with the contents of a backup, as one
 * transaction. See `0006_restore_backup.sql` — the function runs with the
 * caller's rights, so RLS applies to every statement inside it exactly as it
 * does out here, and a failure anywhere rolls back the deletes as well as the
 * inserts.
 */
export async function restoreBackup(payload: object): Promise<Record<string, number>> {
  const { data, error } = await client().rpc("restore_backup", { payload });
  if (error) fail("restore_backup", error);
  return (data as { counts: Record<string, number> })?.counts ?? {};
}

/** Stamps the one-time import as finished. Written only after it fully succeeds. */
export async function markLocalMigrated(at: string = new Date().toISOString()): Promise<void> {
  const db = client();
  const { data } = await db.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) fail("mark migrated", { message: "no authenticated user" });
  const { error } = await db.from("profiles").update({ local_migrated_at: at }).eq("id", id);
  if (error) fail("mark migrated", error);
}

export async function localMigratedAt(): Promise<string | null> {
  const { data, error } = await client().from("profiles").select("local_migrated_at").maybeSingle();
  if (error) fail("read migration marker", error);
  return (data as { local_migrated_at: string | null } | null)?.local_migrated_at ?? null;
}
