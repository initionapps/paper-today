"use client";

/**
 * The single seam between the UI and storage.
 *
 * Today: everything lives here, persisted to localStorage.
 * Not started: the bodies of these actions become Supabase calls. Their
 *          signatures are already row-shaped (`id` + patch, fractional
 *          `order`), so no component changes.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { copy } from "@/lib/copy";
import { dateBucket, shortDate, todayKey, tomorrowOf } from "@/lib/date";
import { PALETTE } from "@/lib/palette";
import { mergeIntervals } from "@/lib/schedule";
import { buildSeed } from "@/lib/mock/seed";
import type {
  DateBucket,
  DayKey,
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

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_MOTTO = "לעשות פחות, ולעשות את זה כמו שצריך.";

/** Bumped whenever the persisted shape changes; see `migratePersisted`. */
export const STORE_VERSION = 6;

/**
 * Everything that survives a reload — and nothing that doesn't. Transient UI
 * (the undo entry, open menus, drag state, the selected day) is deliberately
 * absent.
 *
 * Both `partialize` and the backup export read through this one function, so a
 * field added to the store can never end up saved but missing from backups.
 */
export interface PersistedSlice {
  motto: string;
  projects: Project[];
  tasks: Task[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  timeBlocks: TimeBlock[];
  workWindows: WorkWindow[];
  notes: Note[];
  dayLogs: DayLog[];
}

// generic so that passing it straight to `partialize` doesn't narrow the whole
// store's type to the slice
export function persistedSlice<T extends PersistedSlice>(s: T): PersistedSlice {
  return {
    motto: s.motto,
    projects: s.projects,
    tasks: s.tasks,
    routines: s.routines,
    routineLogs: s.routineLogs,
    timeBlocks: s.timeBlocks,
    workWindows: s.workWindows,
    notes: s.notes,
    dayLogs: s.dayLogs,
  };
}

/** Midpoint insert: a reorder touches one row, never the whole section. */
function orderBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined) return next! - 1;
  if (next === undefined) return prev + 1;
  return (prev + next) / 2;
}

export interface UndoEntry {
  label: string;
  at: number;
  undo: () => void;
}

interface DayState {
  /**
   * One standing intention, not a record per day. It carries forward until it
   * is changed, and changing it replaces it everywhere — there is no history
   * and no association with a date.
   */
  motto: string;

  projects: Project[];
  tasks: Task[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  timeBlocks: TimeBlock[];
  workWindows: WorkWindow[];
  notes: Note[];
  dayLogs: DayLog[];

  /** Transient — never persisted. */
  undo: UndoEntry | null;

  /**
   * `plannedDate: null` puts the new task straight into the backlog.
   * `projectId` is set when adding from inside a project page.
   */
  addTask: (
    plannedDate: DayKey | null,
    size: TaskSize,
    title: string,
    projectId?: string | null,
  ) => void;
  renameTask: (id: string, title: string) => void;
  setTaskDetail: (id: string, detail: string) => void;
  toggleTask: (id: string) => void;
  /**
   * Flip the important marker. No undo entry — one more click puts it back,
   * exactly like `toggleTask`.
   */
  toggleImportant: (id: string) => void;
  setTaskSize: (id: string, size: TaskSize) => void;
  /** Cross-section drag + reorder in one call: sets size and rank together. */
  placeTask: (id: string, size: TaskSize, index: number) => void;

  /** The one path that changes when a task is planned for. Never automatic. */
  setPlannedDate: (id: string, day: DayKey | null) => void;
  moveTaskToToday: (id: string) => void;
  moveTaskToTomorrow: (id: string) => void;
  setDueDate: (id: string, day: DayKey | null) => void;

  archiveTask: (id: string) => void;
  deleteTask: (id: string) => void;
  /** Block bounds in minutes from midnight; length is end - start, never stored. */
  scheduleTask: (id: string, startMin: number | null, endMin?: number | null) => void;
  setTaskProject: (id: string, projectId: string | null) => void;

  addProject: (name: string) => string;
  updateProject: (
    id: string,
    patch: Partial<Pick<Project, "name" | "color" | "description" | "notes">>,
  ) => void;
  archiveProject: (id: string) => void;
  restoreProject: (id: string) => void;

  addRoutine: (input: {
    title: string;
    weekdays: number[];
    fixedStartMin?: number | null;
    fixedEndMin?: number | null;
  }) => string;
  updateRoutine: (
    id: string,
    patch: Partial<Pick<Routine, "title" | "weekdays" | "fixedStartMin" | "fixedEndMin">>,
  ) => void;
  archiveRoutine: (id: string) => void;
  restoreRoutine: (id: string) => void;

  toggleRoutine: (routineId: string, day: DayKey) => void;
  reorderRoutines: (ids: string[]) => void;
  /** Routines occupy real time too. `null` start takes it off the rail. */
  scheduleRoutine: (
    routineId: string,
    day: DayKey,
    startMin: number | null,
    endMin?: number | null,
  ) => void;

  addTimeBlock: (day: DayKey, title: string, startMin: number, endMin: number) => string;
  updateTimeBlock: (
    id: string,
    patch: Partial<Pick<TimeBlock, "title" | "startMin" | "endMin">>,
  ) => void;
  deleteTimeBlock: (id: string) => void;

  /**
   * Replaces the day's availability wholesale, exactly as given.
   *
   * Deliberately does NOT merge: this runs on every keystroke, and a value
   * typed *through* on the way to another one (13:00 passes through 01:00)
   * would transiently overlap a neighbouring window and fuse the two for good.
   * Totals are unaffected — `dayCapacity` and `invert` merge when they read.
   */
  setWorkWindows: (
    day: DayKey,
    windows: { id?: string; startMin: number; endMin: number }[],
  ) => void;
  /** Tidy overlaps up once editing is finished, where it can't destroy input. */
  mergeWorkWindows: (day: DayKey) => void;

  addNote: (day: DayKey, x: number, y: number) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, "body" | "color" | "x" | "y">>) => void;
  liftNote: (id: string) => void;
  deleteNote: (id: string) => void;

  setMotto: (motto: string) => void;

  /** Restore from a backup: one write, all of it or none of it. */
  replaceAll: (slice: PersistedSlice) => void;

  wrapUpDay: (day: DayKey) => void;
  unwrapDay: (day: DayKey) => void;

  clearUndo: () => void;
  runUndo: () => void;

  resetToSeed: () => void;
}

function seedState() {
  const seed = buildSeed(todayKey());
  return { ...seed, dayLogs: [] as DayLog[], motto: DEFAULT_MOTTO };
}

export const useDayStore = create<DayState>()(
  persist(
    (set, get) => {
      /** Patch one task by id. */
      const patchTask = (id: string, patch: Partial<Task>) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

      /** Register an undoable action, replacing any pending one. */
      const remember = (label: string, undo: () => void) =>
        set({ undo: { label, at: Date.now(), undo } });

      /** Last rank in a (plannedDate, size) group, excluding one id. */
      const tailOrder = (plannedDate: DayKey | null, size: TaskSize, exclude?: string) => {
        const group = get()
          .tasks.filter(
            (t) =>
              t.plannedDate === plannedDate &&
              t.size === size &&
              t.status !== "archived" &&
              t.id !== exclude,
          )
          .sort((a, b) => a.order - b.order);
        return orderBetween(group[group.length - 1]?.order, undefined);
      };

      return {
        ...seedState(),
        undo: null,

        addTask: (plannedDate, size, title, projectId = null) => {
          const trimmed = title.trim();
          if (!trimmed) return;
          set((s) => ({
            tasks: [
              ...s.tasks,
              {
                id: uid(),
                title: trimmed,
                detail: null,
                projectId,
                size,
                status: "open",
                plannedDate,
                dueDate: null,
                isImportant: false,
                order: tailOrder(plannedDate, size),
                scheduledStartMin: null,
                scheduledEndMin: null,
                completedAt: null,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
        },

        renameTask: (id, title) => {
          const trimmed = title.trim();
          if (!trimmed) return;
          patchTask(id, { title: trimmed });
        },

        setTaskDetail: (id, detail) => patchTask(id, { detail: detail.trim() || null }),

        toggleTask: (id) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return;
          const done = task.status !== "done";
          patchTask(id, {
            status: done ? "done" : "open",
            completedAt: done ? new Date().toISOString() : null,
          });
        },

        toggleImportant: (id) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return;
          patchTask(id, { isImportant: !task.isImportant });
        },

        setTaskSize: (id, size) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task || task.size === size) return;
          patchTask(id, { size, order: tailOrder(task.plannedDate, size, id) });
        },

        placeTask: (id, size, index) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return;
          const group = get()
            .tasks.filter(
              (t) =>
                t.plannedDate === task.plannedDate &&
                t.size === size &&
                t.status !== "archived" &&
                t.id !== id,
            )
            .sort((a, b) => a.order - b.order);
          const clamped = Math.max(0, Math.min(index, group.length));
          const order = orderBetween(group[clamped - 1]?.order, group[clamped]?.order);
          if (task.size === size && task.order === order) return;
          patchTask(id, { size, order });
        },

        setPlannedDate: (id, day) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task || task.plannedDate === day) return;

          const before = {
            plannedDate: task.plannedDate,
            order: task.order,
            scheduledStartMin: task.scheduledStartMin,
            scheduledEndMin: task.scheduledEndMin,
          };

          patchTask(id, {
            plannedDate: day,
            order: tailOrder(day, task.size, id),
            // a block belongs to a specific day; moving the day voids it
            scheduledStartMin: null,
            scheduledEndMin: null,
          });

          const today = todayKey();
          const label =
            day === null
              ? copy.undo.plannedCleared(task.title)
              : day === today
                ? copy.undo.movedToToday(task.title)
                : day === tomorrowOf(today)
                  ? copy.undo.movedToTomorrow(task.title)
                  : copy.undo.movedToDate(task.title, shortDate(day));

          remember(label, () => patchTask(id, before));
        },

        // "Tomorrow" always means tomorrow, not the day after whatever stale
        // date the task happens to carry.
        moveTaskToToday: (id) => get().setPlannedDate(id, todayKey()),
        moveTaskToTomorrow: (id) => get().setPlannedDate(id, tomorrowOf(todayKey())),

        setDueDate: (id, day) => patchTask(id, { dueDate: day }),

        archiveTask: (id) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return;
          const previous = task.status;
          patchTask(id, { status: "archived" });
          remember(copy.undo.archived(task.title), () => patchTask(id, { status: previous }));
        },

        deleteTask: (id) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return;
          set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
          remember(copy.undo.deleted(task.title), () => set((s) => ({ tasks: [...s.tasks, task] })));
        },

        scheduleTask: (id, startMin, endMin = null) =>
          patchTask(id, {
            scheduledStartMin: startMin,
            scheduledEndMin: startMin === null ? null : endMin,
          }),

        setTaskProject: (id, projectId) => patchTask(id, { projectId }),

        addProject: (name) => {
          const trimmed = name.trim();
          const id = uid();
          if (!trimmed) return id;
          set((s) => ({
            projects: [
              ...s.projects,
              {
                id,
                name: trimmed,
                // cycle the palette so two new projects are never the same
                // colour. Read from PALETTE rather than a copy of it, or the
                // two lists drift the next time the palette changes.
                color: PALETTE[s.projects.length % PALETTE.length],
                description: "",
                notes: "",
                order: Math.max(0, ...s.projects.map((p) => p.order)) + 1,
                archivedAt: null,
              },
            ],
          }));
          return id;
        },

        updateProject: (id, patch) =>
          set((s) => ({
            projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          })),

        archiveProject: (id) => {
          const project = get().projects.find((p) => p.id === id);
          if (!project || project.archivedAt) return;
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === id ? { ...p, archivedAt: new Date().toISOString() } : p,
            ),
          }));
          remember(copy.undo.projectArchived(project.name), () => get().restoreProject(id));
        },

        restoreProject: (id) =>
          set((s) => ({
            projects: s.projects.map((p) => (p.id === id ? { ...p, archivedAt: null } : p)),
          })),

        addRoutine: ({ title, weekdays, fixedStartMin = null, fixedEndMin = null }) => {
          const id = uid();
          const trimmed = title.trim();
          if (!trimmed || weekdays.length === 0) return id;
          set((s) => ({
            routines: [
              ...s.routines,
              {
                id,
                title: trimmed,
                weekdays: [...weekdays].sort((a, b) => a - b),
                fixedStartMin,
                fixedEndMin: fixedStartMin === null ? null : fixedEndMin,
                order: Math.max(0, ...s.routines.map((r) => r.order)) + 1,
                archivedAt: null,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
          return id;
        },

        updateRoutine: (id, patch) =>
          set((s) => ({
            routines: s.routines.map((r) => {
              if (r.id !== id) return r;
              const next = { ...r, ...patch };
              // an end time without a start is meaningless
              if (next.fixedStartMin === null) next.fixedEndMin = null;
              if (patch.weekdays) next.weekdays = [...patch.weekdays].sort((a, b) => a - b);
              return next;
            }),
          })),

        archiveRoutine: (id) => {
          const routine = get().routines.find((r) => r.id === id);
          if (!routine || routine.archivedAt) return;
          set((s) => ({
            routines: s.routines.map((r) =>
              // past logs are deliberately left alone: history is not undone
              r.id === id ? { ...r, archivedAt: new Date().toISOString() } : r,
            ),
          }));
          remember(copy.undo.routineArchived(routine.title), () => get().restoreRoutine(id));
        },

        restoreRoutine: (id) =>
          set((s) => ({
            routines: s.routines.map((r) => (r.id === id ? { ...r, archivedAt: null } : r)),
          })),

        toggleRoutine: (routineId, day) => {
          const existing = get().routineLogs.find((l) => l.routineId === routineId && l.day === day);
          if (existing) {
            set((s) => ({
              routineLogs: s.routineLogs.map((l) =>
                l.id === existing.id
                  ? { ...l, completedAt: l.completedAt ? null : new Date().toISOString() }
                  : l,
              ),
            }));
            return;
          }
          set((s) => ({
            routineLogs: [
              ...s.routineLogs,
              {
                id: uid(),
                routineId,
                day,
                completedAt: new Date().toISOString(),
                scheduledStartMin: null,
                scheduledEndMin: null,
              },
            ],
          }));
        },

        scheduleRoutine: (routineId, day, startMin, endMin = null) => {
          const existing = get().routineLogs.find((l) => l.routineId === routineId && l.day === day);
          if (existing) {
            set((s) => ({
              routineLogs: s.routineLogs.map((l) =>
                l.id === existing.id
                  ? { ...l, scheduledStartMin: startMin, scheduledEndMin: startMin === null ? null : endMin }
                  : l,
              ),
            }));
            return;
          }
          set((s) => ({
            routineLogs: [
              ...s.routineLogs,
              {
                id: uid(),
                routineId,
                day,
                completedAt: null,
                scheduledStartMin: startMin,
                scheduledEndMin: startMin === null ? null : endMin,
              },
            ],
          }));
        },

        addTimeBlock: (day, title, startMin, endMin) => {
          const id = uid();
          set((s) => ({
            timeBlocks: [...s.timeBlocks, { id, day, title: title.trim(), startMin, endMin }],
          }));
          return id;
        },

        updateTimeBlock: (id, patch) =>
          set((s) => ({
            timeBlocks: s.timeBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          })),

        deleteTimeBlock: (id) => {
          const block = get().timeBlocks.find((b) => b.id === id);
          if (!block) return;
          set((s) => ({ timeBlocks: s.timeBlocks.filter((b) => b.id !== id) }));
          remember(copy.undo.blockRemoved(block.title), () =>
            set((s) => ({ timeBlocks: [...s.timeBlocks, block] })),
          );
        },

        setWorkWindows: (day, windows) =>
          set((s) => ({
            workWindows: [
              ...s.workWindows.filter((w) => w.day !== day),
              ...windows
                // a guard, not an editing rule: the editor never builds one
                .filter((w) => w.endMin > w.startMin)
                // keep ids so a row isn't remounted (and refocused) per keystroke
                .map((w) => ({ id: w.id ?? uid(), day, startMin: w.startMin, endMin: w.endMin })),
            ],
          })),

        mergeWorkWindows: (day) =>
          set((s) => {
            const mine = s.workWindows.filter((w) => w.day === day);
            // mergeIntervals sorts as well as merges, so this also restores
            // chronological order after editing left the rows out of sequence
            const merged = mergeIntervals(mine);
            const unchanged =
              merged.length === mine.length &&
              merged.every((m, i) => m.startMin === mine[i].startMin && m.endMin === mine[i].endMin);
            if (unchanged) return s;
            return {
              workWindows: [
                ...s.workWindows.filter((w) => w.day !== day),
                ...merged.map((w) => ({ id: uid(), day, ...w })),
              ],
            };
          }),

        reorderRoutines: (ids) =>
          set((s) => ({
            routines: s.routines.map((r) => {
              const index = ids.indexOf(r.id);
              return index === -1 ? r : { ...r, order: index + 1 };
            }),
          })),

        addNote: (day, x, y) => {
          const palette: NoteColor[] = ["blue", "lavender", "mint", "sky", "grey"];
          const id = uid();
          set((s) => ({
            notes: [
              ...s.notes,
              {
                id,
                day,
                body: "",
                color: palette[s.notes.length % palette.length],
                x,
                y,
                // kept in the model, not expressed visually — see Note in types
                rotation: 0,
                z: Math.max(0, ...s.notes.map((note) => note.z)) + 1,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
          return id;
        },

        updateNote: (id, patch) =>
          set((s) => ({ notes: s.notes.map((note) => (note.id === id ? { ...note, ...patch } : note)) })),

        liftNote: (id) =>
          set((s) => {
            const top = Math.max(0, ...s.notes.map((note) => note.z));
            return { notes: s.notes.map((note) => (note.id === id ? { ...note, z: top + 1 } : note)) };
          }),

        deleteNote: (id) => {
          const note = get().notes.find((candidate) => candidate.id === id);
          if (!note) return;
          set((s) => ({ notes: s.notes.filter((candidate) => candidate.id !== id) }));
          if (note.body.trim())
            remember(copy.notes.removed, () => set((s) => ({ notes: [...s.notes, note] })));
        },

        setMotto: (motto) => set({ motto: motto.trim() }),

        // a single set(): the store never observes a half-restored day, and
        // the pending undo from before the restore is dropped with it
        replaceAll: (slice) => set({ ...persistedSlice(slice), undo: null }),

        wrapUpDay: (day) =>
          set((s) => ({
            dayLogs: [
              ...s.dayLogs.filter((log) => log.day !== day),
              { day, wrappedAt: new Date().toISOString(), reflection: null },
            ],
          })),

        unwrapDay: (day) => set((s) => ({ dayLogs: s.dayLogs.filter((log) => log.day !== day) })),

        clearUndo: () => set({ undo: null }),

        runUndo: () => {
          const entry = get().undo;
          if (!entry) return;
          entry.undo();
          set({ undo: null });
        },

        resetToSeed: () => set({ ...seedState(), undo: null }),
      };
    },
    {
      name: "paper-today/day",
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Never write to storage during SSR, and never persist the undo closure.
      skipHydration: true,
      migrate: migratePersisted,
      partialize: persistedSlice,
    },
  ),
);

// ------------------------------------------------------------------ migration

/** v1 rows, as they still sit in a browser that has been used for real work. */
interface LegacyTask {
  id: string;
  title: string;
  detail?: string | null;
  projectId: string | null;
  size: TaskSize;
  status: TaskStatus;
  /** v1: the sheet the task sat on, always present. v2 renames it. */
  day?: DayKey;
  plannedDate?: DayKey | null;
  dueDate?: DayKey | null;
  order: number;
  scheduledStartMin: number | null;
  /** v1 stored a block length; v2 derives it from start/end instead. */
  durationMin?: number | null;
  scheduledEndMin?: number | null;
  /** v1–v5 had no important marker. */
  isImportant?: boolean;
  completedAt: string | null;
  createdAt: string;
}

interface LegacyRoutineLog {
  id: string;
  routineId: string;
  day: DayKey;
  completedAt: string | null;
  scheduledStartMin: number | null;
  durationMin?: number | null;
  scheduledEndMin?: number | null;
}

/** v1–v4 routines were `active: boolean` and had no fixed time. */
interface LegacyRoutine {
  id: string;
  title: string;
  weekdays: number[];
  order: number;
  active?: boolean;
  archivedAt?: string | null;
  fixedStartMin?: number | null;
  fixedEndMin?: number | null;
  createdAt?: string;
}

/** v1/v2 projects had no description or notes. */
interface LegacyProject {
  id: string;
  name: string;
  color: PaletteColor;
  order: number;
  archivedAt: string | null;
  description?: string;
  notes?: string;
}

/**
 * Exactly what `partialize` writes — no actions, no undo entry.
 *
 * `motto` is optional and needs no migration step: zustand merges persisted
 * state shallowly over the initial state, so a browser saved before it existed
 * simply keeps the default.
 */
interface PersistedData {
  motto?: string;
  projects: LegacyProject[];
  tasks: LegacyTask[];
  routines: LegacyRoutine[];
  routineLogs: LegacyRoutineLog[];
  timeBlocks?: TimeBlock[];
  workWindows?: WorkWindow[];
  notes: Note[];
  dayLogs: DayLog[];
}

const endFromDuration = (start: number | null, duration?: number | null) =>
  start !== null && duration != null ? start + duration : null;

/**
 * v1 → v2: `day` becomes the nullable `plannedDate`, `dueDate` appears, and a
 * stored `durationMin` is folded into `scheduledEndMin`.
 */
function toV2(data: PersistedData): PersistedData {
  return {
    ...data,
    tasks: (data.tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      detail: t.detail ?? null,
      projectId: t.projectId ?? null,
      size: t.size,
      status: t.status,
      plannedDate: t.plannedDate ?? t.day ?? null,
      dueDate: t.dueDate ?? null,
      order: t.order,
      scheduledStartMin: t.scheduledStartMin ?? null,
      scheduledEndMin:
        t.scheduledEndMin ?? endFromDuration(t.scheduledStartMin ?? null, t.durationMin),
      completedAt: t.completedAt ?? null,
      createdAt: t.createdAt,
    })),
    routineLogs: (data.routineLogs ?? []).map((l) => ({
      id: l.id,
      routineId: l.routineId,
      day: l.day,
      completedAt: l.completedAt ?? null,
      scheduledStartMin: l.scheduledStartMin ?? null,
      scheduledEndMin:
        l.scheduledEndMin ?? endFromDuration(l.scheduledStartMin ?? null, l.durationMin),
    })),
  };
}

/**
 * v2 → v3: projects gain description and notes. Active vs archived was already
 * fully expressed by `archivedAt`, so nothing about status needs migrating.
 */
function toV3(data: PersistedData): PersistedData {
  return {
    ...data,
    projects: (data.projects ?? []).map((p) => ({
      ...p,
      description: p.description ?? "",
      notes: p.notes ?? "",
      archivedAt: p.archivedAt ?? null,
    })),
  };
}

/**
 * Applied in order, so a browser sitting on v1 walks all the way up. Without
 * this, data already saved during real use would fail to match and disappear.
 */
/**
 * v3 → v4: the Schedule's two new layers appear. Purely additive — no field is
 * renamed or reinterpreted, so nothing already saved can break.
 */
function toV4(data: PersistedData): PersistedData {
  return { ...data, timeBlocks: data.timeBlocks ?? [], workWindows: data.workWindows ?? [] };
}

/**
 * v4 → v5: routines get the same archive model as projects, plus an optional
 * fixed time on the template. `active: false` becomes a timestamp so the two
 * can't disagree; past logs are untouched.
 */
function toV5(data: PersistedData): PersistedData {
  const archivedFallback = new Date(0).toISOString();
  return {
    ...data,
    routines: (data.routines ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      weekdays: r.weekdays,
      order: r.order,
      fixedStartMin: r.fixedStartMin ?? null,
      fixedEndMin: r.fixedEndMin ?? null,
      archivedAt: r.archivedAt ?? (r.active === false ? archivedFallback : null),
      createdAt: r.createdAt ?? new Date().toISOString(),
    })),
  };
}

/**
 * v5 → v6: tasks gain `isImportant`. Purely additive and defaulted to false —
 * no field is renamed or reinterpreted, so nothing already saved can break.
 */
function toV6(data: PersistedData): PersistedData {
  return {
    ...data,
    tasks: (data.tasks ?? []).map((t) => ({ ...t, isImportant: t.isImportant ?? false })),
  };
}

export function migratePersisted(persisted: unknown, version: number): PersistedData {
  let data = persisted as PersistedData;
  if (version < 2) data = toV2(data);
  if (version < 3) data = toV3(data);
  if (version < 4) data = toV4(data);
  if (version < 5) data = toV5(data);
  if (version < 6) data = toV6(data);
  return data;
}

// ------------------------------------------------------------------ selectors

const SIZE_RANK: Record<TaskSize, number> = { big: 0, medium: 1, small: 2 };

/** One section of the Today page. Only tasks planned for *that* day. */
export function tasksForDay(tasks: Task[], day: DayKey, size: TaskSize): Task[] {
  return tasks
    .filter((t) => t.plannedDate === day && t.size === size && t.status !== "archived")
    .sort((a, b) => a.order - b.order);
}

/** Everything still to do, anywhere: not done, not archived. */
export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === "open");
}

/** Biggest first inside a group, then by manual rank. */
export function byWeight(a: Task, b: Task): number {
  return SIZE_RANK[a.size] - SIZE_RANK[b.size] || a.order - b.order;
}

export function groupByBucket(tasks: Task[], today: DayKey): Record<DateBucket, Task[]> {
  const groups: Record<DateBucket, Task[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    none: [],
  };
  for (const task of tasks) groups[dateBucket(task.plannedDate, today)].push(task);
  for (const bucket of Object.keys(groups) as DateBucket[]) {
    groups[bucket].sort(
      bucket === "upcoming"
        ? (a, b) => (a.plannedDate ?? "").localeCompare(b.plannedDate ?? "") || byWeight(a, b)
        : byWeight,
    );
  }
  return groups;
}

export function activeProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.archivedAt === null).sort((a, b) => a.order - b.order);
}

export function archivedProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.archivedAt !== null).sort((a, b) => a.order - b.order);
}

/** Open tasks belonging to a project, biggest first. Archived stays hidden. */
export function projectTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId && t.status === "open").sort(byWeight);
}

export function activeRoutines(routines: Routine[]): Routine[] {
  return routines.filter((r) => r.archivedAt === null).sort((a, b) => a.order - b.order);
}

export function archivedRoutines(routines: Routine[]): Routine[] {
  return routines.filter((r) => r.archivedAt !== null).sort((a, b) => a.order - b.order);
}

/** Which routines apply on a given weekday. Archived ones never do. */
export function routinesForDay(routines: Routine[], weekday: number): Routine[] {
  return activeRoutines(routines).filter((r) => r.weekdays.includes(weekday));
}

/**
 * When a routine sits on the rail for one specific date. One rule, no
 * exception engine:
 *
 *   this date's override  →  else the template's fixed time  →  else nowhere
 *
 * `fromOverride` lets the UI tell the two apart — a template time is edited on
 * the routine, an override belongs to the day.
 */
export function routineTimeFor(
  routine: Routine,
  log: RoutineLog | undefined,
): { startMin: number; endMin: number; fromOverride: boolean } | null {
  if (log?.scheduledStartMin != null) {
    return {
      startMin: log.scheduledStartMin,
      endMin: log.scheduledEndMin ?? log.scheduledStartMin + 60,
      fromOverride: true,
    };
  }
  if (routine.fixedStartMin != null) {
    return {
      startMin: routine.fixedStartMin,
      endMin: routine.fixedEndMin ?? routine.fixedStartMin + 60,
      fromOverride: false,
    };
  }
  return null;
}

export function notesForDay(notes: Note[], day: DayKey): Note[] {
  return notes.filter((n) => n.day === day);
}

// ------------------------------------------------------- schedule selectors

/** Every open task planned for this day, biggest first — the sidebar. */
export function dayPlannedTasks(tasks: Task[], day: DayKey): Task[] {
  return tasks.filter((t) => t.plannedDate === day && t.status !== "archived").sort(byWeight);
}

/** Only the ones actually on the rail. */
export function scheduledTasks(tasks: Task[], day: DayKey): Task[] {
  return dayPlannedTasks(tasks, day).filter((t) => t.scheduledStartMin !== null);
}

export function timeBlocksForDay(blocks: TimeBlock[], day: DayKey): TimeBlock[] {
  return blocks.filter((b) => b.day === day).sort((a, b) => a.startMin - b.startMin);
}

export function workWindowsForDay(windows: WorkWindow[], day: DayKey): WorkWindow[] {
  return windows.filter((w) => w.day === day).sort((a, b) => a.startMin - b.startMin);
}

export function routineLogFor(
  logs: RoutineLog[],
  routineId: string,
  day: DayKey,
): RoutineLog | undefined {
  return logs.find((l) => l.routineId === routineId && l.day === day);
}
