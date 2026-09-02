"use client";

/**
 * The one-time move of a browser's localStorage into a Supabase account.
 *
 * It runs once, by hand, because the user asked it to. Nothing here happens on
 * load, on sign-in, or on a timer — an import is a decision, and a decision
 * made on the user's behalf about where their data lives is not one this code
 * gets to make.
 *
 *
 * WHAT MAKES IT SAFE TO RUN TWICE
 *
 * Every row id is derived, not allocated: `uuidv5(user + table + local id)`.
 * The same local data always produces the same uuids, so a second run collides
 * with the rows the first one wrote and `on conflict do nothing` turns it into
 * a no-op. That is also what makes a *partial* run recoverable — an import that
 * dies after projects and before tasks leaves the projects in place, and
 * re-running inserts only what is missing.
 *
 * `do nothing`, not `do update`: a retry must not overwrite edits the user made
 * in the app between the two attempts.
 *
 *
 * WHAT MAKES IT SAFE TO FAIL
 *
 * The local key is not touched until the imported rows have been read back and
 * checked, one id at a time. Until that point every failure path leaves the
 * browser exactly as it was, and the worst outcome is some rows in the account
 * and the original still sitting in localStorage — which is the state a retry
 * is designed to finish from.
 */
import { STORE_VERSION, migratePersisted, type PersistedSlice } from "@/lib/store/day-store";
import { createClient } from "@/lib/supabase/client";
import { rowIdFor, type IdScope } from "@/lib/supabase/ids";
import { buildPayload, findInvalidRows, type RestorePayload } from "@/lib/supabase/payload";
import { markLocalMigrated } from "@/lib/supabase/repository";

/** Where zustand's `persist` has always written. */
export const LOCAL_KEY = "paper-today/day";

/**
 * Where it goes afterwards.
 *
 * The key is renamed, never deleted. The app stops reading it, so the data is
 * out of the way, but it is still in the browser and still exportable — which
 * matters on the one day it turns out the import got something wrong. Deleting
 * it is a separate button the user presses later, if they ever do.
 */
export const ARCHIVE_KEY = "paper-today/day.pre-supabase-backup";

export interface LocalSummary {
  motto: string;
  projects: number;
  tasks: number;
  routines: number;
  routineLogs: number;
  timeBlocks: number;
  workWindows: number;
  notes: number;
  dayLogs: number;
}

export interface LocalData {
  slice: PersistedSlice;
  summary: LocalSummary;
  /** The version the browser's envelope claimed, before migration. */
  foundVersion: number;
}

export type ReadResult =
  | { state: "none" }
  | { state: "unreadable"; reason: string }
  | { state: "found"; data: LocalData };

const summarise = (s: PersistedSlice): LocalSummary => ({
  motto: s.motto,
  projects: s.projects.length,
  tasks: s.tasks.length,
  routines: s.routines.length,
  routineLogs: s.routineLogs.length,
  timeBlocks: s.timeBlocks.length,
  workWindows: s.workWindows.length,
  notes: s.notes.length,
  dayLogs: s.dayLogs.length,
});

/**
 * Read the browser's store and bring it up to the current shape.
 *
 * Read-only. It does not write, rename or clear anything — a user who opens
 * Settings and changes their mind must leave with their browser untouched.
 */
export function readLocal(): ReadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LOCAL_KEY);
  } catch (e) {
    // Private mode, or storage disabled entirely.
    return { state: "unreadable", reason: e instanceof Error ? e.message : String(e) };
  }
  if (raw === null) return { state: "none" };

  try {
    const envelope = JSON.parse(raw) as { state?: unknown; version?: unknown };
    const version = typeof envelope.version === "number" ? envelope.version : 0;

    // A browser running a *newer* build than this one. Migrating forwards is
    // defined; migrating backwards is not, and guessing would corrupt.
    if (version > STORE_VERSION) {
      return {
        state: "unreadable",
        reason: `local data is version ${version}, newer than this app's ${STORE_VERSION}`,
      };
    }

    const slice = migratePersisted(envelope.state, version) as PersistedSlice;
    if (!slice || !Array.isArray(slice.tasks)) {
      return { state: "unreadable", reason: "the stored value is not a recognisable store" };
    }
    return { state: "found", data: { slice, summary: summarise(slice), foundVersion: version } };
  } catch (e) {
    return { state: "unreadable", reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Problems the database would reject, named before anything is sent. */
export const validate = (slice: PersistedSlice) => findInvalidRows(slice);

/** The backup offered before the import. Same envelope the Settings export writes. */
export function backupBlob(slice: PersistedSlice): Blob {
  const file = {
    app: "paper-today",
    backupVersion: 1,
    dataVersion: STORE_VERSION,
    createdAt: new Date().toISOString(),
    data: slice,
  };
  return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
}

// ---------------------------------------------------------------- the import

/** Parents before children — a task cannot reference a project that is not in yet. */
const ORDER: { table: string; key: keyof RestorePayload; conflict: string }[] = [
  { table: "projects", key: "projects", conflict: "id" },
  { table: "routines", key: "routines", conflict: "id" },
  { table: "tasks", key: "tasks", conflict: "id" },
  // Its own unique key, not `id`. A retry reproduces both the same id *and* the
  // same (routine_id, day), so naming the natural key here catches the repeat
  // either way — whereas naming `id` would let a (routine_id, day) clash raise
  // 23505 instead of being ignored.
  { table: "routine_logs", key: "routine_logs", conflict: "routine_id,day" },
  { table: "time_blocks", key: "time_blocks", conflict: "id" },
  { table: "work_windows", key: "work_windows", conflict: "id" },
  { table: "notes", key: "notes", conflict: "id" },
  { table: "day_logs", key: "day_logs", conflict: "user_id,day" },
];

/** Big enough that a normal planner is one request per table. */
const CHUNK = 500;

export interface ImportProgress {
  table: string;
  done: number;
  total: number;
}

export interface Reconciliation {
  ok: boolean;
  rows: { table: string; local: number; remote: number; missing: number }[];
}

export type ImportResult =
  | { ok: true; reconciliation: Reconciliation }
  | { ok: false; stage: string; message: string; reconciliation?: Reconciliation };

/**
 * Insert everything, verify everything, then — and only then — retire the key.
 */
export async function runImport(
  userId: string,
  slice: PersistedSlice,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const db = createClient();

  let payload: RestorePayload;
  try {
    payload = await buildPayload(userId, slice);
  } catch (e) {
    return { ok: false, stage: "prepare", message: message(e) };
  }

  // ---- insert, in dependency order, idempotently ----------------------------
  for (const { table, key, conflict } of ORDER) {
    const rows = payload[key] as object[];
    if (rows.length === 0) {
      onProgress?.({ table, done: 0, total: 0 });
      continue;
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await db
        .from(table)
        .upsert(chunk, { onConflict: conflict, ignoreDuplicates: true });
      if (error) {
        return {
          ok: false,
          stage: table,
          message: `${error.message}${error.code ? ` [${error.code}]` : ""}`,
        };
      }
      onProgress?.({ table, done: Math.min(i + CHUNK, rows.length), total: rows.length });
    }
  }

  // The motto is a column on the profile, and only worth writing if there is
  // one — an empty local motto should not blank whatever the account has.
  if (slice.motto.trim()) {
    const { error } = await db.from("profiles").update({ motto: slice.motto }).eq("id", userId);
    if (error) return { ok: false, stage: "motto", message: error.message };
  }

  // ---- verify before believing --------------------------------------------
  let reconciliation: Reconciliation;
  try {
    reconciliation = await reconcile(userId, slice);
  } catch (e) {
    return { ok: false, stage: "reconcile", message: message(e) };
  }
  if (!reconciliation.ok) {
    return {
      ok: false,
      stage: "reconcile",
      message: "some rows did not arrive — nothing has been retired, and re-running will finish the job",
      reconciliation,
    };
  }

  // ---- only now is it finished --------------------------------------------
  try {
    await markLocalMigrated();
  } catch (e) {
    // The data is in and verified; only the marker failed. Retiring the key
    // anyway would be defensible, but the marker is what stops the prompt
    // coming back, and a state where the data is imported *and* the key is
    // gone *and* the app keeps asking is the most confusing of the three.
    return { ok: false, stage: "marker", message: message(e), reconciliation };
  }

  try {
    archiveLocalKey();
  } catch (e) {
    return { ok: false, stage: "retire", message: message(e), reconciliation };
  }

  return { ok: true, reconciliation };
}

/**
 * Did every local row actually arrive?
 *
 * Compares *ids*, not counts. Counts agreeing is weak evidence — an account
 * with pre-existing rows can match on totals while missing exactly what was
 * imported. The derived ids are known ahead of time, so membership can be
 * checked directly, and that is the only thing that justifies retiring the key.
 */
export async function reconcile(userId: string, slice: PersistedSlice): Promise<Reconciliation> {
  const db = createClient();

  const checks: { table: string; scope: IdScope; locals: string[]; column: string }[] = [
    { table: "projects", scope: "projects", locals: slice.projects.map((p) => p.id), column: "id" },
    { table: "routines", scope: "routines", locals: slice.routines.map((r) => r.id), column: "id" },
    { table: "tasks", scope: "tasks", locals: slice.tasks.map((t) => t.id), column: "id" },
    { table: "routine_logs", scope: "routine_logs", locals: slice.routineLogs.map((l) => l.id), column: "id" },
    { table: "time_blocks", scope: "time_blocks", locals: slice.timeBlocks.map((b) => b.id), column: "id" },
    { table: "work_windows", scope: "work_windows", locals: slice.workWindows.map((w) => w.id), column: "id" },
    { table: "notes", scope: "notes", locals: slice.notes.map((n) => n.id), column: "id" },
    // A day log is identified by its day, both locally and in the unique key.
    { table: "day_logs", scope: "day_logs", locals: slice.dayLogs.map((d) => d.day), column: "day" },
  ];

  const rows: Reconciliation["rows"] = [];
  let ok = true;

  for (const { table, scope, locals, column } of checks) {
    const { data, error } = await db.from(table).select(column);
    if (error) throw new Error(`reconcile ${table}: ${error.message}`);

    // A dynamic column name widens PostgREST's row type to include its error
    // shape, so this goes through `unknown` rather than asserting across it.
    const remote = new Set(
      (data ?? []).map((r) => String((r as unknown as Record<string, unknown>)[column])),
    );

    const expected =
      column === "day"
        ? locals
        : await Promise.all(locals.map((id) => rowIdFor(userId, scope, id)));

    const missing = expected.filter((id) => !remote.has(id)).length;
    if (missing > 0) ok = false;
    rows.push({ table, local: locals.length, remote: remote.size, missing });
  }

  return { ok, rows };
}

// ---------------------------------------------------------------- retirement

/**
 * Move the key aside. Never deletes.
 *
 * If an archive already exists it is left alone — it is the *pre-Supabase*
 * copy, and a second import should not overwrite the first one's evidence with
 * something that has since been through the app.
 */
export function archiveLocalKey(): void {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (raw === null) return;
  if (localStorage.getItem(ARCHIVE_KEY) === null) {
    localStorage.setItem(ARCHIVE_KEY, raw);
  }
  localStorage.removeItem(LOCAL_KEY);
  notify();
}

export const hasArchive = (): boolean => {
  try {
    return localStorage.getItem(ARCHIVE_KEY) !== null;
  } catch {
    return false;
  }
};

export function readArchive(): string | null {
  try {
    return localStorage.getItem(ARCHIVE_KEY);
  } catch {
    return null;
  }
}

/** The only thing in this file that destroys anything, and the user asks for it. */
export function discardArchive(): void {
  localStorage.removeItem(ARCHIVE_KEY);
  notify();
}

// ------------------------------------------------------- reading it in React
//
// localStorage is external mutable state, so the component subscribes to it
// rather than copying it into `useState` from an effect. Reading it in an
// effect and calling `setState` would work, but it is a render-then-correct
// cascade over data that is already available synchronously — and React 19's
// lint rule says so.
//
// The snapshot must be referentially stable or `useSyncExternalStore` will spin
// forever, so it is recomputed only when the underlying strings actually
// change. Comparing the raw strings is cheap; re-parsing and re-migrating on
// every render would not be.

export interface LocalSnapshot {
  local: ReadResult;
  archived: boolean;
}

let cachedRawLocal: string | null = null;
let cachedRawArchive: string | null = null;
let cachedSnapshot: LocalSnapshot | null = null;

const listeners = new Set<() => void>();

/** Storage changed from inside this tab; `storage` events only fire for others. */
function notify(): void {
  cachedSnapshot = null;
  for (const l of listeners) l();
}

export function subscribeLocal(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = () => {
    cachedSnapshot = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getLocalSnapshot(): LocalSnapshot {
  let rawLocal: string | null = null;
  let rawArchive: string | null = null;
  try {
    rawLocal = localStorage.getItem(LOCAL_KEY);
    rawArchive = localStorage.getItem(ARCHIVE_KEY);
  } catch {
    // handled by readLocal reporting `unreadable`
  }

  if (cachedSnapshot && rawLocal === cachedRawLocal && rawArchive === cachedRawArchive) {
    return cachedSnapshot;
  }
  cachedRawLocal = rawLocal;
  cachedRawArchive = rawArchive;
  cachedSnapshot = { local: readLocal(), archived: rawArchive !== null };
  return cachedSnapshot;
}

/** There is no localStorage on the server, so the server sees nothing to import. */
const SERVER_SNAPSHOT: LocalSnapshot = { local: { state: "none" }, archived: false };
export const getServerLocalSnapshot = (): LocalSnapshot => SERVER_SNAPSHOT;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
