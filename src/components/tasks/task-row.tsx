"use client";

import { memo, useState } from "react";
import { StickyNote } from "lucide-react";

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
 *
 * Notes are the one thing this row does *not* show the way Today does. A list
 * of a couple of hundred tasks with their notes printed under each would stop
 * being a list, so a Big or Medium row carries a small note button instead,
 * and the notes open under that one task when it is clicked. The button stays
 * visible on a task that has notes — a quiet "there's something here" —
 * and otherwise appears on hover like the menu beside it. Small tasks get no
 * button, matching Today, where Small has no notes field either.
 */
function TaskRowImpl({
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
  const setTaskDetail = useDayStore((s) => s.setTaskDetail);
  const toggleImportant = useDayStore((s) => s.toggleImportant);

  /** Local and per row: opening one task's notes says nothing about another's. */
  const [notesOpen, setNotesOpen] = useState(false);
  const hasNotesField = task.size !== "small";
  const hasNotes = Boolean(task.detail);

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

        {hasNotesField && notesOpen && (
          <div className="mt-2 border-s-2 border-line ps-3">
            {/* `autoEdit` only when there's nothing to read yet: opening an
                empty note is a request to write one, so it starts with the
                cursor in it. A note that exists opens to be read first. */}
            <EditableText
              value={task.detail ?? ""}
              onCommit={(next) => setTaskDetail(task.id, next)}
              ariaLabel={copy.a11y.taskNotes}
              placeholder={copy.compose.notes}
              multiline
              autoEdit={!hasNotes}
              className="text-[13.5px] leading-relaxed text-text-2"
            />
          </div>
        )}
      </div>

      {hasNotesField && (
        <button
          type="button"
          aria-expanded={notesOpen}
          aria-label={notesOpen ? copy.a11y.hideNotes(task.title) : copy.a11y.showNotes(task.title)}
          onClick={() => setNotesOpen((v) => !v)}
          className={cn(
            "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg -mt-0.5 transition-all duration-200",
            "hover:bg-canvas hover:text-text-2",
            notesOpen
              ? "text-blue opacity-100"
              : hasNotes
                ? "text-text-3 opacity-100"
                : "text-text-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 no-hover:opacity-100",
          )}
        >
          <StickyNote size={15} strokeWidth={1.7} />
        </button>
      )}

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

/**
 * One row of All Tasks — the longest list in the app. Unmemoised, a couple of hundred rows all re-rendered on every toggle, rename or filter change, because the view re-renders whenever the `tasks` array identity changes.
 *
 * Safe because every prop is stable by construction: `task` keeps its object
 * identity unless that row actually changed, `project` comes from a memoised
 * map, and the rest are primitives. The store actions these components read are
 * stable references, so they never cause a render on their own.
 */
export const TaskRow = memo(TaskRowImpl);
