"use client";

import { useState, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";

import { Popover, PopoverItem } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useDayStore } from "@/lib/store/day-store";
import { formatClock } from "@/lib/schedule";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey, Routine } from "@/lib/types";

import { DragHandle } from "./drag-handle";
import { RoutineEditor } from "./routine-editor";

/**
 * A routine is not a task — no size, never in All Tasks, and ticking it writes
 * a per-day fact rather than completing anything. The round checkbox and the
 * repeat glyph say so before any label does.
 */
function RoutineLineImpl({
  routine,
  day,
  done,
  time,
}: {
  routine: Routine;
  day: DayKey;
  done: boolean;
  /** Resolved for this date: override, else template, else none. */
  time: { startMin: number; endMin: number; fromOverride: boolean } | null;
}) {
  const toggleRoutine = useDayStore((s) => s.toggleRoutine);
  const updateRoutine = useDayStore((s) => s.updateRoutine);
  const archiveRoutine = useDayStore((s) => s.archiveRoutine);
  const restoreRoutine = useDayStore((s) => s.restoreRoutine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: routine.id,
    data: { type: "routine" },
  });

  const archived = routine.archivedAt !== null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative flex items-center gap-2.5 py-1.5 transition-opacity duration-300",
        (done || archived) && "opacity-60",
        isDragging && "opacity-30",
      )}
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        label={copy.a11y.reorder(routine.title)}
        className="absolute -start-[22px] top-1.5 h-5 w-4"
      />

      <Checkbox
        size="sm"
        shape="circle"
        tone="teal"
        checked={done}
        onChange={() => toggleRoutine(routine.id, day)}
        label={copy.a11y.toggleRoutine(routine.title, done)}
      />

      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-[14px] transition-colors duration-300",
          done ? "text-text-3 line-through decoration-text-3/50 decoration-1" : "text-text-2",
        )}
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-teal/70" aria-hidden>
          <path
            d="M2 6a4 4 0 0 1 6.9-2.7M10 6a4 4 0 0 1-6.9 2.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M9 1.6v2h-2M3 10.4v-2h2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span className="truncate">{routine.title}</span>

        {/* only when it actually has a time — no metadata otherwise */}
        {time && (
          <span
            className="ltr-run shrink-0 text-[11px] tabular-nums text-teal"
            title={time.fromOverride ? copy.routines.overrideToday : undefined}
          >
            {formatClock(time.startMin)}–{formatClock(time.endMin)}
          </span>
        )}
      </span>

      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={copy.a11y.routineActions(routine.title)}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-text-3 transition-all duration-200",
            "hover:bg-canvas hover:text-text-2",
            menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 no-hover:opacity-100",
          )}
        >
          <MoreHorizontal size={15} strokeWidth={1.8} />
        </button>

        <Popover open={menuOpen} onClose={() => setMenuOpen(false)}>
          <PopoverItem
            onClick={() => {
              setMenuOpen(false);
              setEditing(true);
            }}
          >
            <Pencil size={15} strokeWidth={1.7} />
            {copy.routines.editTitle}
          </PopoverItem>
          {archived ? (
            <PopoverItem
              onClick={() => {
                restoreRoutine(routine.id);
                setMenuOpen(false);
              }}
            >
              <RotateCcw size={15} strokeWidth={1.7} />
              {copy.routines.restore}
            </PopoverItem>
          ) : (
            <PopoverItem
              onClick={() => {
                archiveRoutine(routine.id);
                setMenuOpen(false);
              }}
            >
              <Archive size={15} strokeWidth={1.7} />
              {copy.routines.archive}
            </PopoverItem>
          )}
        </Popover>

        <RoutineEditor
          open={editing}
          routine={routine}
          onClose={() => setEditing(false)}
          onSave={(draft) => updateRoutine(routine.id, draft)}
          align="end"
        />
      </div>
    </div>
  );
}

/**
 * A routine does not change when a task does, but it re-rendered anyway.
 *
 * Safe because every prop is stable by construction: `task` keeps its object
 * identity unless that row actually changed, `project` comes from a memoised
 * map, and the rest are primitives. The store actions these components read are
 * stable references, so they never cause a render on their own.
 */
export const RoutineLine = memo(RoutineLineImpl);
