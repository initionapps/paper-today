"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { EditableText } from "@/components/task/editable-text";
import { ImportantHeart } from "@/components/task/important-heart";
import { DueBadge, PROJECT_EDGE, ProjectTag, ScheduledChip } from "@/components/task/task-meta";
import { TaskMenu } from "@/components/task/task-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey, Project, Task } from "@/lib/types";

import { DragHandle } from "./drag-handle";

/**
 * The loudest thing on the page — carried by type size, padding and a blue-lit
 * shadow, never by a dark fill. It should feel important, not heavy.
 */
export function BigTask({ task, project, today }: { task: Task; project?: Project; today: DayKey }) {
  const toggleTask = useDayStore((s) => s.toggleTask);
  const renameTask = useDayStore((s) => s.renameTask);
  const setTaskDetail = useDayStore((s) => s.setTaskDetail);
  const toggleImportant = useDayStore((s) => s.toggleImportant);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", size: task.size },
  });

  const done = task.status === "done";
  const hasMeta = project || task.scheduledStartMin !== null || task.dueDate;

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative", isDragging && "opacity-30")}
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        label={copy.a11y.reorder(task.title)}
        className="absolute -start-7 top-8 h-6 w-5"
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-surface transition-all duration-300",
          "p-6 sm:p-7",
          done
            ? "shadow-flat border-line-soft opacity-60"
            : "shadow-feature border-line-soft hover:border-blue/30",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 start-0 w-[3px] transition-opacity duration-300",
            project ? PROJECT_EDGE[project.color] : "bg-blue",
            done && "opacity-30",
          )}
        />

        <div className="flex items-start gap-4">
          <Checkbox
            size="lg"
            checked={done}
            onChange={() => toggleTask(task.id)}
            label={copy.a11y.toggleTask(task.title, done)}
            className="mt-1"
          />

          <div className="min-w-0 flex-1">
            <EditableText
              value={task.title}
              onCommit={(next) => renameTask(task.id, next)}
              ariaLabel={copy.a11y.taskTitle}
              className={cn(
                "font-display text-[1.75rem] font-semibold leading-[1.35] tracking-[-0.015em] transition-colors duration-300",
                done ? "text-text-2 line-through decoration-text-3/60 decoration-1" : "text-text",
              )}
            />

            <div
              className={cn(
                "mt-2 transition-opacity duration-200",
                !task.detail &&
                  "opacity-0 focus-within:opacity-100 group-hover:opacity-100 no-hover:opacity-100",
              )}
            >
              <EditableText
                value={task.detail ?? ""}
                onCommit={(next) => setTaskDetail(task.id, next)}
                ariaLabel={copy.a11y.taskDetail}
                placeholder={copy.compose.detail}
                className="text-[14px] leading-relaxed text-text-2"
              />
            </div>

            {hasMeta && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <ScheduledChip startMin={task.scheduledStartMin} endMin={task.scheduledEndMin} />
                <DueBadge dueDate={task.dueDate} today={today} />
                <ProjectTag project={project} />
              </div>
            )}
          </div>

          <ImportantHeart
            important={task.isImportant}
            done={done}
            title={task.title}
            onToggle={() => toggleImportant(task.id)}
            size="big"
            // a little air on both sides: deliberately placed, not squeezed in
            // beside the menu. Logical margins, so RTL needs no special case.
            className="mt-0.5 ms-1 me-1"
          />
          <TaskMenu task={task} className="mt-0.5" />
        </div>
      </div>
    </article>
  );
}
