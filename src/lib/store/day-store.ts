"use client";

/**
 * The single seam between the UI and storage.
 *
 * Supabase is the source of truth; this store is the in-memory copy the UI
 * reads from. An action changes state immediately — the screen never waits for
 * a network round trip — and then hands the write to the queue, which sends it
 * in order and reports it if it fails.
 *
 * The write calls are one line each and sit directly beneath the `set` that
 * caused them. That is deliberate: the alternative considered was a subscriber
 * that diffed this store and derived the writes, which needs no per-action
 * lines but makes hydration indistinguishable from a mutation — `replaceAll`
 * loading an account would look exactly like the user editing every row at
 * once, and the only thing standing between that and writing a whole dataset
 * into the wrong account would be a suppression flag being right every time.
 * Here `replaceAll` simply does not call `write`, and is silent by
 * construction. The cost is remembering to add the line to a new action.
 */
import { create } from "zustand";

import { copy } from "@/lib/copy";
import { dateBucket, shortDate, todayKey, tomorrowOf } from "@/lib/date";
import { PALETTE } from "@/lib/palette";
import { mergeIntervals } from "@/lib/schedule";
import { newId } from "@/lib/supabase/ids";
import * as repo from "@/lib/supabase/repository";
import { write } from "@/lib/supabase/write-queue";
import type {
  DateBucket,
  DayKey,
  DayLog,
  GoalKpi,
  GoalMonthlyFocus,
  GoalMonthlyKpi,
  MonthlyFocus,
  Note,
  NoteColor,
  PaletteColor,
  Project,
  ProjectGoal,
  Routine,
  RoutineLog,
  Task,
  TaskSize,
  TaskStatus,
  TimeBlock,
  WorkWindow,
} from "@/lib/types";
import { MAX_FOCUS_ITEMS, MAX_GOALS } from "@/lib/types";

/**
 * Ids are real uuids now, because the columns they land in are `uuid`.
 *
 * This used to be `Math.random().toString(36).slice(2, 10)` — eight characters
 * like `qq5emksy`, which Postgres rejects outright. Rows already in a browser
 * from before this change keep their short ids until they are imported, and
 * the importer derives a stable uuid for each; see `supabase/ids.ts`.
 */
const uid = newId;

const DEFAULT_MOTTO = "לעשות פחות, ולעשות את זה כמו שצריך.";

/**
 * Still the version of the *local* shape, and still meaningful: backup files
 * carry it, and a browser that has not been imported yet still holds a v6 blob
 * under `paper-today/day`. `migratePersisted` below is what reads both.
 */
export const STORE_VERSION = 11;

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
  monthlyFocus: MonthlyFocus[];
  goals: ProjectGoal[];
  goalMonthlyFocus: GoalMonthlyFocus[];
  goalMonthlyKpi: GoalMonthlyKpi[];
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
    monthlyFocus: s.monthlyFocus,
    goals: s.goals,
    goalMonthlyFocus: s.goalMonthlyFocus,
    goalMonthlyKpi: s.goalMonthlyKpi,
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
  monthlyFocus: MonthlyFocus[];
  goals: ProjectGoal[];
  goalMonthlyFocus: GoalMonthlyFocus[];
  goalMonthlyKpi: GoalMonthlyKpi[];

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

  /**
   * Rewrites one project-month cell wholesale.
   *
   * Takes the whole list rather than add/edit/remove/reorder actions: all four
   * are "the cell now reads this", the array carries its own order, and one
   * entry point means one keyed write that a burst of typing collapses into.
   *
   * Blank entries are dropped and the rest trimmed, so the caller can hand over
   * a draft with a half-typed third line. An empty result deletes the row —
   * there is no stored empty cell.
   */
  setMonthlyFocus: (projectId: string, year: number, month: number, items: string[]) => void;

  /**
   * Up to `MAX_GOALS` short directions inside a project. Adding a sixth is
   * silently refused client-side — the database refuses it too, via a
   * trigger, since "at most N siblings" can't be a CHECK or a UNIQUE
   * constraint. Returns the new goal's id, or `""` if the cap or a blank
   * title stopped it — mirrors `addProject`'s "return an id either way"
   * shape so a composer never has to branch on failure.
   */
  addGoal: (projectId: string, title: string) => string;
  updateGoal: (id: string, title: string) => void;
  /**
   * Deletes the goal **and** its goal-owned monthly focus, then registers one
   * undo that restores both together. Never silent, never a permanent orphan
   * bin — the same one-shot-undo shape every other delete in this store uses.
   * Project-level `monthly_focus` for the same project is untouched; the two
   * tables don't know about each other.
   */
  deleteGoal: (id: string) => void;
  /** Plain integer positions, rewritten in full — see `0009`'s note on why a
   * five-item list doesn't want the fractional `orderBetween` scheme. */
  reorderGoals: (projectId: string, ids: string[]) => void;
  /**
   * Sets or clears a goal's one optional KPI *definition* — the whole thing,
   * every time, same "set-the-whole-value" contract as `setMonthlyFocus`, not
   * a partial patch. `kpi: null` clears the definition only — it deliberately
   * does **not** touch any `goalMonthlyKpi` rows already recorded. Real
   * measurements someone entered are not "a definition-less KPI value means
   * nothing" the way an empty draft would be; they're history, and this app's
   * standing rule is to never silently delete or reassign data the user
   * entered (see the Goals feature's own legacy-focus handling for the same
   * principle). A cleared goal simply stops *showing* its KPI anywhere until
   * a definition exists again — re-adding one with the same shape brings the
   * old months straight back, since they were never gone. No-ops (leaves the
   * goal untouched) on a blank label or a target that isn't greater than
   * zero, mirroring `0012`'s CHECK constraint client-side, the same way
   * `MAX_GOALS` is mirrored for the count. No undo: re-entering a few small
   * fields is cheap enough not to need one, and nothing is actually lost by
   * clearing it in the first place.
   */
  setGoalKpi: (id: string, kpi: GoalKpi | null) => void;

  /** `GoalMonthlyFocus`'s version of `setMonthlyFocus` — same shape, same
   * "the whole cell, every time" contract, one layer deeper. */
  setGoalMonthlyFocus: (goalId: string, year: number, month: number, items: string[]) => void;
  /**
   * One month's actual measurement toward a goal's KPI. `value: null` deletes
   * the row — no measurement that month, not a stored zero (a real `0` is a
   * legitimate value and is kept). No-ops if the goal has no KPI definition
   * at all: a measurement with nothing to measure against isn't a thing the
   * UI can produce, so this refuses to create one even if called directly.
   */
  setGoalMonthlyKpi: (goalId: string, year: number, month: number, value: number | null) => void;
  /**
   * The one deliberate cross-table move: a project-level cell's items become
   * a goal's cell for the same month, and the project-level row is deleted.
   * Refuses — returns `false`, changes nothing — if the destination already
   * has content, rather than merging or silently dropping the overflow. This
   * is the only path that ever touches "legacy" project-level focus once a
   * project has goals; nothing does it automatically.
   */
  moveMonthlyFocusToGoal: (projectId: string, goalId: string, year: number, month: number) => boolean;

  setMotto: (motto: string) => void;

  /** Restore from a backup: one write, all of it or none of it. */
  replaceAll: (slice: PersistedSlice) => void;

  wrapUpDay: (day: DayKey) => void;
  unwrapDay: (day: DayKey) => void;

  clearUndo: () => void;
  runUndo: () => void;

  /** Empty the in-memory store — sign-out, and before loading another account. */
  clearLocal: () => void;
}

/**
 * An account before anything is loaded into it, and an account that genuinely
 * has nothing in it, are the same picture: empty.
 *
 * This used to start from `buildSeed()`, so a fresh browser opened onto a
 * furnished demo day. That cannot survive the move to a real account — the
 * seed would be written into it as if the user had typed it, and a new user's
 * first sight of their planner would be someone else's tasks. `buildSeed` is
 * still there for development and tests; nothing in the running app calls it.
 */
function emptyState(): PersistedSlice {
  return {
    motto: DEFAULT_MOTTO,
    projects: [],
    tasks: [],
    routines: [],
    routineLogs: [],
    timeBlocks: [],
    workWindows: [],
    notes: [],
    dayLogs: [],
    monthlyFocus: [],
    goals: [],
    goalMonthlyFocus: [],
    goalMonthlyKpi: [],
  };
}

export const useDayStore = create<DayState>()((set, get) => {
  // ---------------------------------------------------------------- persistence
  //
  // One helper per entity. Each queues a write keyed by the row, and looks the
  // row up **inside** the queued closure rather than capturing it here.
  //
  // That lookup-at-send-time is what lets a burst of edits collapse. Typing in
  // a note queues one write on the first keystroke; the rest find that write
  // still queued and skip, and when it finally runs it reads the note as it is
  // by then — the last keystroke, not the first. See `write` in write-queue.ts.
  //
  // A row that has since been deleted simply isn't found, and the write becomes
  // a no-op; the delete queued behind it is what reaches the database.

  const saveTask = (id: string) =>
    write("save task", async () => {
      const row = get().tasks.find((t) => t.id === id);
      if (row) await repo.saveTask(row);
    }, `task:${id}`);

  const saveProject = (id: string) =>
    write("save project", async () => {
      const row = get().projects.find((p) => p.id === id);
      if (row) await repo.saveProject(row);
    }, `project:${id}`);

  const saveRoutine = (id: string) =>
    write("save routine", async () => {
      const row = get().routines.find((r) => r.id === id);
      if (row) await repo.saveRoutine(row);
    }, `routine:${id}`);

  const saveRoutineLog = (id: string) =>
    write("save routine log", async () => {
      const row = get().routineLogs.find((l) => l.id === id);
      if (row) await repo.saveRoutineLog(row);
    }, `routine-log:${id}`);

  const saveTimeBlock = (id: string) =>
    write("save time block", async () => {
      const row = get().timeBlocks.find((b) => b.id === id);
      if (row) await repo.saveTimeBlock(row);
    }, `time-block:${id}`);

  const saveWorkWindow = (id: string) =>
    write("save work window", async () => {
      const row = get().workWindows.find((w) => w.id === id);
      if (row) await repo.saveWorkWindow(row);
    }, `work-window:${id}`);

  const saveNote = (id: string) =>
    write("save note", async () => {
      const row = get().notes.find((n) => n.id === id);
      if (row) await repo.saveNote(row);
    }, `note:${id}`);

  const saveDayLog = (day: DayKey) =>
    write("save day log", async () => {
      const row = get().dayLogs.find((l) => l.day === day);
      if (row) await repo.saveDayLog(row);
    }, `day-log:${day}`);

  const saveMonthlyFocus = (projectId: string, year: number, month: number) =>
    write("save monthly focus", async () => {
      const row = get().monthlyFocus.find(
        (f) => f.projectId === projectId && f.year === year && f.month === month,
      );
      if (row) await repo.saveMonthlyFocus(row);
    }, `focus:${projectId}:${year}:${month}`);

  const saveGoal = (id: string) =>
    write("save goal", async () => {
      const row = get().goals.find((g) => g.id === id);
      if (row) await repo.saveGoal(row);
    }, `goal:${id}`);

  const saveGoalMonthlyFocus = (goalId: string, year: number, month: number) =>
    write("save goal focus", async () => {
      const row = get().goalMonthlyFocus.find(
        (f) => f.goalId === goalId && f.year === year && f.month === month,
      );
      if (row) await repo.saveGoalMonthlyFocus(row);
    }, `goal-focus:${goalId}:${year}:${month}`);

  const saveGoalMonthlyKpi = (goalId: string, year: number, month: number) =>
    write("save goal kpi value", async () => {
      const row = get().goalMonthlyKpi.find(
        (f) => f.goalId === goalId && f.year === year && f.month === month,
      );
      if (row) await repo.saveGoalMonthlyKpi(row);
    }, `goal-kpi:${goalId}:${year}:${month}`);

  /** Patch one task by id, then persist it. */
  const patchTask = (id: string, patch: Partial<Task>) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    saveTask(id);
  };

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
    ...emptyState(),
    undo: null,

    addTask: (plannedDate, size, title, projectId = null) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const id = uid();
      set((s) => ({
        tasks: [
          ...s.tasks,
          {
            id,
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
      saveTask(id);
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
      write("delete task", () => repo.deleteTask(id));
      // Undo re-inserts the row it deleted, under the same id — so the
      // upsert lands on the row that was there before rather than making a
      // second one. Delete-then-recreate is the same round trip either way.
      remember(copy.undo.deleted(task.title), () => {
        set((s) => ({ tasks: [...s.tasks, task] }));
        saveTask(id);
      });
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
      saveProject(id);
      return id;
    },

    updateProject: (id, patch) => {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
      saveProject(id);
    },

    archiveProject: (id) => {
      const project = get().projects.find((p) => p.id === id);
      if (!project || project.archivedAt) return;
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === id ? { ...p, archivedAt: new Date().toISOString() } : p,
        ),
      }));
      saveProject(id);
      remember(copy.undo.projectArchived(project.name), () => get().restoreProject(id));
    },

    restoreProject: (id) => {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, archivedAt: null } : p)),
      }));
      saveProject(id);
    },

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
      saveRoutine(id);
      return id;
    },

    updateRoutine: (id, patch) => {
      set((s) => ({
        routines: s.routines.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          // an end time without a start is meaningless
          if (next.fixedStartMin === null) next.fixedEndMin = null;
          if (patch.weekdays) next.weekdays = [...patch.weekdays].sort((a, b) => a - b);
          return next;
        }),
      }));
      saveRoutine(id);
    },

    archiveRoutine: (id) => {
      const routine = get().routines.find((r) => r.id === id);
      if (!routine || routine.archivedAt) return;
      set((s) => ({
        routines: s.routines.map((r) =>
          // past logs are deliberately left alone: history is not undone
          r.id === id ? { ...r, archivedAt: new Date().toISOString() } : r,
        ),
      }));
      saveRoutine(id);
      remember(copy.undo.routineArchived(routine.title), () => get().restoreRoutine(id));
    },

    restoreRoutine: (id) => {
      set((s) => ({
        routines: s.routines.map((r) => (r.id === id ? { ...r, archivedAt: null } : r)),
      }));
      saveRoutine(id);
    },

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
        saveRoutineLog(existing.id);
        return;
      }
      const id = uid();
      set((s) => ({
        routineLogs: [
          ...s.routineLogs,
          {
            id,
            routineId,
            day,
            completedAt: new Date().toISOString(),
            scheduledStartMin: null,
            scheduledEndMin: null,
          },
        ],
      }));
      saveRoutineLog(id);
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
        saveRoutineLog(existing.id);
        return;
      }
      const id = uid();
      set((s) => ({
        routineLogs: [
          ...s.routineLogs,
          {
            id,
            routineId,
            day,
            completedAt: null,
            scheduledStartMin: startMin,
            scheduledEndMin: startMin === null ? null : endMin,
          },
        ],
      }));
      saveRoutineLog(id);
    },

    addTimeBlock: (day, title, startMin, endMin) => {
      const id = uid();
      set((s) => ({
        timeBlocks: [...s.timeBlocks, { id, day, title: title.trim(), startMin, endMin }],
      }));
      saveTimeBlock(id);
      return id;
    },

    updateTimeBlock: (id, patch) => {
      set((s) => ({
        timeBlocks: s.timeBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
      saveTimeBlock(id);
    },

    deleteTimeBlock: (id) => {
      const block = get().timeBlocks.find((b) => b.id === id);
      if (!block) return;
      set((s) => ({ timeBlocks: s.timeBlocks.filter((b) => b.id !== id) }));
      write("delete time block", () => repo.deleteTimeBlock(id));
      remember(copy.undo.blockRemoved(block.title), () => {
        set((s) => ({ timeBlocks: [...s.timeBlocks, block] }));
        saveTimeBlock(id);
      });
    },

    /**
     * Rewrites a whole day's windows, so persistence is a small diff: rows
     * that survived are re-saved (coalesced per row while typing), rows
     * that vanished are deleted.
     */
    setWorkWindows: (day, windows) => {
      const before = get().workWindows.filter((w) => w.day === day);
      set((s) => ({
        workWindows: [
          ...s.workWindows.filter((w) => w.day !== day),
          ...windows
            // a guard, not an editing rule: the editor never builds one
            .filter((w) => w.endMin > w.startMin)
            // keep ids so a row isn't remounted (and refocused) per keystroke
            .map((w) => ({ id: w.id ?? uid(), day, startMin: w.startMin, endMin: w.endMin })),
        ],
      }));
      const after = get().workWindows.filter((w) => w.day === day);
      const survived = new Set(after.map((w) => w.id));
      for (const w of before) {
        if (!survived.has(w.id)) {
          write("delete work window", () => repo.deleteWorkWindow(w.id), `work-window-delete:${w.id}`);
        }
      }
      for (const w of after) saveWorkWindow(w.id);
    },

    mergeWorkWindows: (day) => {
      const before = get().workWindows.filter((w) => w.day === day);
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
      });
      // Merging mints new ids for the merged rows, so every old row for the
      // day goes and every new one arrives. Deletes first: the queue is
      // ordered, and a day left briefly empty is better than one holding
      // both spellings of the same hours.
      const after = get().workWindows.filter((w) => w.day === day);
      const survived = new Set(after.map((w) => w.id));
      for (const w of before) {
        if (!survived.has(w.id)) {
          write("delete work window", () => repo.deleteWorkWindow(w.id), `work-window-delete:${w.id}`);
        }
      }
      for (const w of after) saveWorkWindow(w.id);
    },

    reorderRoutines: (ids) => {
      set((s) => ({
        routines: s.routines.map((r) => {
          const index = ids.indexOf(r.id);
          return index === -1 ? r : { ...r, order: index + 1 };
        }),
      }));
      for (const id of ids) saveRoutine(id);
    },

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
      saveNote(id);
      return id;
    },

    // Fires per keystroke while typing and per frame while dragging. Both
    // collapse to one queued write at a time — see `saveNote`'s key.
    updateNote: (id, patch) => {
      set((s) => ({ notes: s.notes.map((note) => (note.id === id ? { ...note, ...patch } : note)) }));
      saveNote(id);
    },

    liftNote: (id) => {
      set((s) => {
        const top = Math.max(0, ...s.notes.map((note) => note.z));
        return { notes: s.notes.map((note) => (note.id === id ? { ...note, z: top + 1 } : note)) };
      });
      saveNote(id);
    },

    deleteNote: (id) => {
      const note = get().notes.find((candidate) => candidate.id === id);
      if (!note) return;
      set((s) => ({ notes: s.notes.filter((candidate) => candidate.id !== id) }));
      write("delete note", () => repo.deleteNote(id), `note-delete:${id}`);
      if (note.body.trim())
        remember(copy.notes.removed, () => {
          set((s) => ({ notes: [...s.notes, note] }));
          saveNote(id);
        });
    },

    setMonthlyFocus: (projectId, year, month, items) => {
      const cleaned = items
        .map((i) => i.trim())
        .filter(Boolean)
        .slice(0, MAX_FOCUS_ITEMS);

      const matches = (f: MonthlyFocus) =>
        f.projectId === projectId && f.year === year && f.month === month;
      const existing = get().monthlyFocus.find(matches);

      // Nothing left in the cell: the row goes. Ordering matters — the delete
      // is queued *after* any save still sitting in front of it, so the queue
      // ends on the delete rather than resurrecting the row behind it.
      if (cleaned.length === 0) {
        if (!existing) return;
        set((s) => ({ monthlyFocus: s.monthlyFocus.filter((f) => !matches(f)) }));
        write(
          "delete monthly focus",
          () => repo.deleteMonthlyFocus(projectId, year, month),
          `focus-delete:${projectId}:${year}:${month}`,
        );
        return;
      }

      // Unchanged cells are common — the editor commits on blur whether or not
      // anything was typed, and a no-op write would still cost a round trip.
      if (
        existing &&
        existing.items.length === cleaned.length &&
        existing.items.every((item, i) => item === cleaned[i])
      ) {
        return;
      }

      set((s) => ({
        monthlyFocus: existing
          ? s.monthlyFocus.map((f) => (matches(f) ? { ...f, items: cleaned } : f))
          : [...s.monthlyFocus, { projectId, year, month, items: cleaned }],
      }));
      saveMonthlyFocus(projectId, year, month);
    },

    addGoal: (projectId, title) => {
      const trimmed = title.trim();
      const id = uid();
      if (!trimmed) return "";
      const mine = get().goals.filter((g) => g.projectId === projectId);
      if (mine.length >= MAX_GOALS) return "";
      set((s) => ({
        goals: [...s.goals, { id, projectId, title: trimmed, order: mine.length, kpi: null }],
      }));
      saveGoal(id);
      return id;
    },

    updateGoal: (id, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, title: trimmed } : g)) }));
      saveGoal(id);
    },

    deleteGoal: (id) => {
      const goal = get().goals.find((g) => g.id === id);
      if (!goal) return;
      // Captured before the delete, so undo has exactly what to put back —
      // the same shape `deleteNote` already uses for a single row, just
      // carrying the goal's focus and KPI history along with it.
      const focus = get().goalMonthlyFocus.filter((f) => f.goalId === id);
      const kpiValues = get().goalMonthlyKpi.filter((f) => f.goalId === id);

      set((s) => ({
        goals: s.goals.filter((g) => g.id !== id),
        goalMonthlyFocus: s.goalMonthlyFocus.filter((f) => f.goalId !== id),
        goalMonthlyKpi: s.goalMonthlyKpi.filter((f) => f.goalId !== id),
      }));
      // One delete reaches the database — the FK cascade takes the goal's
      // focus rows and KPI values with it server-side, so there is nothing
      // else to queue.
      write("delete goal", () => repo.deleteGoal(id), `goal-delete:${id}`);

      remember(copy.undo.goalDeleted(goal.title), () => {
        set((s) => ({
          goals: [...s.goals, goal],
          goalMonthlyFocus: [...s.goalMonthlyFocus, ...focus],
          goalMonthlyKpi: [...s.goalMonthlyKpi, ...kpiValues],
        }));
        saveGoal(id);
        for (const f of focus) saveGoalMonthlyFocus(f.goalId, f.year, f.month);
        for (const v of kpiValues) saveGoalMonthlyKpi(v.goalId, v.year, v.month);
      });
    },

    reorderGoals: (projectId, ids) => {
      set((s) => ({
        goals: s.goals.map((g) => {
          if (g.projectId !== projectId) return g;
          const index = ids.indexOf(g.id);
          return index === -1 ? g : { ...g, order: index };
        }),
      }));
      for (const id of ids) saveGoal(id);
    },

    setGoalKpi: (id, kpi) => {
      if (kpi) {
        const label = kpi.label.trim();
        if (!label || !(kpi.target > 0)) return;
        kpi = {
          label,
          target: kpi.target,
          unit: kpi.unit?.trim() || null,
          targetLabel: kpi.targetLabel?.trim() || null,
        };
      }
      set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, kpi } : g)) }));
      saveGoal(id);
    },

    setGoalMonthlyFocus: (goalId, year, month, items) => {
      const cleaned = items
        .map((i) => i.trim())
        .filter(Boolean)
        .slice(0, MAX_FOCUS_ITEMS);

      const matches = (f: GoalMonthlyFocus) =>
        f.goalId === goalId && f.year === year && f.month === month;
      const existing = get().goalMonthlyFocus.find(matches);

      if (cleaned.length === 0) {
        if (!existing) return;
        set((s) => ({ goalMonthlyFocus: s.goalMonthlyFocus.filter((f) => !matches(f)) }));
        write(
          "delete goal focus",
          () => repo.deleteGoalMonthlyFocus(goalId, year, month),
          `goal-focus-delete:${goalId}:${year}:${month}`,
        );
        return;
      }

      if (
        existing &&
        existing.items.length === cleaned.length &&
        existing.items.every((item, i) => item === cleaned[i])
      ) {
        return;
      }

      const goal = get().goals.find((g) => g.id === goalId);
      set((s) => ({
        goalMonthlyFocus: existing
          ? s.goalMonthlyFocus.map((f) => (matches(f) ? { ...f, items: cleaned } : f))
          : [
              ...s.goalMonthlyFocus,
              // `projectId` is carried for the database's ownership check —
              // if the goal has since vanished from this in-memory copy there
              // is nothing sound to write, so the call is dropped rather than
              // sent with a guessed project.
              ...(goal ? [{ goalId, projectId: goal.projectId, year, month, items: cleaned }] : []),
            ],
      }));
      if (existing || goal) saveGoalMonthlyFocus(goalId, year, month);
    },

    setGoalMonthlyKpi: (goalId, year, month, value) => {
      const matches = (f: GoalMonthlyKpi) =>
        f.goalId === goalId && f.year === year && f.month === month;
      const existing = get().goalMonthlyKpi.find(matches);

      if (value === null) {
        if (!existing) return;
        set((s) => ({ goalMonthlyKpi: s.goalMonthlyKpi.filter((f) => !matches(f)) }));
        write(
          "delete goal kpi value",
          () => repo.deleteGoalMonthlyKpi(goalId, year, month),
          `goal-kpi-delete:${goalId}:${year}:${month}`,
        );
        return;
      }
      if (!Number.isFinite(value) || value < 0) return;
      if (existing && existing.value === value) return;

      // A measurement with no KPI to measure against isn't a state the UI
      // can produce — see the note on this action in `DayState`.
      const goal = get().goals.find((g) => g.id === goalId);
      if (!goal?.kpi) return;

      set((s) => ({
        goalMonthlyKpi: existing
          ? s.goalMonthlyKpi.map((f) => (matches(f) ? { ...f, value } : f))
          : [...s.goalMonthlyKpi, { goalId, projectId: goal.projectId, year, month, value }],
      }));
      saveGoalMonthlyKpi(goalId, year, month);
    },

    moveMonthlyFocusToGoal: (projectId, goalId, year, month) => {
      const source = get().monthlyFocus.find(
        (f) => f.projectId === projectId && f.year === year && f.month === month,
      );
      if (!source) return false;

      // Never merged, never truncated: a destination that already holds
      // anything stops the move outright rather than guessing how to combine
      // the two. A goal-focus row only ever exists with 1–3 real items in it
      // (see `GoalMonthlyFocus`), so "the row exists" already means "there is
      // content there."
      const occupied = get().goalMonthlyFocus.some(
        (f) => f.goalId === goalId && f.year === year && f.month === month,
      );
      if (occupied) return false;

      set((s) => ({
        monthlyFocus: s.monthlyFocus.filter((f) => f !== source),
        goalMonthlyFocus: [...s.goalMonthlyFocus, { goalId, projectId, year, month, items: source.items }],
      }));
      write(
        "delete monthly focus",
        () => repo.deleteMonthlyFocus(projectId, year, month),
        `focus-delete:${projectId}:${year}:${month}`,
      );
      saveGoalMonthlyFocus(goalId, year, month);
      return true;
    },

    setMotto: (motto) => {
      const trimmed = motto.trim();
      set({ motto: trimmed });
      write("save motto", () => repo.saveMotto(get().motto), "motto");
    },

    /**
     * Replaces the whole in-memory slice **without writing anything**.
     *
     * This is how an account is loaded, and how one is cleared on the way
     * out. It must stay silent: a load that wrote back everything it just
     * read would, after an account switch, write one account's data into
     * another's. That is the entire reason the writes above are explicit
     * per action rather than derived from watching this store.
     */
    replaceAll: (slice) => set({ ...persistedSlice(slice), undo: null }),

    wrapUpDay: (day) => {
      set((s) => ({
        dayLogs: [
          ...s.dayLogs.filter((log) => log.day !== day),
          { day, wrappedAt: new Date().toISOString(), reflection: null },
        ],
      }));
      saveDayLog(day);
    },

    unwrapDay: (day) => {
      set((s) => ({ dayLogs: s.dayLogs.filter((log) => log.day !== day) }));
      write("delete day log", () => repo.deleteDayLog(day), `day-log-delete:${day}`);
    },

    clearUndo: () => set({ undo: null }),

    runUndo: () => {
      const entry = get().undo;
      if (!entry) return;
      entry.undo();
      set({ undo: null });
    },

    /**
     * Empties the in-memory store. Used when signing out and before
     * loading a different account, so one account's rows are never on
     * screen — or reachable by a stray write — while another's are loading.
     *
     * Silent, for the same reason `replaceAll` is.
     */
    clearLocal: () => set({ ...emptyState(), undo: null }),
  };
});

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
  monthlyFocus?: MonthlyFocus[];
  goals?: ProjectGoal[];
  goalMonthlyFocus?: GoalMonthlyFocus[];
  goalMonthlyKpi?: GoalMonthlyKpi[];
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

/**
 * v6 → v7: the annual map appears. Purely additive and defaulted to empty — no
 * field is renamed or reinterpreted, so nothing already saved can break. A
 * backup written before this simply has no focus data, which is the same thing
 * as having none.
 */
function toV7(data: PersistedData): PersistedData {
  return { ...data, monthlyFocus: data.monthlyFocus ?? [] };
}

/**
 * v7 → v8: project goals appear, and monthly focus can belong to one instead
 * of directly to a project. Purely additive and defaulted to empty, same as
 * `toV7` — a backup written before goals existed simply has none, and every
 * one of its `monthlyFocus` rows is still exactly what it was: project-level.
 */
function toV8(data: PersistedData): PersistedData {
  return { ...data, goals: data.goals ?? [], goalMonthlyFocus: data.goalMonthlyFocus ?? [] };
}

/**
 * v8 → v9: each goal gains an optional KPI. Purely additive and defaulted to
 * `null` — a goal saved before the KPI feature existed simply has none, same
 * shape as every other version step here.
 */
function toV9(data: PersistedData): PersistedData {
  return { ...data, goals: (data.goals ?? []).map((g) => ({ ...g, kpi: g.kpi ?? null })) };
}

/**
 * v9 → v10: a goal's KPI splits into a fixed definition (`label`, `target`,
 * `unit`) and separate monthly measurements — `current` no longer lives on
 * the goal. Carrying forward an existing `current` as a lost number would be
 * exactly the "silently discard data" this app avoids everywhere else, so it
 * becomes one `goalMonthlyKpi` row instead, dated to whichever month this
 * migration happens to run in — the identical choice `0015` makes on the
 * server for the same reason, at the same granularity: "now" is the best
 * available answer, since the old model never recorded a real one.
 */
function toV10(data: PersistedData): PersistedData {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const carried: GoalMonthlyKpi[] = [];

  const goals = (data.goals ?? []).map((g) => {
    const kpi = g.kpi as (GoalKpi & { current?: number }) | null;
    if (kpi && typeof kpi.current === "number") {
      carried.push({ goalId: g.id, projectId: g.projectId, year, month, value: kpi.current });
      return { ...g, kpi: { label: kpi.label, target: kpi.target, unit: kpi.unit, targetLabel: null } };
    }
    return g;
  });

  return { ...data, goals, goalMonthlyKpi: [...(data.goalMonthlyKpi ?? []), ...carried] };
}

/**
 * v10 → v11: a goal's KPI gains `targetLabel`, an optional free-text display
 * sentence separate from the numeric `target` — see `0017` and `kpiTargetText`.
 * Purely additive and defaulted to `null`: a KPI saved before this existed
 * simply has none, and falls back to the numeric target + unit wherever it's
 * shown, exactly as if it had always been `null`.
 */
function toV11(data: PersistedData): PersistedData {
  return {
    ...data,
    goals: (data.goals ?? []).map((g) =>
      g.kpi ? { ...g, kpi: { ...g.kpi, targetLabel: g.kpi.targetLabel ?? null } } : g,
    ),
  };
}

export function migratePersisted(persisted: unknown, version: number): PersistedData {
  let data = persisted as PersistedData;
  if (version < 2) data = toV2(data);
  if (version < 3) data = toV3(data);
  if (version < 4) data = toV4(data);
  if (version < 5) data = toV5(data);
  if (version < 6) data = toV6(data);
  if (version < 7) data = toV7(data);
  if (version < 8) data = toV8(data);
  if (version < 9) data = toV9(data);
  if (version < 10) data = toV10(data);
  if (version < 11) data = toV11(data);
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

// ---------------------------------------------------------- annual selectors

/**
 * One cell. `undefined` rather than an empty row, because "no focus set" and
 * "a focus cell holding nothing" are the same state and only one of them is
 * representable — see `MonthlyFocus`.
 */
export function focusFor(
  focus: MonthlyFocus[],
  projectId: string,
  year: number,
  month: number,
): MonthlyFocus | undefined {
  return focus.find((f) => f.projectId === projectId && f.year === year && f.month === month);
}

/** Just the text of one cell, ready to render or edit. Empty when unset. */
export function focusItems(
  focus: MonthlyFocus[],
  projectId: string,
  year: number,
  month: number,
): string[] {
  return focusFor(focus, projectId, year, month)?.items ?? [];
}

/**
 * Years that actually hold something, plus the current one, ascending.
 *
 * The year control does not need to stop at these — you can always page into
 * an empty year — but knowing which years have content is what lets the UI say
 * so rather than making you hunt.
 */
export function yearsWithFocus(focus: MonthlyFocus[], currentYear: number): number[] {
  return [...new Set([currentYear, ...focus.map((f) => f.year)])].sort((a, b) => a - b);
}

// ------------------------------------------------------------ project goals

/** A project's goals, in the plain integer order they're stored in. */
export function goalsForProject(goals: ProjectGoal[], projectId: string): ProjectGoal[] {
  return goals.filter((g) => g.projectId === projectId).sort((a, b) => a.order - b.order);
}

/**
 * The annual-view branch, in one place: a project with any goals shows one
 * row per goal and becomes a group label, a project with none shows its own
 * single row exactly as it always has. Called from both the matrix and the
 * month panel so the two surfaces can never disagree about which mode a
 * project is in.
 */
export function projectHasGoals(goals: ProjectGoal[], projectId: string): boolean {
  return goals.some((g) => g.projectId === projectId);
}

export function goalFocusFor(
  focus: GoalMonthlyFocus[],
  goalId: string,
  year: number,
  month: number,
): GoalMonthlyFocus | undefined {
  return focus.find((f) => f.goalId === goalId && f.year === year && f.month === month);
}

export function goalFocusItems(
  focus: GoalMonthlyFocus[],
  goalId: string,
  year: number,
  month: number,
): string[] {
  return goalFocusFor(focus, goalId, year, month)?.items ?? [];
}

/**
 * One month's measurement toward a goal's KPI, keyed by the real calendar
 * (year, month) — not a "display year," so a rolling window spanning two
 * calendar years reads the correct value on either side of the boundary the
 * same way `goalFocusFor` already does for focus items.
 */
export function goalMonthlyKpiFor(
  values: GoalMonthlyKpi[],
  goalId: string,
  year: number,
  month: number,
): GoalMonthlyKpi | undefined {
  return values.find((f) => f.goalId === goalId && f.year === year && f.month === month);
}

/** Just the number, ready to render or edit. `null` when that month has no
 * measurement — never `0`, since a real zero is a legitimate value. */
export function goalMonthlyKpiValue(
  values: GoalMonthlyKpi[],
  goalId: string,
  year: number,
  month: number,
): number | null {
  return goalMonthlyKpiFor(values, goalId, year, month)?.value ?? null;
}

/**
 * Project-level focus that predates the project's goals — the exact
 * "surface it, let me move it or delete it" case from the Project screen.
 * Once a project has goals this is the only place its `monthly_focus` rows
 * are still reachable at all; the annual view stops showing the project's own
 * row the moment it has even one goal.
 */
export function legacyFocusForProject(focus: MonthlyFocus[], projectId: string): MonthlyFocus[] {
  return focus
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
