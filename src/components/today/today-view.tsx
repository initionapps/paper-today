"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  archivedRoutines,
  notesForDay,
  routineLogFor,
  routineTimeFor,
  routinesForDay,
  tasksForDay,
  useDayStore,
} from "@/lib/store/day-store";
import { useAccountReady } from "@/lib/supabase/account";
import { todayKey, weekdayIndex } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { Task, TaskSize } from "@/lib/types";

import { BigTask } from "./big-task";
import { DayHeader } from "./day-header";
import { InlineComposer } from "./inline-composer";
import { MediumTask } from "./medium-task";
import { MottoLine } from "./motto-line";
import { NotesArea } from "./notes-area";
import { RoutineLine } from "./routine-line";
import { RoutineEditor } from "./routine-editor";
import { Section } from "@/components/ui/section";
import { SmallTask } from "./small-task";
import { UndoToast } from "./undo-toast";
import { WrapUpDay } from "./wrap-up-day";

export function TodayView() {
  const [day] = useState(todayKey);
  // Supabase is the source of truth now; this is the account load, not a
  // localStorage read. See lib/supabase/account.ts.
  const hydrated = useAccountReady();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [newRoutineOpen, setNewRoutineOpen] = useState(false);
  const [showArchivedRoutines, setShowArchivedRoutines] = useState(false);

  const tasks = useDayStore((s) => s.tasks);
  const projects = useDayStore((s) => s.projects);
  const routines = useDayStore((s) => s.routines);
  const routineLogs = useDayStore((s) => s.routineLogs);
  const notes = useDayStore((s) => s.notes);
  const dayLogs = useDayStore((s) => s.dayLogs);

  const addTask = useDayStore((s) => s.addTask);
  const placeTask = useDayStore((s) => s.placeTask);
  const reorderRoutines = useDayStore((s) => s.reorderRoutines);
  const addRoutine = useDayStore((s) => s.addRoutine);
  const unwrapDay = useDayStore((s) => s.unwrapDay);

  const sections = useMemo(
    () => ({
      big: tasksForDay(tasks, day, "big"),
      medium: tasksForDay(tasks, day, "medium"),
      small: tasksForDay(tasks, day, "small"),
    }),
    [tasks, day],
  );

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const dayRoutines = useMemo(() => routinesForDay(routines, weekdayIndex(day)), [routines, day]);
  const archivedRoutineList = useMemo(() => archivedRoutines(routines), [routines]);
  const doneRoutines = useMemo(
    () => new Set(routineLogs.filter((l) => l.day === day && l.completedAt).map((l) => l.routineId)),
    [routineLogs, day],
  );
  /** Resolved per routine for *this* date — override, else template, else none. */
  const routineTimes = useMemo(
    () =>
      new Map(
        dayRoutines.map((r) => [r.id, routineTimeFor(r, routineLogFor(routineLogs, r.id, day))]),
      ),
    [dayRoutines, routineLogs, day],
  );
  const dayNotes = useMemo(() => notesForDay(notes, day), [notes, day]);

  const allTasks = [...sections.big, ...sections.medium, ...sections.small];
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const unfinished = allTasks.filter((t) => t.status !== "done");
  const wrappedAt = dayLogs.find((l) => l.day === day)?.wrappedAt ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Which section an id belongs to — a task id, or a section's own drop id. */
  const containerOf = (id: string): TaskSize | undefined => {
    if (id.startsWith("drop:")) return id.slice(5) as TaskSize;
    return tasks.find((t) => t.id === id)?.size;
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  // Cross-section moves are applied live, so the page reflows under the cursor
  // and you can see the task becoming a different size.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.type !== "task") return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;

    const items = sections[to];
    const overIndex = items.findIndex((t) => t.id === String(over.id));
    placeTask(String(active.id), to, overIndex >= 0 ? overIndex : items.length);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;

    if (active.data.current?.type === "routine") {
      if (over.data.current?.type !== "routine" || active.id === over.id) return;
      const ids = dayRoutines.map((r) => r.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from !== -1 && to !== -1) reorderRoutines(arrayMove(ids, from, to));
      return;
    }

    const container = containerOf(String(over.id));
    if (!container) return;

    const items = sections[container];
    const oldIndex = items.findIndex((t) => t.id === String(active.id));
    const overIndex = items.findIndex((t) => t.id === String(over.id));
    const newIndex = overIndex >= 0 ? overIndex : Math.max(0, items.length - 1);
    if (oldIndex !== newIndex || oldIndex === -1) placeTask(String(active.id), container, newIndex);
  };

  const dragging =
    activeId !== null
      ? (tasks.find((t) => t.id === activeId) ?? dayRoutines.find((r) => r.id === activeId) ?? null)
      : null;

  if (!hydrated) return <div className="min-h-[70vh]" />;

  return (
    <>
      <DayHeader day={day} done={doneCount} total={allTasks.length} />

      <MottoLine />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* -------------------------------------------------------- big */}
        <Section title={copy.sections.big} accent="blue" count={sections.big.length} className="mt-14">
          <SectionDrop size="big">
            <SortableContext items={sections.big.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-5 space-y-3">
                {sections.big.map((task) => (
                  <BigTask
                    key={task.id}
                    task={task}
                    project={projectById.get(task.projectId ?? "")}
                    today={day}
                  />
                ))}
              </div>
            </SortableContext>
            <InlineComposer
              variant="big"
              prompt={copy.compose.big}
              onAdd={(title) => addTask(day, "big", title)}
              className="mt-3"
            />
          </SectionDrop>
        </Section>

        {/* ----------------------------------------------------- medium */}
        <Section
          title={copy.sections.medium}
          accent="purple"
          count={sections.medium.length}
          className="mt-16"
        >
          <SectionDrop size="medium">
            <SortableContext items={sections.medium.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {sections.medium.map((task) => (
                  <MediumTask
                    key={task.id}
                    task={task}
                    project={projectById.get(task.projectId ?? "")}
                    today={day}
                  />
                ))}
              </div>
            </SortableContext>
            <InlineComposer
              variant="medium"
              prompt={copy.compose.medium}
              onAdd={(title) => addTask(day, "medium", title)}
              className="mt-2"
            />
          </SectionDrop>
        </Section>

        {/* ------------------------------------------------------ small */}
        <Section title={copy.sections.small} accent="grey" count={sections.small.length} className="mt-16">
          <SectionDrop size="small">
            <SortableContext items={sections.small.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                {sections.small.map((task) => (
                  <SmallTask
                    key={task.id}
                    task={task}
                    project={projectById.get(task.projectId ?? "")}
                    today={day}
                  />
                ))}
              </div>
            </SortableContext>
            <InlineComposer
              variant="small"
              prompt={copy.compose.small}
              onAdd={(title) => addTask(day, "small", title)}
              className="mt-1"
            />
          </SectionDrop>
        </Section>

        {/* --------------------------------------------------- routines */}
        <Section
          title={copy.sections.routines}
          accent="teal"
          count={dayRoutines.length}
          className="mt-16"
        >
          <SortableContext items={dayRoutines.map((r) => r.id)} strategy={rectSortingStrategy}>
            <div className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {dayRoutines.map((routine) => (
                <RoutineLine
                  key={routine.id}
                  routine={routine}
                  day={day}
                  done={doneRoutines.has(routine.id)}
                  time={routineTimes.get(routine.id) ?? null}
                />
              ))}
            </div>
          </SortableContext>

          {/* same ghost line as every other section; it opens the editor
              because a routine needs a recurrence, not just a title */}
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setNewRoutineOpen(true)}
              className="group/add flex w-full cursor-text items-center gap-2.5 py-2 text-start text-text-3 transition-colors duration-200 hover:text-text-2"
            >
              <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border border-line text-[13px] leading-none transition-colors duration-200 group-hover/add:border-teal/45 group-hover/add:text-teal">
                +
              </span>
              <span className="text-[13.5px]">{copy.compose.routine}</span>
            </button>

            <RoutineEditor
              open={newRoutineOpen}
              onClose={() => setNewRoutineOpen(false)}
              onSave={(draft) => addRoutine(draft)}
            />
          </div>

          {archivedRoutineList.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowArchivedRoutines((v) => !v)}
                className="cursor-pointer text-[12px] text-text-3 transition-colors hover:text-text-2"
              >
                {showArchivedRoutines
                  ? copy.routines.hideArchived
                  : copy.routines.showArchived(archivedRoutineList.length)}
              </button>

              {showArchivedRoutines && (
                <div className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {archivedRoutineList.map((routine) => (
                    <RoutineLine
                      key={routine.id}
                      routine={routine}
                      day={day}
                      done={doneRoutines.has(routine.id)}
                      time={null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.7,.3,1)" }}>
          {dragging ? <DragGhost item={dragging} /> : null}
        </DragOverlay>
      </DndContext>

      <NotesArea day={day} notes={dayNotes} />

      {/* ------------------------------------------------------- footer */}
      <footer className="mt-16 border-t border-line-soft pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] tabular-nums text-text-3">
            {wrappedAt
              ? copy.footer.closedAt(
                  new Date(wrappedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
                )
              : copy.footer.status(doneCount, unfinished.length)}
          </span>
          {wrappedAt ? (
            <button
              type="button"
              onClick={() => unwrapDay(day)}
              className="cursor-pointer rounded-lg px-2 py-1 text-[13.5px] font-medium text-blue transition-colors hover:bg-blue-soft"
            >
              {copy.footer.reopen}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setWrapOpen(true)}
              className="shadow-flat cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-[13.5px] font-medium text-text-2 transition-all hover:border-blue/35 hover:text-blue"
            >
              {copy.footer.wrapUp}
            </button>
          )}
        </div>

        {/*
          The "reset to demo data" link used to live here. It refilled the store
          from `buildSeed()`, which was harmless when the store was one
          browser's localStorage and is not harmless now: every seeded row would
          be written into the signed-in account as though the user had typed it.
          There is no safe version of this button against a real account, so it
          is gone rather than rewired.
        */}
      </footer>

      <WrapUpDay
        day={day}
        open={wrapOpen}
        onClose={() => setWrapOpen(false)}
        unfinished={unfinished}
        doneCount={doneCount}
      />
      <UndoToast />
    </>
  );
}

/** A section is a drop target in its own right, so an empty one still accepts. */
function SectionDrop({ size, children }: { size: TaskSize; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${size}`, data: { type: "section", size } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "-mx-3 rounded-2xl px-3 transition-colors duration-200",
        isOver && "bg-blue-soft/70",
      )}
    >
      {children}
    </div>
  );
}

/** What you're holding: the card lifted off the page. */
function DragGhost({ item }: { item: Task | { id: string; title: string } }) {
  const size = "size" in item ? item.size : "small";
  return (
    <div
      className={cn(
        "shadow-drag cursor-grabbing rounded-xl border border-line-soft bg-surface",
        size === "big" ? "px-6 py-5" : size === "medium" ? "px-4 py-3.5" : "px-3.5 py-2.5",
      )}
    >
      <span
        className={cn(
          "text-text",
          size === "big"
            ? "font-display text-[1.75rem] font-semibold tracking-[-0.015em]"
            : size === "medium"
              ? "text-[16px] font-medium"
              : "text-[14px]",
        )}
      >
        {item.title}
      </span>
    </div>
  );
}
