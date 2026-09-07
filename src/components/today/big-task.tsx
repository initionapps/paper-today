"use client";

import { memo } from "react";

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
 * The most important thing on the page — and, deliberately, not the loudest.
 *
 * It used to earn that by sheer size: 28px type in 28px of padding under a
 * blue-lit shadow. That made it dominant rather than important, and next to a
 * row of Medium cards it read as a different *kind* of object instead of a
 * bigger one. So the volume came down and the difference moved into three
 * quieter signals that add up:
 *
 *   type     still 1.5× Medium, and in the display face at semibold — enough
 *            on its own, without the extra 4px that pushed Hebrew titles onto
 *            another line;
 *   space    ~20% less padding, which is still roughly 1.6× Medium's;
 *   gold     a hairline frame and a cream tint (see `--color-gold-*`).
 *
 * The gold says *size*. The accent strip down the start edge says *project*,
 * exactly as before — the two never share a channel, which is why the strip
 * keeps its own colour on a gold card.
 */
function BigTaskImpl({ task, project, today }: { task: Task; project?: Project; today: DayKey }) {
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
        // follows the title down: less padding above it means the handle has
        // to come up with it, or it lines up with the second line instead
        className="absolute -start-7 top-5 h-6 w-5"
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border transition-all duration-300",
          // 28px → 18px on desktop, 16px → 12px on mobile. Still visibly more
          // room than Medium's 14/16px, without the card reading as tall next
          // to it.
          "p-3 sm:p-[1.125rem]",
          // The one warm surface in the app. `bg-gold-soft` rather than
          // `bg-surface`: white next to white needs the border to do all the
          // work, and a border subtle enough to stay calm can't.
          "bg-gold-soft",
          done
            ? // A finished Big task is still a Big task, so it keeps the frame —
              // opacity-60 already pulls it back further than muting the gold would.
              "shadow-flat border-gold-line/60 opacity-60"
            : "shadow-feature border-gold-line hover:border-gold/55",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 start-0 w-[3px] transition-opacity duration-300",
            project ? PROJECT_EDGE[project.color] : "bg-blue",
            done && "opacity-30",
          )}
        />

        <div className="flex items-start gap-3">
          <Checkbox
            size="lg"
            checked={done}
            onChange={() => toggleTask(task.id)}
            label={copy.a11y.toggleTask(task.title, done)}
            className="mt-0.5"
          />

          <div className="min-w-0 flex-1">
            <EditableText
              value={task.title}
              onCommit={(next) => renameTask(task.id, next)}
              ariaLabel={copy.a11y.taskTitle}
              className={cn(
                // 22.4px against Medium's 16px — 1.4×, in the display face at
                // semibold where Medium is the body face at medium. Big enough
                // to read as a different tier at a glance without being the
                // loudest thing on the page.
                //
                // Mobile: 19.2px over a ~300px column — 1.2× Medium's 16px, the
                // floor before the two tiers start reading the same size. No
                // `truncate` here on purpose — a title is the task, so it wraps
                // for as long as it needs to.
                "font-display text-[1.2rem] leading-[1.3] sm:text-[1.4rem] sm:leading-[1.35]",
                "font-semibold tracking-[-0.015em] transition-colors duration-300",
                done ? "text-text-2 line-through decoration-text-3/60 decoration-1" : "text-text",
              )}
            />

            <div
              className={cn(
                "mt-1 transition-opacity duration-200",
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
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
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

/**
 * Today re-renders whenever any task in the store changes; without this, every card on the page re-rendered with it.
 *
 * Safe because every prop is stable by construction: `task` keeps its object
 * identity unless that row actually changed, `project` comes from a memoised
 * map, and the rest are primitives. The store actions these components read are
 * stable references, so they never cause a render on their own.
 */
export const BigTask = memo(BigTaskImpl);
