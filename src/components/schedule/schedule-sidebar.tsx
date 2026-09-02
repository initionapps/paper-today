"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, GripVertical, Repeat } from "lucide-react";

import { ImportantHeart } from "@/components/task/important-heart";
import { ProjectDot } from "@/components/projects/project-color";
import { Checkbox } from "@/components/ui/checkbox";
import { formatClock } from "@/lib/schedule";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { TASK_SIZES, type Project, type Routine, type Task, type TaskSize } from "@/lib/types";

export interface SidebarRoutine {
  routine: Routine;
  /** Resolved for this date: override, else the template's fixed time. */
  startMin: number | null;
  endMin: number | null;
  /** True when this date overrides the template. */
  fromOverride: boolean;
  done: boolean;
}

/**
 * Everything still *to do* for the day, listed after it has been scheduled —
 * the list is what's *planned*, the rail is what's *placed*. A scheduled item
 * dims and picks up its time; an unscheduled one keeps full contrast so the
 * gap between planned and placed is obvious at a glance.
 *
 * Completed work leaves this list the moment it is ticked and collects in the
 * drawer at the foot, so a busy day stays as short as the work that is left.
 * That split is presentational only: it reads `status` / `done` and changes
 * nothing. The rail deliberately keeps its completed blocks — the sidebar
 * answers "what's left", the rail answers "what happened".
 */
export function ScheduleSidebar({
  tasks,
  routines,
  projectById,
  unscheduledCount,
  onToggleTask,
  onToggleRoutine,
  onToggleImportant,
}: {
  tasks: Task[];
  routines: SidebarRoutine[];
  projectById: Map<string, Project>;
  unscheduledCount: number;
  /** Only wired to the completed drawer, where the one useful action is undo. */
  onToggleTask: (id: string) => void;
  onToggleRoutine: (id: string) => void;
  /** Tasks only — a routine has no important marker. */
  onToggleImportant: (id: string) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const activeRoutines = routines.filter((r) => !r.done);
  const doneRoutines = routines.filter((r) => r.done);

  const doneCount = doneTasks.length + doneRoutines.length;
  const nothingLeft = activeTasks.length === 0 && activeRoutines.length === 0;

  const bySize = (size: TaskSize) => activeTasks.filter((t) => t.size === size);

  return (
    <aside className="shrink-0 sm:w-[268px]">
      <div className="shadow-flat rounded-2xl border border-line-soft bg-surface p-4">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-[12px] font-semibold tracking-[0.05em] text-text-2">
            {copy.schedule.sidebarTitle}
          </h2>
          <span className={cn("text-[11.5px]", unscheduledCount > 0 ? "text-blue" : "text-text-3")}>
            {copy.schedule.unscheduledCount(unscheduledCount)}
          </span>
        </header>

        {/* an empty list because the day is finished is not an empty day */}
        {nothingLeft && (
          <p className="mt-4 text-[13px] text-text-3">
            {doneCount > 0 ? copy.schedule.allDone : copy.schedule.noTasks}
          </p>
        )}

        {TASK_SIZES.map((size) => {
          const list = bySize(size);
          if (list.length === 0) return null;
          return (
            <section key={size} className="mt-4">
              <h3 className="text-[10.5px] font-semibold tracking-[0.05em] text-text-3">
                {copy.sizes[size]}
              </h3>
              <div className="mt-1.5 flex flex-col gap-1">
                {list.map((task) => (
                  <DraggableItem
                    key={task.id}
                    id={`task:${task.id}`}
                    data={{ kind: "task", id: task.id }}
                    title={task.title}
                    startMin={task.scheduledStartMin}
                    endMin={task.scheduledEndMin}
                    done={task.status === "done"}
                    accent={
                      task.projectId ? projectById.get(task.projectId)?.color : undefined
                    }
                    important={task.isImportant}
                    onToggleImportant={() => onToggleImportant(task.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {activeRoutines.length > 0 && (
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-text-3">
              <Repeat size={10} strokeWidth={2} />
              {copy.schedule.routines}
            </h3>
            <div className="mt-1.5 flex flex-col gap-1">
              {activeRoutines.map(({ routine, startMin, endMin, done }) => (
                <DraggableItem
                  key={routine.id}
                  id={`routine:${routine.id}`}
                  data={{ kind: "routine", id: routine.id }}
                  title={routine.title}
                  startMin={startMin}
                  endMin={endMin}
                  done={done}
                  routine
                />
              ))}
            </div>
          </section>
        )}

        {/* Deliberately not a fourth section heading: a bare line, one step
            quieter than the size headings, so finished work stays reachable
            without competing with what is still open. */}
        {doneCount > 0 && (
          <section className="mt-5 border-t border-line-soft pt-3">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              aria-expanded={showCompleted}
              className="flex w-full cursor-pointer items-center gap-1.5 text-[11.5px] text-text-3 transition-colors hover:text-text-2"
            >
              {/* vertical flip, so it reads the same in RTL as in LTR */}
              <ChevronDown
                size={12}
                strokeWidth={2}
                className={cn("shrink-0 transition-transform duration-200", showCompleted && "rotate-180")}
              />
              {copy.schedule.completedToday(doneCount)}
            </button>

            {showCompleted && (
              <div className="mt-2 flex flex-col gap-1">
                {doneTasks.map((task) => (
                  <DraggableItem
                    key={task.id}
                    id={`task:${task.id}`}
                    data={{ kind: "task", id: task.id }}
                    title={task.title}
                    startMin={task.scheduledStartMin}
                    endMin={task.scheduledEndMin}
                    done
                    accent={task.projectId ? projectById.get(task.projectId)?.color : undefined}
                    important={task.isImportant}
                    onToggleImportant={() => onToggleImportant(task.id)}
                    onToggle={() => onToggleTask(task.id)}
                    toggleLabel={copy.a11y.toggleTask(task.title, true)}
                  />
                ))}
                {doneRoutines.map(({ routine, startMin, endMin }) => (
                  <DraggableItem
                    key={routine.id}
                    id={`routine:${routine.id}`}
                    data={{ kind: "routine", id: routine.id }}
                    title={routine.title}
                    startMin={startMin}
                    endMin={endMin}
                    done
                    routine
                    onToggle={() => onToggleRoutine(routine.id)}
                    toggleLabel={copy.a11y.toggleRoutine(routine.title, true)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

function DraggableItem({
  id,
  data,
  title,
  startMin,
  endMin,
  done,
  accent,
  routine,
  onToggle,
  toggleLabel,
  important,
  onToggleImportant,
}: {
  id: string;
  data: Record<string, unknown>;
  title: string;
  startMin: number | null;
  endMin: number | null;
  done: boolean;
  accent?: Project["color"];
  routine?: boolean;
  /** Present only in the completed drawer: ticking it off puts the item back. */
  onToggle?: () => void;
  toggleLabel?: string;
  /** Tasks only — routines have no important marker. */
  important?: boolean;
  onToggleImportant?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const scheduled = startMin !== null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={copy.a11y.dragTask(title)}
      className={cn(
        "group flex cursor-grab touch-none items-start gap-2 rounded-lg border px-2.5 py-2 transition-all active:cursor-grabbing",
        scheduled
          ? "border-line-soft bg-canvas/50 opacity-65"
          : "border-line bg-surface hover:border-blue/30",
        done && "opacity-45",
        isDragging && "opacity-30",
      )}
    >
      {onToggle && toggleLabel ? (
        // the tick must not start a drag — same guard the rail's blocks use
        <span onPointerDown={(e) => e.stopPropagation()} className="mt-px shrink-0">
          <Checkbox
            size="sm"
            shape={routine ? "circle" : "square"}
            tone={routine ? "teal" : "green"}
            checked={done}
            onChange={onToggle}
            label={toggleLabel}
          />
        </span>
      ) : (
        <GripVertical
          size={13}
          strokeWidth={1.8}
          className="mt-0.5 shrink-0 text-text-3/60 transition-colors group-hover:text-text-3"
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[13px] leading-snug",
            done ? "text-text-3 line-through decoration-text-3/50 decoration-1" : "text-text",
          )}
        >
          {title}
        </p>
        {scheduled ? (
          <span
            className={cn(
              "ltr-run mt-0.5 block text-[11px] tabular-nums",
              routine ? "text-teal" : "text-blue",
            )}
          >
            {formatClock(startMin)}
            {endMin !== null && `–${formatClock(endMin)}`}
          </span>
        ) : (
          <span className="mt-0.5 block text-[10.5px] text-text-3">{copy.schedule.unscheduled}</span>
        )}
      </div>

      {accent && <ProjectDot color={accent} className="mt-1.5" />}
      {routine && <Repeat size={11} strokeWidth={2} className="mt-1 shrink-0 text-teal/70" />}
      {onToggleImportant && (
        <ImportantHeart
          important={!!important}
          done={done}
          title={title}
          onToggle={onToggleImportant}
          className="mt-px"
        />
      )}
    </div>
  );
}
