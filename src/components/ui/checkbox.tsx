"use client";

import { cn } from "@/lib/cn";

const SIZES = {
  lg: { box: "h-[22px] w-[22px]", stroke: 1.5 },
  md: { box: "h-[19px] w-[19px]", stroke: 1.5 },
  sm: { box: "h-[17px] w-[17px]", stroke: 1.6 },
} as const;

const TONES = {
  green: "var(--color-green)",
  teal: "var(--color-teal)",
} as const;

/**
 * The most-touched control on the page. A rounded square for tasks, a circle
 * for routines — the shape itself says "this one repeats", before any icon does.
 * The tick is drawn rather than switched on.
 */
export function Checkbox({
  checked,
  onChange,
  size = "md",
  shape = "square",
  tone = "green",
  label,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  size?: keyof typeof SIZES;
  shape?: "square" | "circle";
  tone?: keyof typeof TONES;
  label: string;
  className?: string;
}) {
  const s = SIZES[size];
  const fill = TONES[tone];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "group/check tap-target shrink-0 cursor-pointer rounded-lg outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        s.box,
        className,
      )}
    >
      <svg viewBox="0 0 20 20" className="h-full w-full">
        {shape === "square" ? (
          <rect
            x="1.4"
            y="1.4"
            width="17.2"
            height="17.2"
            rx="5.6"
            fill={checked ? fill : "transparent"}
            stroke={checked ? fill : "#d3d8e0"}
            strokeWidth={s.stroke}
            className={cn(
              "transition-all duration-200",
              !checked && "group-hover/check:fill-blue-soft group-hover/check:stroke-[var(--color-blue)]",
            )}
          />
        ) : (
          <circle
            cx="10"
            cy="10"
            r="8.5"
            fill={checked ? fill : "transparent"}
            stroke={checked ? fill : "#d3d8e0"}
            strokeWidth={s.stroke}
            className={cn(
              "transition-all duration-200",
              !checked && "group-hover/check:fill-teal-soft group-hover/check:stroke-[var(--color-teal)]",
            )}
          />
        )}
        <path
          d="M5.9 10.3 L8.7 13 L14.2 7"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: checked ? 0 : 1,
            transition: "stroke-dashoffset 220ms cubic-bezier(.3,.7,.3,1) 40ms",
          }}
        />
      </svg>
    </button>
  );
}
