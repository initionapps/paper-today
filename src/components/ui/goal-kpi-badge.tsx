/**
 * One month's measured KPI value — the annual matrix's per-month cell and the
 * month panel's editor both render it through this exact component, so
 * "subtle gold, calm not shouty" can only ever drift in one place.
 *
 * Reuses the app's existing `--color-gold` family (`globals.css`) — the same
 * one the Big task card's hover border uses. That doesn't blur its meaning:
 * the reservation there is specifically that `PaletteColor` (a project's own
 * selectable accent) must never include gold, so a project's dot can never
 * be mistaken for "this is Big." A KPI badge carries no project-selectable
 * colour of its own and never appears near a task's size marker — there is
 * nothing here for a project to "become."
 *
 * Deliberately just the number and its unit — no target, no percentage, no
 * bar. The goal's KPI used to be one current value with a target and a
 * derived progress bar; now the value is a *series*, one per month, and the
 * point of showing it in the annual matrix is the month-by-month numbers
 * themselves, read left to right. A percentage or a bar per cell would
 * compete with that for attention rather than support it — see the note on
 * this in `docs/ARCHITECTURE.md`.
 */
import { cn } from "@/lib/cn";

/** `24000.75` → `"24,000.75"`, `3` → `"3"` — grouped for readability, never
 * padded with decimals a value doesn't actually have. Exported so callers
 * building their own `title`/screen-reader text (the matrix cell, the month
 * editor) format the same number the same way. */
export function formatKpiNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function GoalKpiValueBadge({
  value,
  unit,
  className,
}: {
  value: number;
  unit: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ltr-run inline-flex max-w-full items-baseline justify-center gap-1 whitespace-nowrap rounded-full border border-gold-line bg-gold-soft px-2.5 py-1",
        "text-[11px] font-medium leading-none tabular-nums text-gold",
        className,
      )}
    >
      <span>{formatKpiNumber(value)}</span>
      {unit && <span className="truncate">{unit}</span>}
    </span>
  );
}
