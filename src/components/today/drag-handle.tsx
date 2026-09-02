"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import type { useSortable } from "@dnd-kit/sortable";

import { cn } from "@/lib/cn";

// derived rather than deep-imported, so a dnd-kit internal path can't break us
type SortableListeners = ReturnType<typeof useSortable>["listeners"];

/**
 * Dragging lives on a handle rather than the whole card, so that clicking a
 * title to rewrite it never turns into a drag. It sits in the margin on the
 * inline-start side, which flips with the layout.
 */
export function DragHandle({
  attributes,
  listeners,
  label,
  className,
}: {
  attributes: DraggableAttributes;
  listeners: SortableListeners;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...attributes}
      {...listeners}
      className={cn(
        "flex cursor-grab touch-none items-center justify-center rounded-md text-text-3/70 opacity-0 transition-all duration-200",
        "hover:bg-line-soft hover:text-text-2 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing",
        // no hover to reveal it on touch, so it simply stays put
        "no-hover:opacity-100",
        className,
      )}
    >
      <svg viewBox="0 0 8 16" className="h-3.5 w-2" aria-hidden>
        {[3, 8, 13].map((y) => (
          <g key={y}>
            <circle cx="2" cy={y} r="1" fill="currentColor" />
            <circle cx="6" cy={y} r="1" fill="currentColor" />
          </g>
        ))}
      </svg>
    </button>
  );
}
