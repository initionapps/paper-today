/**
 * Manual local backup: one JSON file, exported and restored by hand.
 *
 * Pure functions only — no React, no store, no DOM — so the validation that
 * guards a destructive restore can be reasoned about on its own.
 */
import {
  STORE_VERSION,
  migratePersisted,
  persistedSlice,
  type PersistedSlice,
} from "@/lib/store/day-store";

/** Identifies files as ours. Bumped only if the envelope itself changes. */
export const BACKUP_FORMAT_VERSION = 1;
const APP_ID = "paper-today";

export interface BackupFile {
  app: typeof APP_ID;
  /** Shape of this envelope. */
  backupVersion: number;
  /** Shape of `data` — the same version the store persists under. */
  dataVersion: number;
  createdAt: string;
  data: PersistedSlice;
}

export function buildBackup(slice: PersistedSlice, at: Date = new Date()): BackupFile {
  return {
    app: APP_ID,
    backupVersion: BACKUP_FORMAT_VERSION,
    dataVersion: STORE_VERSION,
    createdAt: at.toISOString(),
    data: persistedSlice(slice),
  };
}

/** `day-planner-backup-2026-08-12.json` */
export function backupFilename(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `day-planner-backup-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}.json`;
}

// ------------------------------------------------------------------ reading

export type BackupError =
  | "invalid-json"
  | "not-a-backup"
  | "too-new"
  | "malformed-data";

export interface BackupSummary {
  createdAt: string | null;
  dataVersion: number;
  tasks: number;
  projects: number;
  routines: number;
  notes: number;
  timeBlocks: number;
  workWindows: number;
}

export type ParseResult =
  | { ok: true; data: PersistedSlice; summary: BackupSummary }
  | { ok: false; error: BackupError };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Every field is checked before anything is handed back, so a broken file can
 * never be applied halfway. Older backups are run through the store's own
 * migrations; newer ones are refused rather than guessed at.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid-json" };
  }

  if (!isObject(raw) || raw.app !== APP_ID) return { ok: false, error: "not-a-backup" };

  const backupVersion = raw.backupVersion;
  const dataVersion = raw.dataVersion;
  if (typeof backupVersion !== "number" || typeof dataVersion !== "number") {
    return { ok: false, error: "not-a-backup" };
  }
  // a file from a future version may hold fields we would silently drop
  if (backupVersion > BACKUP_FORMAT_VERSION || dataVersion > STORE_VERSION) {
    return { ok: false, error: "too-new" };
  }
  if (!isObject(raw.data)) return { ok: false, error: "malformed-data" };

  const migrated = migratePersisted(raw.data, dataVersion) as unknown;
  if (!isObject(migrated)) return { ok: false, error: "malformed-data" };

  const arrays = [
    "projects",
    "tasks",
    "routines",
    "routineLogs",
    "timeBlocks",
    "workWindows",
    "notes",
    "dayLogs",
  ] as const;
  for (const key of arrays) {
    // absent is fine (older backups predate some of these); wrong type is not
    const value = migrated[key];
    if (value !== undefined && !Array.isArray(value)) return { ok: false, error: "malformed-data" };
  }
  if (migrated.motto !== undefined && typeof migrated.motto !== "string") {
    return { ok: false, error: "malformed-data" };
  }

  const list = <T,>(key: (typeof arrays)[number]) => (migrated[key] as T[] | undefined) ?? [];

  const data: PersistedSlice = {
    motto: typeof migrated.motto === "string" ? migrated.motto : "",
    projects: list("projects"),
    tasks: list("tasks"),
    routines: list("routines"),
    routineLogs: list("routineLogs"),
    timeBlocks: list("timeBlocks"),
    workWindows: list("workWindows"),
    notes: list("notes"),
    dayLogs: list("dayLogs"),
  };

  return {
    ok: true,
    data,
    summary: {
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
      dataVersion,
      tasks: data.tasks.length,
      projects: data.projects.length,
      routines: data.routines.length,
      notes: data.notes.length,
      timeBlocks: data.timeBlocks.length,
      workWindows: data.workWindows.length,
    },
  };
}
