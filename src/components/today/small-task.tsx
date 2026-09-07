"use client";

import { memo } from "react";

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

/**
 * The lightest card in the ladder — but a card.
 *
 * This used to be a bare checklist line: no fill, no border, sitting straight
 * on the canvas. That made it recessive, which was the intent, and also made it
 * *washed out* — with nothing to sit on, a 14px line at 60% opacity when done
 * reads as page furniture rather than as work. Being lower in the hierarchy and
 * being hard to see are not the same thing.
 *
 * So it gains the least card it can have: a white fill against the cool canvas,
 * the softer of the two hairlines, and no elevation at all. Everything that
 * makes Medium heavier is deliberately withheld — Medium gets the stronger
 * border, the larger radius, more padding, 16px medium type and a whisper of
 * shadow; this gets none of those. The step down is carried by five small
 * differences at once rather than by absence.
 */
function SmallTaskImpl({
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-lg border bg-surface px-3 py-2",
        // Not `transition-all`: the properties are named so that a viewport
        // change can't animate the padding, and so dnd-kit's inline transition
        // during a sort stays the only thing moving the card.
        "transition-[opacity,border-color] duration-300",
        done ? "border-line-soft opacity-60" : "border-line-soft hover:border-line",
        isDragging && "opacity-30",
      )}
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        label={copy.a11y.reorder(task.title)}
        className="absolute -start-[22px] top-2 h-5 w-4"
      />

      <Checkbox
        size="sm"
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
            "text-[14px] leading-[1.5] transition-colors duration-300",
            done ? "text-text-2 line-through decoration-text-3/60 decoration-1" : "text-text",
          )}
        />
        {(task.scheduledStartMin !== null || task.dueDate) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ScheduledChip startMin={task.scheduledStartMin} endMin={task.scheduledEndMin} />
            <DueBadge dueDate={task.dueDate} today={today} />
          </div>
        )}
      </div>

      <ProjectTag project={project} dotOnly className="mt-2" />
      <ImportantHeart
        important={task.isImportant}
        done={done}
        title={task.title}
        onToggle={() => toggleImportant(task.id)}
        size="small"
        className="mt-px"
      />
      <TaskMenu task={task} className="-mt-0.5" />
    </div>
  );
}

/**
 * See BigTask.
 *
 * Safe because every prop is stable by construction: `task` keeps its object
 * identity unless that row actually changed, `project` comes from a memoised
 * map, and the rest are primitives. The store actions these components read are
 * stable references, so they never cause a render on their own.
 */
export const SmallTask = memo(SmallTaskImpl);
