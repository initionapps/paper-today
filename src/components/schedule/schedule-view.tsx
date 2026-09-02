"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { UndoToast } from "@/components/today/undo-toast";
import {
  dayPlannedTasks,
  routineLogFor,
  routineTimeFor,
  routinesForDay,
  timeBlocksForDay,
  useDayStore,
  workWindowsForDay,
} from "@/lib/store/day-store";
import { shiftDay, todayKey, weekdayIndex } from "@/lib/date";
import {
  DAY_MIN,
  DEFAULT_BLOCK_BY_SIZE,
  DEFAULT_BLOCK_MIN,
  clampMin,
  dayCapacity,
  nowMinutes,
  pxToMin,
  snap,
} from "@/lib/schedule";
import { copy } from "@/lib/copy";
import type { DayKey } from "@/lib/types";

import { ScheduleHeader } from "./schedule-header";
import { ScheduleSidebar, type SidebarRoutine } from "./schedule-sidebar";
import { Timeline, type RailRoutine } from "./timeline";

export function ScheduleView() {
  const [day, setDay] = useState<DayKey>(todayKey);
  const [hydrated, setHydrated] = useState(false);
  const [nowMin, setNowMin] = useState(() => nowMinutes());
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.resolve(useDayStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);

  // the line only has to be minute-accurate
  useEffect(() => {
    const timer = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const tasks = useDayStore((s) => s.tasks);
  const projects = useDayStore((s) => s.projects);
  const routines = useDayStore((s) => s.routines);
  const routineLogs = useDayStore((s) => s.routineLogs);
  const timeBlocks = useDayStore((s) => s.timeBlocks);
  const workWindows = useDayStore((s) => s.workWindows);

  const scheduleTask = useDayStore((s) => s.scheduleTask);
  const scheduleRoutine = useDayStore((s) => s.scheduleRoutine);
  const toggleTask = useDayStore((s) => s.toggleTask);
  const toggleRoutine = useDayStore((s) => s.toggleRoutine);
  const toggleImportant = useDayStore((s) => s.toggleImportant);
  const addTimeBlock = useDayStore((s) => s.addTimeBlock);
  const updateTimeBlock = useDayStore((s) => s.updateTimeBlock);
  const deleteTimeBlock = useDayStore((s) => s.deleteTimeBlock);

  const today = todayKey();
  const isToday = day === today;

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const dayTasks = useMemo(() => dayPlannedTasks(tasks, day), [tasks, day]);
  const blocks = useMemo(() => timeBlocksForDay(timeBlocks, day), [timeBlocks, day]);
  const windows = useMemo(() => workWindowsForDay(workWindows, day), [workWindows, day]);

  const dayRoutines = useMemo(
    () => routinesForDay(routines, weekdayIndex(day)),
    [routines, day],
  );

  const sidebarRoutines: SidebarRoutine[] = useMemo(
    () =>
      dayRoutines.map((routine) => {
        const log = routineLogFor(routineLogs, routine.id, day);
        // the template's fixed time counts as scheduled — no dragging needed
        const time = routineTimeFor(routine, log);
        return {
          routine,
          startMin: time?.startMin ?? null,
          endMin: time?.endMin ?? null,
          fromOverride: time?.fromOverride ?? false,
          done: !!log?.completedAt,
        };
      }),
    [dayRoutines, routineLogs, day],
  );

  const railTasks = useMemo(
    () => dayTasks.filter((t) => t.scheduledStartMin !== null),
    [dayTasks],
  );
  const railRoutines: RailRoutine[] = useMemo(
    () =>
      sidebarRoutines
        .filter((r) => r.startMin !== null)
        .map((r) => ({
          routine: r.routine,
          startMin: r.startMin!,
          endMin: r.endMin ?? r.startMin! + DEFAULT_BLOCK_MIN,
          done: r.done,
          fromOverride: r.fromOverride,
        })),
    [sidebarRoutines],
  );

  const scheduledIntervals = useMemo(
    () => [
      ...railTasks.map((t) => ({
        startMin: t.scheduledStartMin!,
        endMin: t.scheduledEndMin ?? t.scheduledStartMin! + DEFAULT_BLOCK_MIN,
      })),
      ...railRoutines.map((r) => ({ startMin: r.startMin, endMin: r.endMin })),
    ],
    [railTasks, railRoutines],
  );

  const capacity = useMemo(
    () => dayCapacity(windows, blocks, scheduledIntervals),
    [windows, blocks, scheduledIntervals],
  );

  const scheduledMin = scheduledIntervals.reduce((sum, i) => sum + (i.endMin - i.startMin), 0);
  // counts what the sidebar's active list actually shows, so the header can't
  // promise more outstanding work than is listed under it
  const unscheduledCount =
    dayTasks.filter((t) => t.scheduledStartMin === null && t.status !== "done").length +
    sidebarRoutines.filter((r) => r.startMin === null && !r.done).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /**
   * How long the block should be after this drop.
   *
   * Moving an existing block keeps its length. A *first* placement gets a
   * default from the task's size — 30 minutes for a small one, an hour
   * otherwise. That default is used to build the block and nothing else: no
   * duration is ever written to the task, and resizing afterwards is free.
   */
  const blockLengthFor = (data: {
    kind?: string;
    id?: string;
    startMin?: number;
    endMin?: number;
  }): number => {
    if (data.startMin !== undefined && data.endMin !== undefined) {
      return data.endMin - data.startMin;
    }
    if (data.kind === "task") {
      const task = tasks.find((t) => t.id === data.id);
      if (!task) return DEFAULT_BLOCK_MIN;
      // already on the rail and dragged from the list again — keep its length
      if (task.scheduledStartMin !== null && task.scheduledEndMin !== null) {
        return task.scheduledEndMin - task.scheduledStartMin;
      }
      return DEFAULT_BLOCK_BY_SIZE[task.size];
    }
    if (data.kind === "routine") {
      const routine = routines.find((r) => r.id === data.id);
      const time = routine && routineTimeFor(routine, routineLogFor(routineLogs, data.id!, day));
      if (time) return time.endMin - time.startMin;
    }
    return DEFAULT_BLOCK_MIN;
  };

  /**
   * One formula for every drop: where the dragged element's top edge landed,
   * measured against the rail, snapped to 15 minutes. It works the same whether
   * the item came from the sidebar or was already on the rail.
   */
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over?.id !== "timeline") return;
    const rail = contentRef.current;
    const translated = active.rect.current.translated;
    if (!rail || !translated) return;

    const data = active.data.current as { kind?: string; id?: string; startMin?: number; endMin?: number };
    if (!data?.kind || !data.id) return;

    const length = blockLengthFor(data);

    const offsetPx = translated.top - rail.getBoundingClientRect().top;
    const start = Math.min(clampMin(snap(pxToMin(offsetPx))), DAY_MIN - length);
    const end = start + length;

    if (data.kind === "task") scheduleTask(data.id, start, end);
    if (data.kind === "routine") scheduleRoutine(data.id, day, start, end);
    if (data.kind === "block") updateTimeBlock(data.id, { startMin: start, endMin: end });
  };

  if (!hydrated) return <div className="min-h-[70vh]" />;

  return (
    <>
      <ScheduleHeader
        day={day}
        isToday={isToday}
        onPrev={() => setDay((d) => shiftDay(d, -1))}
        onNext={() => setDay((d) => shiftDay(d, 1))}
        onToday={() => setDay(today)}
        scheduledCount={railTasks.length}
        totalCount={dayTasks.length}
        scheduledMin={scheduledMin}
        capacity={capacity}
        hasWindows={windows.length > 0}
      />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {/* RTL: the sidebar is first in flow, so it sits on the right */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <ScheduleSidebar
            tasks={dayTasks}
            routines={sidebarRoutines}
            projectById={projectById}
            unscheduledCount={unscheduledCount}
            onToggleTask={toggleTask}
            onToggleRoutine={(id) => toggleRoutine(id, day)}
            onToggleImportant={toggleImportant}
          />

          <div className="min-w-0 flex-1">
            <Timeline
              contentRef={contentRef}
              tasks={railTasks}
              routines={railRoutines}
              blocks={blocks}
              windows={windows}
              projectById={projectById}
              isToday={isToday}
              nowMin={nowMin}
              onToggleTask={toggleTask}
              onToggleRoutine={(id) => toggleRoutine(id, day)}
              onUnscheduleTask={(id) => scheduleTask(id, null)}
              onUnscheduleRoutine={(id) => scheduleRoutine(id, day, null)}
              onResizeTask={(id, end) => {
                const task = tasks.find((t) => t.id === id);
                if (task?.scheduledStartMin != null) scheduleTask(id, task.scheduledStartMin, end);
              }}
              onResizeRoutine={(id, end) => {
                // resizing writes an override for this date; the template stays
                const routine = routines.find((r) => r.id === id);
                const time = routine && routineTimeFor(routine, routineLogFor(routineLogs, id, day));
                if (time) scheduleRoutine(id, day, time.startMin, end);
              }}
              onResizeBlock={(id, end) => updateTimeBlock(id, { endMin: end })}
              onDeleteBlock={deleteTimeBlock}
            />

            <button
              type="button"
              onClick={() => {
                const start = windows[0]?.startMin ?? 12 * 60;
                addTimeBlock(day, copy.schedule.blocks, start, start + DEFAULT_BLOCK_MIN);
              }}
              className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] text-text-3 transition-colors hover:bg-surface hover:text-text-2"
            >
              <Plus size={13} strokeWidth={2} />
              {copy.schedule.addBlock}
            </button>
          </div>
        </div>
      </DndContext>

      <UndoToast />
    </>
  );
}
