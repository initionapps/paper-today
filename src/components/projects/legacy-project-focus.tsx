"use client";

/**
 * `monthly_focus` rows that predate the project's goals.
 *
 * Only ever rendered when both are true: the project has at least one goal
 * (so the annual view has stopped showing the project's own row and this
 * content is otherwise invisible there), and the project still has
 * project-level rows sitting in the database from before that goal existed.
 *
 * Nothing here is automatic. A row stays exactly as it is — visible only on
 * this screen — until it is explicitly moved to a goal or explicitly deleted.
 * See `moveMonthlyFocusToGoal` in the store for why a move refuses outright
 * rather than merging when the destination already has content.
 */
import { useState } from "react";
import { ArrowLeftRight, Trash2 } from "lucide-react";

import { legacyFocusForProject, useDayStore } from "@/lib/store/day-store";
import { monthName } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { ProjectGoal } from "@/lib/types";

export function LegacyProjectFocus({
  projectId,
  goals,
}: {
  projectId: string;
  goals: ProjectGoal[];
}) {
  const monthlyFocus = useDayStore((s) => s.monthlyFocus);
  const rows = legacyFocusForProject(monthlyFocus, projectId);

  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="text-[12px] font-semibold tracking-[0.05em] text-amber">
        {copy.projects.legacyFocus.title}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-3">
        {copy.projects.legacyFocus.hint}
      </p>

      <ul className="shadow-flat mt-4 overflow-hidden rounded-2xl border border-line-soft bg-surface">
        {rows.map((row, i) => (
          <LegacyRow
            key={`${row.year}-${row.month}`}
            projectId={projectId}
            year={row.year}
            month={row.month}
            items={row.items}
            goals={goals}
            bordered={i > 0}
          />
        ))}
      </ul>
    </section>
  );
}

function LegacyRow({
  projectId,
  year,
  month,
  items,
  goals,
  bordered,
}: {
  projectId: string;
  year: number;
  month: number;
  items: string[];
  goals: ProjectGoal[];
  bordered: boolean;
}) {
  const setMonthlyFocus = useDayStore((s) => s.setMonthlyFocus);
  const moveMonthlyFocusToGoal = useDayStore((s) => s.moveMonthlyFocusToGoal);

  const [selected, setSelected] = useState("");
  const [blocked, setBlocked] = useState(false);

  const move = () => {
    if (!selected) return;
    const moved = moveMonthlyFocusToGoal(projectId, selected, year, month);
    setBlocked(!moved);
  };

  return (
    <li className={cn("px-4 py-3.5", bordered && "border-t border-line-soft")}>
      <p className="text-[13px] font-medium text-text">
        {copy.projects.legacyFocus.monthLabel(monthName(month), year)}
      </p>

      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[13.5px] leading-relaxed text-text-2">
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setBlocked(false);
          }}
          aria-label={copy.projects.legacyFocus.moveTo}
          className={cn(
            "h-9 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] text-text-2",
            "outline-none focus:border-blue/40",
          )}
        >
          <option value="">{copy.projects.legacyFocus.moveTo}</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={move}
          disabled={!selected}
          className={cn(
            "flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
            selected
              ? "border-blue/35 bg-blue-soft text-blue hover:border-blue/50"
              : "cursor-default border-line-soft text-text-3",
          )}
        >
          <ArrowLeftRight size={14} strokeWidth={1.9} />
          {copy.projects.legacyFocus.move}
        </button>

        <button
          type="button"
          onClick={() => setMonthlyFocus(projectId, year, month, [])}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] text-text-3 transition-colors hover:text-rose"
        >
          <Trash2 size={14} strokeWidth={1.9} />
          {copy.projects.legacyFocus.delete}
        </button>
      </div>

      {blocked && (
        <p role="alert" className="mt-2 text-[12px] text-rose">
          {copy.projects.legacyFocus.blocked}
        </p>
      )}
    </li>
  );
}
