"use client";

import { PALETTE, PROJECT_DOT, PROJECT_RING } from "@/lib/palette";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { PaletteColor } from "@/lib/types";

export { PALETTE, PROJECT_DOT };

const SIZE = {
  sm: "h-1.5 w-1.5",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
} as const;

/** Accent only. Never a background fill, never a border on a whole card. */
export function ProjectDot({
  color,
  size = "sm",
  className,
}: {
  color: PaletteColor;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("shrink-0 rounded-full", PROJECT_DOT[color], SIZE[size], className)}
    />
  );
}

/**
 * Twelve dots on a 6 × 2 grid, in hue order. The selected one gets a ring,
 * not a bigger shape — the row must stay one even rhythm of dots.
 */
export function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: PaletteColor;
  onChange: (color: PaletteColor) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid w-fit grid-cols-6 gap-2", className)}>
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={copy.a11y.pickColor(color)}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cn(
            "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all",
            value === color
              ? cn("ring-2 ring-offset-2 ring-offset-surface", PROJECT_RING[color])
              : "hover:bg-canvas",
          )}
        >
          <span className={cn("h-3 w-3 rounded-full", PROJECT_DOT[color])} />
        </button>
      ))}
    </div>
  );
}
