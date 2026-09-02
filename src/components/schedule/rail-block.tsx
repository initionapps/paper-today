"use client";

import { useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";

import {
  DAY_MIN,
  MIN_BLOCK_MIN,
  blockHeight,
  minToPx,
  pxToMin,
  snap,
} from "@/lib/schedule";
import { cn } from "@/lib/cn";

/**
 * The geometry shell every block on the rail shares: absolute placement from
 * minutes, lane-based width for overlaps, whole-block dragging, and a bottom
 * resize handle.
 *
 * Resizing is deliberately *not* dnd-kit: it only ever needs a vertical delta,
 * and keeping it on raw pointer events means it can preview live without
 * fighting the drag context that moves the block.
 */
export function RailBlock({
  id,
  data,
  startMin,
  endMin,
  lane,
  lanes,
  onResize,
  resizeLabel,
  className,
  children,
  z = 20,
}: {
  id: string;
  data: Record<string, unknown>;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
  /** Commit a new end minute. Start never moves while resizing. */
  onResize?: (endMin: number) => void;
  resizeLabel?: string;
  className?: string;
  children: (liveEndMin: number) => React.ReactNode;
  z?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data });
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const origin = useRef({ y: 0, end: 0 });

  const liveEnd = draftEnd ?? endMin;
  // less than the block's true span, so a block that ends where the next one
  // starts doesn't share an edge with it. Every kind on the rail — task,
  // routine and blocked time — renders through here, so the seam is uniform.
  const height = blockHeight(startMin, liveEnd);

  /** Capture is an optimisation, not a requirement — never let it break resize. */
  const capture = (e: React.PointerEvent, on: boolean) => {
    const el = e.target as HTMLElement;
    try {
      if (on) el.setPointerCapture(e.pointerId);
      else el.releasePointerCapture(e.pointerId);
    } catch {
      // no active pointer with that id; the move/up handlers still work
    }
  };

  const onHandleDown = (e: React.PointerEvent) => {
    if (!onResize) return;
    // keep the block's own drag from starting under the handle
    e.stopPropagation();
    e.preventDefault();
    capture(e, true);
    origin.current = { y: e.clientY, end: endMin };
    setDraftEnd(endMin);
  };

  const onHandleMove = (e: React.PointerEvent) => {
    if (draftEnd === null) return;
    const delta = pxToMin(e.clientY - origin.current.y);
    const next = snap(origin.current.end + delta);
    setDraftEnd(Math.min(DAY_MIN, Math.max(startMin + MIN_BLOCK_MIN, next)));
  };

  const onHandleUp = (e: React.PointerEvent) => {
    if (draftEnd === null) return;
    capture(e, false);
    if (draftEnd !== endMin) onResize?.(draftEnd);
    setDraftEnd(null);
  };

  const width = 100 / lanes;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        top: minToPx(startMin),
        height,
        insetInlineStart: `${lane * width}%`,
        width: `calc(${width}% - 4px)`,
        zIndex: isDragging ? 60 : z,
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
      }}
      className={cn(
        "group/block absolute cursor-grab touch-none overflow-hidden rounded-lg transition-shadow active:cursor-grabbing",
        isDragging && "shadow-drag opacity-90",
        className,
      )}
    >
      {children(liveEnd)}

      {onResize && (
        <div
          role="slider"
          tabIndex={-1}
          aria-label={resizeLabel}
          aria-valuenow={liveEnd}
          aria-valuemin={startMin + MIN_BLOCK_MIN}
          aria-valuemax={DAY_MIN}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          className={cn(
            "absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-end justify-center",
            "opacity-0 transition-opacity group-hover/block:opacity-100 no-hover:opacity-100",
            draftEnd !== null && "opacity-100",
          )}
        >
          <span className="mb-[3px] h-[3px] w-7 rounded-full bg-text/20" />
        </div>
      )}
    </div>
  );
}
