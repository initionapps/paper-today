"use client";

import { EditableText } from "@/components/task/editable-text";
import { ImportantHeart } from "@/components/task/important-heart";
import { DueBadge, ProjectTag, ScheduledChip } from "@/components/task/task-meta";
import { TaskMenu } from "@/components/task/task-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useDayStore } from "@/lib/store/day-store";
import { shortDate } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey, Project, Task, TaskSize } from "@/lib/types";

/** Size still reads at a glance — as a stroke length and a type weight. */
const BAR: Record<TaskSize, string> = {
  big: "h-5",
  medium: "h-3.5",
  small: "h-2",
};

const TITLE: Record<TaskSize, string> = {
  big: "text-[16.5px] font-semibold",
  medium: "text-[15px] font-medium",
  small: "text-[14px]",
};

/**
 * One line in All Tasks. Not a table row: no columns, no grid, and the same
 * inline-rename and menu as the Today page so nothing has to be learned twice.
 */
export function TaskRow({
  task,
  project,
  today,
  showDate,
}: {
  task: Task;
  project?: Project;
  today: DayKey;
  /** Upcoming and overdue need the actual day; today/tomorrow don't. */
  showDate?: boolean;
}) {
  const toggleTask = useDayStore((s) => s.toggleTask);
  const renameTask = useDayStore((s) => s.renameTask);
  const toggleImportant = useDayStore((s) => s.toggleImportant);

  const hasMeta =
    project || task.scheduledStartMin !== null || task.dueDate || (showDate && task.plannedDate);

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-canvas/60">
      <span
        aria-hidden
        className={cn("mt-1.5 w-[3px] shrink-0 rounded-full bg-line", BAR[task.size])}
      />

      <Checkbox
        size={task.size === "big" ? "md" : "sm"}
        checked={false}
        onChange={() => toggleTask(task.id)}
        label={copy.a11y.toggleTask(task.title, false)}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <EditableText
          value={task.title}
          onCommit={(next) => renameTask(task.id, next)}
          ariaLabel={copy.a11y.taskTitle}
          className={cn("leading-[1.45] text-text", TITLE[task.size])}
        />

        {hasMeta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {showDate && task.plannedDate && (
              <span className="text-[11.5px] text-text-2">{shortDate(task.plannedDate)}</span>
            )}
            <ScheduledChip startMin={task.scheduledStartMin} endMin={task.scheduledEndMin} />
            <DueBadge dueDate={task.dueDate} today={today} />
            <ProjectTag project={project} />
          </div>
        )}
      </div>

      <ImportantHeart
        important={task.isImportant}
        done={task.status === "done"}
        title={task.title}
        onToggle={() => toggleImportant(task.id)}
        className="mt-0.5"
      />
      <TaskMenu task={task} className="-mt-0.5" />
    </div>
  );
}
