"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { AlertTriangle, Repeat, X } from "lucide-react";

import { ImportantMark } from "@/components/task/important-heart";
import { ProjectDot } from "@/components/projects/project-color";
import {
  PROJECT_DOT,
  TASK_BAR_WIDTH,
  TASK_BLOCK_BORDER,
  TASK_BLOCK_TITLE,
  TASK_TINT,
} from "@/lib/palette";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DAY_MIN,
  GRID_MIN,
  formatClock,
  invert,
  layoutLanes,
  minToPx,
  nowMinutes,
  overlaps,
  type Interval,
} from "@/lib/schedule";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type {
  PaletteColor,
  Project,
  Routine,
  Task,
  TaskSize,
  TimeBlock,
  WorkWindow,
} from "@/lib/types";

import { RailBlock } from "./rail-block";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HALF_HOURS = Array.from({ length: DAY_MIN / GRID_MIN + 1 }, (_, i) => i * GRID_MIN);

export interface RailRoutine {
  routine: Routine;
  startMin: number;
  endMin: number;
  done: boolean;
  /** False when the time comes from the template rather than this date. */
  fromOverride: boolean;
}

export function Timeline({
  contentRef,
  tasks,
  routines,
  blocks,
  windows,
  projectById,
  isToday,
  nowMin,
  onToggleTask,
  onToggleRoutine,
  onUnscheduleTask,
  onUnscheduleRoutine,
  onResizeTask,
  onResizeRoutine,
  onResizeBlock,
  onDeleteBlock,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  tasks: Task[];
  routines: RailRoutine[];
  blocks: TimeBlock[];
  windows: WorkWindow[];
  projectById: Map<string, Project>;
  isToday: boolean;
  nowMin: number;
  onToggleTask: (id: string) => void;
  onToggleRoutine: (id: string) => void;
  onUnscheduleTask: (id: string) => void;
  onUnscheduleRoutine: (id: string) => void;
  onResizeTask: (id: string, endMin: number) => void;
  onResizeRoutine: (id: string, endMin: number) => void;
  onResizeBlock: (id: string, endMin: number) => void;
  onDeleteBlock: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: "timeline" });

  /**
   * Memoised: an inline ref callback is a new function every render, so React
   * would call it with null and then the node again each time, and dnd-kit
   * would re-measure the droppable on every pass — an update loop.
   */
  const setRailRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      contentRef.current = node;
    },
    [setNodeRef, contentRef],
  );

  // bring the working part of the day into view without animating on load
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focusMin = isToday ? nowMinutes() - 90 : (windows[0]?.startMin ?? 8 * 60) - 30;
    el.scrollTop = Math.max(0, minToPx(focusMin));
    // deliberately once per day change, not on every tick of the clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, windows[0]?.startMin]);

  const hasWindows = windows.length > 0;
  const muted = hasWindows ? invert(windows) : [];

  // one shared lane layout, so a task and a routine at the same hour sit side by side
  const placed = layoutLanes<Interval & { key: string }>([
    ...tasks.map((t) => ({
      key: `task:${t.id}`,
      startMin: t.scheduledStartMin!,
      endMin: t.scheduledEndMin ?? t.scheduledStartMin! + 60,
    })),
    ...routines.map((r) => ({ key: `routine:${r.routine.id}`, startMin: r.startMin, endMin: r.endMin })),
  ]);
  const laneOf = new Map(placed.map((p) => [p.item.key, p]));

  const blockLanes = layoutLanes(blocks.map((b) => ({ ...b })));
  const blockLaneOf = new Map(blockLanes.map((p) => [p.item.id, p]));

  const conflictFor = (interval: Interval) => {
    const outside = hasWindows && muted.some((m) => overlaps(interval, m));
    const clash = blocks.some((b) => overlaps(interval, b));
    if (clash) return copy.schedule.insideBlocked;
    if (outside) return copy.schedule.outsideWork;
    return null;
  };

  return (
    <div
      ref={scrollRef}
      className={cn(
        "shadow-flat relative max-h-[calc(100vh-260px)] min-h-[420px] overflow-y-auto rounded-2xl border bg-surface transition-colors",
        isOver ? "border-blue/35" : "border-line-soft",
      )}
    >
      <div className="flex pb-10 pt-3">
        {/* hour gutter */}
        <div className="relative w-[52px] shrink-0" style={{ height: minToPx(DAY_MIN) }}>
          {HOURS.map((h) => (
            <span
              key={h}
              style={{ top: minToPx(h * 60) }}
              className={cn(
                "ltr-run absolute end-2 text-[11px] tabular-nums text-text-3",
                h === 0 ? "translate-y-0" : "-translate-y-1/2",
              )}
            >
              {formatClock(h * 60)}
            </span>
          ))}
        </div>

        {/* the rail itself */}
        <div
          ref={setRailRef}
          aria-label={copy.a11y.timeline}
          className="relative flex-1 pe-3"
          style={{ height: minToPx(DAY_MIN) }}
        >
          {/* Availability, and only once the day has been told: work windows
              keep the rail's white, everything else is shaded down. Brightness
              alone carries it — no borders, no labels. */}
          {hasWindows &&
            muted.map((m, i) => <Band key={`m-${i}`} interval={m} className="bg-offhours" />)}

          {/* Grid. Translucent ink rather than a solid light grey, so the lines
              read the same over white and over the shaded bands. */}
          {HALF_HOURS.map((min) => (
            <span
              key={min}
              style={{ top: minToPx(min) }}
              className={cn(
                "pointer-events-none absolute inset-x-0 h-px",
                min % 60 === 0 ? "bg-text/[0.11]" : "bg-text/[0.055]",
              )}
            />
          ))}

          {/* blocked time: above availability, below tasks */}
          {blocks.map((block) => {
            const laned = blockLaneOf.get(block.id);
            return (
              <RailBlock
                key={block.id}
                id={`block:${block.id}`}
                data={{ kind: "block", id: block.id }}
                startMin={block.startMin}
                endMin={block.endMin}
                lane={laned?.lane ?? 0}
                lanes={laned?.lanes ?? 1}
                onResize={(end) => onResizeBlock(block.id, end)}
                resizeLabel={copy.a11y.resizeBlock(block.title)}
                z={10}
                // no border and no accent bar: both are task-card language
                className="blocked-fill rounded-md"
              >
                {(liveEnd) => (
                  <div className="flex h-full items-start gap-1.5 px-2.5 py-1">
                    <div className="min-w-0 flex-1">
                      {/* muted against a task, but still legible on the darker
                          fill: the step down is weight and size, not fading out */}
                      <p className="truncate text-[11.5px] font-medium text-text-2">{block.title}</p>
                      <span className="ltr-run block text-[10.5px] font-normal tabular-nums text-text-2">
                        {formatClock(block.startMin)}–{formatClock(liveEnd)}
                      </span>
                    </div>
                    <RemoveButton label={copy.schedule.removeBlock} onClick={() => onDeleteBlock(block.id)} />
                  </div>
                )}
              </RailBlock>
            );
          })}

          {/* tasks */}
          {tasks.map((task) => {
            const start = task.scheduledStartMin!;
            const end = task.scheduledEndMin ?? start + 60;
            const laned = laneOf.get(`task:${task.id}`);
            const project = task.projectId ? projectById.get(task.projectId) : undefined;
            const done = task.status === "done";
            const warning = conflictFor({ startMin: start, endMin: end });
            // hue from the project (green once done); intensity from the size
            const hue: PaletteColor = done ? "green" : (project?.color ?? "blue");

            return (
              <RailBlock
                key={task.id}
                id={`sched-task:${task.id}`}
                data={{ kind: "task", id: task.id, startMin: start, endMin: end }}
                startMin={start}
                endMin={end}
                lane={laned?.lane ?? 0}
                lanes={laned?.lanes ?? 1}
                onResize={(e) => onResizeTask(task.id, e)}
                resizeLabel={copy.a11y.resizeBlock(task.title)}
                className={cn(
                  "border",
                  TASK_BLOCK_BORDER[task.size],
                  TASK_TINT[hue][task.size],
                  done ? "opacity-65" : "shadow-flat",
                )}
              >
                {(liveEnd) => (
                  <BlockBody
                    title={task.title}
                    startMin={start}
                    endMin={liveEnd}
                    done={done}
                    hue={hue}
                    size={task.size}
                    projectColor={project?.color}
                    important={task.isImportant}
                    warning={warning}
                    onToggle={() => onToggleTask(task.id)}
                    onRemove={() => onUnscheduleTask(task.id)}
                    checkboxLabel={copy.a11y.toggleTask(task.title, done)}
                  />
                )}
              </RailBlock>
            );
          })}

          {/* routines */}
          {routines.map(({ routine, startMin, endMin, done, fromOverride }) => {
            const laned = laneOf.get(`routine:${routine.id}`);
            const warning = conflictFor({ startMin, endMin });
            return (
              <RailBlock
                key={routine.id}
                id={`sched-routine:${routine.id}`}
                data={{ kind: "routine", id: routine.id, startMin, endMin }}
                startMin={startMin}
                endMin={endMin}
                lane={laned?.lane ?? 0}
                lanes={laned?.lanes ?? 1}
                onResize={(e) => onResizeRoutine(routine.id, e)}
                resizeLabel={copy.a11y.resizeBlock(routine.title)}
                // routines aren't tasks: no size, so they sit at the medium step
                className={cn(
                  "border border-line-soft",
                  TASK_TINT.teal.medium,
                  done ? "opacity-65" : "shadow-flat",
                )}
              >
                {(liveEnd) => (
                  <BlockBody
                    title={routine.title}
                    startMin={startMin}
                    endMin={liveEnd}
                    done={done}
                    hue="teal"
                    size="medium"
                    routine
                    warning={warning}
                    onToggle={() => onToggleRoutine(routine.id)}
                    // a template time is removed by editing the routine, not
                    // by hiding it for one day — so only an override gets a ✕
                    onRemove={fromOverride ? () => onUnscheduleRoutine(routine.id) : undefined}
                    checkboxLabel={copy.a11y.toggleRoutine(routine.title, done)}
                  />
                )}
              </RailBlock>
            );
          })}

          {/* now */}
          {isToday && (
            <div
              aria-label={copy.a11y.currentTime}
              style={{ top: minToPx(nowMin), zIndex: 40 }}
              className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center gap-1.5"
            >
              <span className="ltr-run shrink-0 rounded-md bg-rose px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                {formatClock(nowMin)}
              </span>
              <span className="h-px flex-1 bg-rose/70" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Band({ interval, className }: { interval: Interval; className?: string }) {
  return (
    <span
      className={cn("pointer-events-none absolute inset-x-0", className)}
      style={{ top: minToPx(interval.startMin), height: minToPx(interval.endMin - interval.startMin) }}
    />
  );
}

function BlockBody({
  title,
  startMin,
  endMin,
  done,
  hue,
  size,
  projectColor,
  routine,
  important,
  warning,
  onToggle,
  onRemove,
  checkboxLabel,
}: {
  title: string;
  startMin: number;
  endMin: number;
  done: boolean;
  /** Which colour: the project's, or green/teal once done. */
  hue: PaletteColor;
  /** How loud: bar thickness, tint intensity and type all step off this. */
  size: TaskSize;
  projectColor?: Project["color"];
  routine?: boolean;
  /** Read-only here: the rail shows the mark, the lists own the toggle. */
  important?: boolean;
  warning: string | null;
  onToggle: () => void;
  /** Omitted when the block's time is owned by a template rather than the day. */
  onRemove?: () => void;
  checkboxLabel: string;
}) {
  const short = endMin - startMin < 45;

  return (
    <div className="flex h-full items-start gap-2 px-2 py-1.5">
      {/* static lookups: Tailwind can't see an interpolated class name */}
      <span className={cn("h-full shrink-0 rounded-full", TASK_BAR_WIDTH[size], PROJECT_DOT[hue])} />

      {/* the checkbox must not start a drag */}
      <span onPointerDown={(e) => e.stopPropagation()} className="mt-px shrink-0">
        <Checkbox
          size="sm"
          shape={routine ? "circle" : "square"}
          tone={routine ? "teal" : "green"}
          checked={done}
          onChange={onToggle}
          label={checkboxLabel}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            // size still reads once done — only the colour and opacity change
            "truncate leading-snug",
            TASK_BLOCK_TITLE[size],
            done ? "text-text-2 line-through decoration-text-3/50 decoration-1" : "text-text",
          )}
        >
          {title}
        </p>
        {!short && (
          <span className="ltr-run mt-0.5 flex items-center gap-1 text-[10.5px] tabular-nums text-text-3">
            {formatClock(startMin)}–{formatClock(endMin)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {/* indicator only, and only when set — no empty hearts on the rail */}
        {important && <ImportantMark done={done} className="mt-1" />}
        {routine && <Repeat size={11} strokeWidth={2} className="mt-1 text-teal/70" />}
        {warning && (
          <span title={warning} className="mt-0.5 text-amber">
            <AlertTriangle size={12} strokeWidth={2} />
          </span>
        )}
        {projectColor && <ProjectDot color={projectColor} className="mt-1.5" />}
        {onRemove && <RemoveButton label={copy.schedule.unscheduled} onClick={onRemove} />}
      </div>
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-3 opacity-0 transition-all hover:bg-canvas hover:text-rose group-hover/block:opacity-100 no-hover:opacity-100"
    >
      <X size={12} strokeWidth={2} />
    </button>
  );
}
