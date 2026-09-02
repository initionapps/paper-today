/**
 * Geometry and interval maths for the Schedule. Pure functions only — no React,
 * no store — so the timeline's layout can be reasoned about (and corrected)
 * without touching a component.
 */
import type { TaskSize, TimeBlock, WorkWindow } from "./types";

/** One hour of rail, in pixels. Everything else derives from this. */
export const HOUR_H = 64;
export const MIN_H = HOUR_H / 60;
export const DAY_MIN = 1440;

/** Lines are drawn every 30 minutes; dragging lands every 15. */
export const GRID_MIN = 30;
export const SNAP_MIN = 15;

/**
 * How long a *newly created* block is. This is a creation default only — it is
 * never written to the task, which has no duration of its own. Once the block
 * exists its length is whatever the user resizes it to.
 */
export const DEFAULT_BLOCK_MIN = 60;
export const DEFAULT_BLOCK_BY_SIZE: Record<TaskSize, number> = {
  big: 60,
  medium: 60,
  small: 30,
};
export const MIN_BLOCK_MIN = 15;

export const minToPx = (min: number) => min * MIN_H;
export const pxToMin = (px: number) => px / MIN_H;

/**
 * Every block gives back a sliver of its own bottom edge, so two blocks that
 * touch — one ending exactly where the next begins — read as two shapes rather
 * than one glued rectangle.
 *
 * Visual only. `startMin` / `endMin` are untouched, and the gap is taken off
 * the bottom rather than the top so a block still starts exactly on its own
 * minute, level with the grid line and the hour gutter.
 */
export const BLOCK_GAP_PX = 3;

/**
 * Floor for a degenerate block, so one shorter than the 15-minute minimum
 * (stored by older data, never by the editor) stays visible and grabbable.
 *
 * Deliberately below the 15-minute height of 16px: a floor at or above it
 * would push the shortest blocks into their neighbour and undo the gap.
 */
export const MIN_BLOCK_H = 14;

/** Rendered height of a rail block: its true span, less the separating gap. */
export function blockHeight(startMin: number, endMin: number): number {
  return Math.max(minToPx(endMin - startMin) - BLOCK_GAP_PX, MIN_BLOCK_H);
}

export const clampMin = (min: number) => Math.max(0, Math.min(DAY_MIN, min));

export const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;

/** Minutes since local midnight, right now. */
export function nowMinutes(at: Date = new Date()): number {
  return at.getHours() * 60 + at.getMinutes();
}

/** 570 → '09:30'. Zero-padded, unlike the compact form used on task chips. */
export function formatClock(min: number): string {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 270 → '4:30', for durations rather than clock times. */
export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** '09:30' → 570. Returns null for the empty value an input can hold. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  return min >= 0 && min <= DAY_MIN ? min : null;
}

// ------------------------------------------------------------------ intervals

export interface Interval {
  startMin: number;
  endMin: number;
}

/** Sort, merge overlapping *and* touching intervals. Total time can't double-count. */
export function mergeIntervals<T extends Interval>(intervals: T[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && it.startMin <= last.endMin) last.endMin = Math.max(last.endMin, it.endMin);
    else out.push({ startMin: it.startMin, endMin: it.endMin });
  }
  return out;
}

export function totalMinutes(intervals: Interval[]): number {
  return mergeIntervals(intervals).reduce((sum, i) => sum + (i.endMin - i.startMin), 0);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/** How many minutes of `a` fall inside any of `others`. */
export function overlapMinutes(a: Interval, others: Interval[]): number {
  return mergeIntervals(others).reduce(
    (sum, b) => sum + Math.max(0, Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin)),
    0,
  );
}

/** The gaps between merged intervals across the whole day — what's *not* covered. */
export function invert(intervals: Interval[]): Interval[] {
  const merged = mergeIntervals(intervals);
  const gaps: Interval[] = [];
  let cursor = 0;
  for (const i of merged) {
    if (i.startMin > cursor) gaps.push({ startMin: cursor, endMin: i.startMin });
    cursor = Math.max(cursor, i.endMin);
  }
  if (cursor < DAY_MIN) gaps.push({ startMin: cursor, endMin: DAY_MIN });
  return gaps;
}

// ------------------------------------------------------------------ lanes

export interface Laned<T> {
  item: T;
  lane: number;
  lanes: number;
}

/**
 * Side-by-side placement for overlapping blocks, the way a calendar does it:
 * a block takes the first lane free at its start time, and every block in a
 * cluster of mutual overlaps shares that cluster's lane count so their widths
 * line up.
 */
export function layoutLanes<T extends Interval>(items: T[]): Laned<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Laned<T>[] = [];

  let cluster: Laned<T>[] = [];
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const entry of cluster) out.push({ ...entry, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    // a gap with nothing running means the previous cluster is finished
    if (laneEnds.length > 0 && laneEnds.every((end) => end <= item.startMin)) closeCluster();

    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    cluster.push({ item, lane, lanes: 1 });
  }
  closeCluster();

  return out;
}

// ------------------------------------------------------------------ capacity

export interface Capacity {
  workMin: number;
  blockedMin: number;
  scheduledMin: number;
  remainingMin: number;
}

/**
 * Blocked and scheduled time only count against capacity where they actually
 * fall inside a work window — a meeting at 20:00 doesn't eat into a 9–5 day.
 */
export function dayCapacity(
  windows: WorkWindow[],
  blocks: TimeBlock[],
  scheduled: Interval[],
): Capacity {
  const work = mergeIntervals(windows);
  const workMin = totalMinutes(work);

  const blockedMin = mergeIntervals(blocks).reduce((sum, b) => sum + overlapMinutes(b, work), 0);
  const scheduledMin = mergeIntervals(scheduled).reduce((sum, s) => sum + overlapMinutes(s, work), 0);

  // a task inside a meeting shouldn't be subtracted twice: merge the two sets
  // together first, then count only the part that lands inside a work window
  const usedInWork = mergeIntervals([...blocks, ...scheduled]).reduce(
    (sum, u) => sum + overlapMinutes(u, work),
    0,
  );

  return {
    workMin,
    blockedMin,
    scheduledMin,
    remainingMin: Math.max(0, workMin - usedInWork),
  };
}
