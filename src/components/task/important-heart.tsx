"use client";

import { Heart } from "lucide-react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { TaskSize } from "@/lib/types";

/**
 * The heart steps with the task's weight, the same way the title and the
 * accent bar do — a 13px mark beside a 28px Big title read as an afterthought.
 * The hit box grows with it so the target stays comfortable.
 *
 * Still secondary: even the Big heart is well under the title's size, and the
 * unimportant state is invisible until hover whatever the step.
 */
const HEART: Record<TaskSize, { box: string; icon: number }> = {
  big: { box: "h-7 w-7 rounded-lg", icon: 19 },
  medium: { box: "h-6 w-6 rounded-lg", icon: 16 },
  small: { box: "h-5 w-5 rounded-md", icon: 13 },
};

/**
 * The important marker, in one place so Today, All Tasks and the Schedule
 * sidebar cannot drift apart.
 *
 * Three states, and no fourth: this is on/off, not a priority scale.
 *
 *   important + open   filled rose      always visible — that is the point
 *   important + done   filled grey      still there, no longer shouting
 *   not important      hollow outline   hover/focus only on desktop
 *
 * The empty state follows the same hover-reveal rule as the drag handles and
 * the `⋯` menu (`no-hover:opacity-100` keeps it reachable on touch), so a day
 * full of ordinary tasks gains no new marks.
 */
export function ImportantHeart({
  important,
  done,
  title,
  onToggle,
  size = "small",
  className,
}: {
  important: boolean;
  done: boolean;
  title: string;
  onToggle: () => void;
  /**
   * Steps the mark with the task's weight. Defaults to the smallest, so the
   * denser surfaces (All Tasks, the Schedule sidebar) keep one calm size.
   */
  size?: TaskSize;
  className?: string;
}) {
  const step = HEART[size];

  return (
    <button
      type="button"
      aria-pressed={important}
      aria-label={copy.a11y.toggleImportant(title, important)}
      // inside a draggable row: press the heart, don't pick the task up
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "tap-target flex shrink-0 cursor-pointer items-center justify-center outline-none",
        step.box,
        "transition-[opacity,transform,color] duration-150 active:scale-90",
        "focus-visible:ring-2 focus-visible:ring-blue/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        important
          ? done
            ? "text-text-3 hover:text-text-2"
            : "text-rose hover:text-rose/80"
          : // hollow, quiet, and out of the way until asked for
            "text-text-3/70 opacity-0 hover:text-rose focus-visible:opacity-100 group-hover:opacity-100 no-hover:opacity-100",
        className,
      )}
    >
      {/* the filled and hollow hearts are the same glyph at the same size, so
          completing an important task changes only its colour */}
      <Heart
        size={step.icon}
        strokeWidth={important ? 0 : 1.8}
        className={important ? "fill-current" : undefined}
      />
    </button>
  );
}

/**
 * The same mark on the hour rail, where it is read-only: a block is a drag
 * surface that already carries a checkbox and a remove button, and a third
 * target on a 15-minute block would be a mis-tap waiting to happen. Nothing
 * is drawn unless the task is important — no empty hearts on the timeline.
 */
export function ImportantMark({ done, className }: { done: boolean; className?: string }) {
  return (
    <span
      title={copy.a11y.importantMark}
      aria-label={copy.a11y.importantMark}
      role="img"
      className={cn("shrink-0", done ? "text-text-3" : "text-rose", className)}
    >
      <Heart size={11} strokeWidth={0} className="fill-current" />
    </span>
  );
}
