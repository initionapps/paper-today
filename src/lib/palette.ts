/**
 * Project accent classes. Plain data with no imports and no React, so every
 * layer can read it without creating a module cycle between the task and
 * project components.
 *
 * These are static class names on purpose: Tailwind cannot see an interpolated
 * one like `bg-${color}`.
 */
import type { PaletteColor, TaskSize } from "./types";

/**
 * Ordered by hue, which is the order the picker draws and the order
 * `addProject` cycles through, so two new projects are never the same colour.
 */
export const PALETTE: readonly PaletteColor[] = [
  "blue",
  "sky",
  "indigo",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "orange",
  "lime",
  "green",
  "teal",
  "slate",
] as const;

export const PROJECT_DOT: Record<PaletteColor, string> = {
  blue: "bg-blue",
  sky: "bg-sky",
  indigo: "bg-indigo",
  purple: "bg-purple",
  fuchsia: "bg-fuchsia",
  pink: "bg-pink",
  rose: "bg-rose",
  orange: "bg-orange",
  lime: "bg-lime",
  green: "bg-green",
  teal: "bg-teal",
  slate: "bg-slate",
};

export const PROJECT_RING: Record<PaletteColor, string> = {
  blue: "ring-blue/40",
  sky: "ring-sky/40",
  indigo: "ring-indigo/40",
  purple: "ring-purple/40",
  fuchsia: "ring-fuchsia/40",
  pink: "ring-pink/40",
  rose: "ring-rose/40",
  orange: "ring-orange/40",
  lime: "ring-lime/40",
  green: "ring-green/40",
  teal: "ring-teal/40",
  slate: "ring-slate/40",
};

/**
 * Schedule block fills. The project supplies the hue; the task's size supplies
 * the intensity — roughly 16% / 7% / 2.5% of the hue over white. The gap
 * between big and medium is deliberately wider than between medium and small,
 * so "this is the big one" reads before you have compared anything.
 *
 * These are pre-composited solids rather than `bg-blue/16` on purpose: a block
 * with an alpha background would let the availability shading behind it show
 * through, so the same task would look different inside and outside work hours.
 *
 * Every row is that mix computed against white. The original five are kept
 * byte-for-byte — `green.small` rounds a channel up by 1/255 against the
 * formula, and matching the shipped pixel matters more than matching the maths.
 */
export const TASK_TINT: Record<PaletteColor, Record<TaskSize, string>> = {
  blue: { big: "bg-[#e0ebfe]", medium: "bg-[#f1f6fe]", small: "bg-[#fafcff]" },
  sky: { big: "bg-[#d8f1fb]", medium: "bg-[#eef9fd]", small: "bg-[#f9fdfe]" },
  indigo: { big: "bg-[#e6e7fd]", medium: "bg-[#f4f4fe]", small: "bg-[#fbfbff]" },
  purple: { big: "bg-[#ece5fe]", medium: "bg-[#f7f4fe]", small: "bg-[#fcfbff]" },
  fuchsia: { big: "bg-[#f9e1fc]", medium: "bg-[#fcf2fe]", small: "bg-[#fefaff]" },
  pink: { big: "bg-[#fce2ef]", medium: "bg-[#fef2f8]", small: "bg-[#fffafc]" },
  rose: { big: "bg-[#fde0e5]", medium: "bg-[#fef2f4]", small: "bg-[#fffafb]" },
  orange: { big: "bg-[#fee9da]", medium: "bg-[#fff5ef]", small: "bg-[#fffcf9]" },
  lime: { big: "bg-[#ebf7da]", medium: "bg-[#f6fbef]", small: "bg-[#fcfef9]" },
  green: { big: "bg-[#dcf6e5]", medium: "bg-[#f0fbf4]", small: "bg-[#fafefb]" },
  teal: { big: "bg-[#d9f4f1]", medium: "bg-[#effaf9]", small: "bg-[#f9fdfd]" },
  slate: { big: "bg-[#e6e9ec]", medium: "bg-[#f4f5f7]", small: "bg-[#fbfcfc]" },
};

/** The loudest of the three size signals: a 4× spread from small to big. */
export const TASK_BAR_WIDTH: Record<TaskSize, string> = {
  big: "w-[8px]",
  medium: "w-[4px]",
  small: "w-[2px]",
};

export const TASK_BLOCK_TITLE: Record<TaskSize, string> = {
  big: "text-[16px] font-semibold",
  // medium lifts with small so the step between them stays readable
  medium: "text-[13.5px] font-medium",
  small: "text-[12.5px] font-normal",
};

/**
 * Big carries its own weight, so a hairline lighter than its own fill would
 * read as a halo. Small needs the outline or it disappears into the rail.
 */
export const TASK_BLOCK_BORDER: Record<TaskSize, string> = {
  big: "border-transparent",
  medium: "border-line-soft",
  small: "border-line-soft",
};
