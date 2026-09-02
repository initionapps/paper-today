"use client";

import { useRef, useState } from "react";
import { Archive, MoreHorizontal, Trash2 } from "lucide-react";

import { Popover, PopoverItem, PopoverLabel } from "@/components/ui/popover";
import { useDayStore } from "@/lib/store/day-store";
import { todayKey, tomorrowOf } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { TASK_SIZES, type DayKey, type Task } from "@/lib/types";

/**
 * Everything you can change about a task except its title, which is edited in
 * place. A popover rather than a dialog: the page stays visible behind it, and
 * the same component serves Today and All Tasks so the two can't drift.
 */
export function TaskMenu({ task, className }: { task: Task; className?: string }) {
  const [open, setOpen] = useState(false);
  // shared by both DateInputs: either one's native picker can be mid-use
  const dateFieldEngagedRef = useRef(false);

  const projects = useDayStore((s) => s.projects);
  const setTaskSize = useDayStore((s) => s.setTaskSize);
  const setTaskProject = useDayStore((s) => s.setTaskProject);
  const setPlannedDate = useDayStore((s) => s.setPlannedDate);
  const setDueDate = useDayStore((s) => s.setDueDate);
  const archiveTask = useDayStore((s) => s.archiveTask);
  const deleteTask = useDayStore((s) => s.deleteTask);

  const today = todayKey();
  const tomorrow = tomorrowOf(today);

  const act = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={copy.a11y.taskActions(task.title)}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-3 transition-all duration-200",
          "hover:bg-canvas hover:text-text-2",
          // stays out of the way until you look for it — except on touch,
          // where there is no hover and this is the only route to the menu
          open
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 no-hover:opacity-100",
        )}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        suspendCloseRef={dateFieldEngagedRef}
        className="w-72"
      >
        <PopoverLabel>{copy.actions.size}</PopoverLabel>
        <div className="flex gap-1 px-1.5 pb-1">
          {TASK_SIZES.map((size) => (
            <Chip
              key={size}
              active={task.size === size}
              onClick={() => setTaskSize(task.id, size)}
              className="flex-1"
            >
              {copy.sizes[size]}
            </Chip>
          ))}
        </div>

        <PopoverLabel>{copy.actions.plannedDate}</PopoverLabel>
        <div className="flex flex-wrap gap-1 px-1.5 pb-1">
          <Chip active={task.plannedDate === today} onClick={() => setPlannedDate(task.id, today)}>
            {copy.actions.moveToToday}
          </Chip>
          <Chip active={task.plannedDate === tomorrow} onClick={() => setPlannedDate(task.id, tomorrow)}>
            {copy.actions.moveToTomorrow}
          </Chip>
          <Chip active={task.plannedDate === null} onClick={() => setPlannedDate(task.id, null)}>
            {copy.actions.clearPlannedDate}
          </Chip>
        </div>
        <div className="px-1.5 pb-2">
          <DateInput
            value={task.plannedDate}
            ariaLabel={copy.a11y.plannedDateInput}
            onChange={(day) => setPlannedDate(task.id, day)}
            engagedRef={dateFieldEngagedRef}
          />
        </div>

        <PopoverLabel>{copy.actions.dueDate}</PopoverLabel>
        <div className="flex items-center gap-1 px-1.5 pb-2">
          <DateInput
            value={task.dueDate}
            ariaLabel={copy.a11y.dueDateInput}
            onChange={(day) => setDueDate(task.id, day)}
            engagedRef={dateFieldEngagedRef}
            className="flex-1"
          />
          {task.dueDate && (
            <Chip onClick={() => setDueDate(task.id, null)}>{copy.actions.clearDueDate}</Chip>
          )}
        </div>

        {projects.length > 0 && (
          <>
            <PopoverLabel>{copy.actions.project}</PopoverLabel>
            <div className="flex flex-wrap gap-1 px-1.5 pb-2">
              <Chip active={task.projectId === null} onClick={() => setTaskProject(task.id, null)}>
                {copy.actions.noProject}
              </Chip>
              {projects.map((project) => (
                <Chip
                  key={project.id}
                  active={task.projectId === project.id}
                  onClick={() => setTaskProject(task.id, project.id)}
                >
                  {project.name}
                </Chip>
              ))}
            </div>
          </>
        )}

        <div className="my-1 h-px bg-line-soft" />

        <PopoverItem onClick={act(() => archiveTask(task.id))}>
          <Archive size={15} strokeWidth={1.7} />
          {copy.actions.archive}
        </PopoverItem>
        <PopoverItem tone="danger" onClick={act(() => deleteTask(task.id))}>
          <Trash2 size={15} strokeWidth={1.7} />
          {copy.actions.delete}
        </PopoverItem>
      </Popover>
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors",
        active
          ? "border-blue/35 bg-blue-soft text-blue"
          : "border-line text-text-3 hover:bg-canvas hover:text-text-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A complete calendar day. Anything else is mid-edit, not an intention. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The native picker. A DayKey is already 'YYYY-MM-DD', which is exactly what
 * `input[type=date]` reads and writes — no parsing, no timezone in the middle.
 *
 * **Commits only on blur or Enter — never on `input`, however "complete" the
 * value looks.** Two things went wrong here before this settled, and a third
 * attempt (committing after a short quiet pause with no further change, like
 * autosave) went wrong worse than either:
 *
 * 1. The field reports `""` for every intermediate state, and committing on
 *    every change once turned that into `setPlannedDate(id, null)` — dropping
 *    the task into the backlog *and* voiding its schedule block.
 * 2. Requiring a *complete* value before writing wasn't enough either: the
 *    up/down spinner on a focused segment (day/month/year) reports a
 *    complete, valid, *different* date on every single tick — moving the
 *    month by one is itself a whole valid day. Since Today shows only
 *    `plannedDate === today`, one tick moved the task off the page and
 *    unmounted the card the open menu was on, before a day was ever chosen.
 * 3. A quiet-pause timer, tried to also catch a calendar pick that never
 *    blurs the field (see below), reopened (2): a real person clicking the
 *    spinner pauses to look at what happened before clicking again, often
 *    for longer than any reasonable timeout, and each tick is independently a
 *    complete, valid, different date. The task moved a section forward on its
 *    own, silently, mid-browse — worse than (2), because now it looked like
 *    the *app* was choosing dates, not a bug in reading input.
 *
 * So: blur and Enter are the only commit signals now, full stop — same rule
 * `EditableText` already uses everywhere else. The cost is real and accepted:
 * if the browser's own calendar dropdown closes on a day click without ever
 * blurring the `<input>` (focus can stay put), that pick sits as a draft
 * until the field is actually left — tabbing to the next field, or clicking
 * elsewhere. No value is ever written without an explicit "I'm done" signal
 * from the user; that outweighs the inconvenience of an extra click.
 *
 * The calendar dropdown itself is a separate problem this doesn't touch: it
 * isn't part of this page's DOM, so a click inside it can report a target the
 * surrounding `Popover` doesn't recognise as "inside", closing the whole menu
 * before a day is ever clicked. `engagedRef` (shared with the sibling date
 * field, since either's picker can be open) tells that `Popover` to ignore
 * outside clicks for as long as this field holds focus — set on focus,
 * cleared on blur, checked nowhere else.
 */
function DateInput({
  value,
  onChange,
  ariaLabel,
  engagedRef,
  className,
}: {
  value: DayKey | null;
  /** Never called with a partial value, and never called with `null`. */
  onChange: (day: DayKey) => void;
  ariaLabel: string;
  /** Tells the enclosing `Popover` not to treat the picker as a click outside. */
  engagedRef?: React.RefObject<boolean>;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);

  // The date also changes from outside this field — "move to tomorrow", undo,
  // the clear chips — and the input has to follow. Adjusted during render
  // rather than in an effect: an effect would render the stale value first,
  // and React flags the pattern.
  if (value !== seen) {
    setSeen(value);
    setDraft(value ?? "");
  }

  const commit = () => {
    if (ISO_DAY.test(draft) && draft !== value) onChange(draft);
    // abandoned or still-incomplete: reverts rather than committing a guess
    else setDraft(value ?? "");
  };

  return (
    <input
      type="date"
      dir="ltr"
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        if (engagedRef) engagedRef.current = true;
      }}
      onBlur={() => {
        if (engagedRef) engagedRef.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        // native date inputs don't submit on Enter on their own; make it act
        // like every other field in the app that commits on Enter
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn(
        "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] text-text-2",
        "outline-none transition-colors focus:border-blue/45 focus:ring-2 focus:ring-blue/20",
        className,
      )}
    />
  );
}
