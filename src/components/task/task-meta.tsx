"use client";

import { PROJECT_DOT } from "@/lib/palette";
import { formatMinutes, isOverdue, shortDate } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey, PaletteColor, Project } from "@/lib/types";

// project colour lives with the project concept, not with task metadata
const DOT = PROJECT_DOT;

/** The accent strip down the inline-start edge of a card. */
export const PROJECT_EDGE: Record<PaletteColor, string> = PROJECT_DOT;

export function ProjectTag({
  project,
  dotOnly,
  className,
}: {
  project?: Project;
  /** Small tasks carry the colour but not the word — metadata, not content. */
  dotOnly?: boolean;
  className?: string;
}) {
  if (!project) return null;

  if (dotOnly) {
    return (
      <span
        title={project.name}
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[project.color], className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] text-text-3", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[project.color])} />
      {project.name}
    </span>
  );
}

/**
 * A scheduled block. The task itself has no duration — this is start and end,
 * and the length between them is only ever implied.
 */
export function ScheduledChip({
  startMin,
  endMin,
  className,
}: {
  startMin: number | null;
  endMin: number | null;
  className?: string;
}) {
  if (startMin === null) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] text-blue", className)}>
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden>
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 3.5V6l1.8 1.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="ltr-run tabular-nums">
        {formatMinutes(startMin)}
        {endMin !== null && <span className="text-text-3">–{formatMinutes(endMin)}</span>}
      </span>
    </span>
  );
}

/** The deadline. Turns rose once it has passed and the task is still open. */
export function DueBadge({
  dueDate,
  today,
  className,
}: {
  dueDate: DayKey | null;
  today: DayKey;
  className?: string;
}) {
  if (!dueDate) return null;
  const late = isOverdue(dueDate, today);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
        late ? "bg-rose/10 text-rose" : "bg-canvas text-text-3",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden>
        <path
          d="M6 1.6 1.6 10.4h8.8L6 1.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {copy.allTasks.due(shortDate(dueDate))}
    </span>
  );
}
