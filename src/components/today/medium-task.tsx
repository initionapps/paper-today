"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { EditableText } from "@/components/task/editable-text";
import { ImportantHeart } from "@/components/task/important-heart";
import { DueBadge, ProjectTag, ScheduledChip } from "@/components/task/task-meta";
import { TaskMenu } from "@/components/task/task-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey, Project, Task } from "@/lib/types";

import { DragHandle } from "./drag-handle";

/** Two to a row, a hairline border, almost no elevation. Never competes with Big. */
export function MediumTask({
  task,
  project,
  today,
}: {
  task: Task;
  project?: Project;
  today: DayKey;
}) {
  const toggleTask = useDayStore((s) => s.toggleTask);
  const renameTask = useDayStore((s) => s.renameTask);
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
        className="absolute -start-[22px] top-3.5 h-5 w-4"
      />

      <div
        className={cn(
          "shadow-flat rounded-xl border bg-surface px-4 py-3.5 transition-all duration-300",
          done ? "border-line-soft opacity-60" : "border-line hover:border-blue/25",
        )}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            size="md"
            checked={done}
            onChange={() => toggleTask(task.id)}
            label={copy.a11y.toggleTask(task.title, done)}
            className="mt-px"
          />

          <div className="min-w-0 flex-1">
            <EditableText
              value={task.title}
              onCommit={(next) => renameTask(task.id, next)}
              ariaLabel={copy.a11y.taskTitle}
              className={cn(
                "text-[16px] font-medium leading-[1.45] transition-colors duration-300",
                done ? "text-text-2 line-through decoration-text-3/60 decoration-1" : "text-text",
              )}
            />

            {hasMeta && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
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
            size="medium"
            className="-mt-0.5"
          />
          <TaskMenu task={task} className="-mt-0.5" />
        </div>
      </div>
    </article>
  );
}
