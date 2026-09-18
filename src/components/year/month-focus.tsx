"use client";

/**
 * One month, every project, room to write.
 *
 * This is the working surface — the matrix is the map. It is also the phone's
 * default view, because twelve columns on a 360px screen would be a compressed
 * desktop layout rather than a mobile one. Sharing one component for both
 * means the mobile "project header, goals beneath it" requirement and the
 * desktop panel are the same code, not two things that can drift apart.
 *
 * A project with no goals renders exactly the single card it always has. A
 * project with goals renders as a plain group label — no card, no editor of
 * its own — followed by one small card per goal. That split is read live off
 * `goals`, not stored anywhere, so a project that loses its last goal falls
 * straight back to its own card with whatever `monthly_focus` it already had,
 * untouched the whole time.
 *
 * A goal with a KPI definition also gets one lightweight number field, above
 * its focus editor — this exact month's measurement (`GoalMonthlyKpi`), not
 * the goal's overall status. Empty deletes that month's measurement rather
 * than storing a blank; a real `0` is a legitimate value and is kept.
 */
import { useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { PROJECT_DOT } from "@/lib/palette";
import {
  focusItems,
  goalFocusItems,
  goalMonthlyKpiValue,
  goalsForProject,
  useDayStore,
} from "@/lib/store/day-store";
import { monthName } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { GoalMonthlyFocus, GoalMonthlyKpi, MonthlyFocus, Project, ProjectGoal } from "@/lib/types";

import { FocusEditor } from "./focus-editor";

export function MonthFocus({
  projects,
  focus,
  goals,
  goalMonthlyFocus,
  goalMonthlyKpi,
  year,
  month,
  isCurrentMonth,
  onPrevMonth,
  onNextMonth,
  onShowYear,
}: {
  projects: Project[];
  focus: MonthlyFocus[];
  goals: ProjectGoal[];
  goalMonthlyFocus: GoalMonthlyFocus[];
  goalMonthlyKpi: GoalMonthlyKpi[];
  year: number;
  month: number;
  isCurrentMonth: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onShowYear: () => void;
}) {
  const setMonthlyFocus = useDayStore((s) => s.setMonthlyFocus);
  const setGoalMonthlyFocus = useDayStore((s) => s.setGoalMonthlyFocus);
  const setGoalMonthlyKpi = useDayStore((s) => s.setGoalMonthlyKpi);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          {/* RTL: previous is to the right. */}
          <NavButton label={copy.year.prevMonth} onClick={onPrevMonth}>
            <ChevronRight size={18} strokeWidth={1.8} />
          </NavButton>

          <h2
            className={cn(
              "min-w-[7.5rem] text-center font-display text-[1.25rem] font-semibold tracking-[-0.015em] sm:text-[1.5rem]",
              isCurrentMonth ? "text-blue" : "text-text",
            )}
          >
            {monthName(month)}
          </h2>

          <NavButton label={copy.year.nextMonth} onClick={onNextMonth}>
            <ChevronLeft size={18} strokeWidth={1.8} />
          </NavButton>
        </div>

        {/* The way back, always on screen. The browser's back button leaves the
            page rather than closing this panel — see the note in year-view. */}
        <button
          type="button"
          onClick={onShowYear}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5",
            "shadow-flat text-[13px] font-medium text-text-2 transition-colors",
            "hover:border-blue/35 hover:text-blue sm:min-h-0 sm:py-1.5",
          )}
        >
          <CalendarRange size={15} strokeWidth={1.8} />
          {copy.year.backToYear}
        </button>
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 text-center text-[13.5px] text-text-3">
          {copy.year.noProjects}
          <span className="mt-1 block text-[12.5px]">{copy.year.noProjectsHint}</span>
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {projects.map((project) => {
            const mine = goalsForProject(goals, project.id);

            if (mine.length === 0) {
              return (
                <FocusCard key={project.id} color={project.color} title={project.name}>
                  <FocusEditor
                    cellKey={`project:${project.id}:${year}:${month}`}
                    items={focusItems(focus, project.id, year, month)}
                    onCommit={(next) => setMonthlyFocus(project.id, year, month, next)}
                  />
                </FocusCard>
              );
            }

            return (
              <div key={project.id}>
                {/* A label, not a card — the project itself carries no editor
                    once it has goals. */}
                <div className="flex items-center gap-2 px-0.5">
                  <span className={cn("h-3 w-3 shrink-0 rounded-full", PROJECT_DOT[project.color])} />
                  <h3 className="truncate text-[13px] font-medium text-text-2" title={project.name}>
                    {project.name}
                  </h3>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {mine.map((goal) => (
                    <FocusCard
                      key={goal.id}
                      color={project.color}
                      // Lighter than the project's own strip — the colour still
                      // says "which project," but the goal is the row here, so
                      // the full-strength accent belongs to the label above,
                      // not repeated at equal weight on every goal beneath it.
                      accentOpacity="opacity-50"
                      title={goal.title}
                    >
                      {goal.kpi && (
                        <GoalKpiValueEditor
                          goalId={goal.id}
                          year={year}
                          month={month}
                          unit={goal.kpi.unit}
                          value={goalMonthlyKpiValue(goalMonthlyKpi, goal.id, year, month)}
                          onCommit={(value) => setGoalMonthlyKpi(goal.id, year, month, value)}
                        />
                      )}
                      <FocusEditor
                        cellKey={`goal:${goal.id}:${year}:${month}`}
                        items={goalFocusItems(goalMonthlyFocus, goal.id, year, month)}
                        onCommit={(next) => setGoalMonthlyFocus(goal.id, year, month, next)}
                      />
                    </FocusCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FocusCard({
  color,
  title,
  accentOpacity,
  children,
}: {
  color: Project["color"];
  title: string;
  accentOpacity?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-line-soft bg-surface px-4 py-3.5">
      <span
        className={cn("absolute inset-y-0 start-0 w-[3px]", PROJECT_DOT[color], accentOpacity)}
      />
      <h3 className="truncate text-[14px] font-medium text-text" title={title}>
        {title}
      </h3>
      {/* Between the title and the monthly-focus editor: the hierarchy this
          screen keeps is Goal, then its measured month (the caller's own
          `GoalKpiValueEditor`, when the goal has a KPI), then the steps
          taken toward it. */}
      {children}
    </article>
  );
}

/** `null` (empty field) is a distinct signature from any real number, so
 * clearing a value and switching straight to another empty month doesn't
 * skip a re-seed. */
const kpiSignature = (goalId: string, year: number, month: number, value: number | null) =>
  `${goalId}:${year}:${month}|${value ?? ""}`;

/**
 * One month's measurement for a goal's KPI — the lightweight field above its
 * focus editor. Same draft/re-seed shape as `FocusEditor`: local state is the
 * draft, the store is the truth, and they're reconciled on render whenever
 * the cell's identity or the store's own copy of it changes (a different
 * month opened, or the account finished loading) — never on a keystroke.
 */
function GoalKpiValueEditor({
  goalId,
  year,
  month,
  unit,
  value,
  onCommit,
}: {
  goalId: string;
  year: number;
  month: number;
  unit: string | null;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  const [seen, setSeen] = useState(() => kpiSignature(goalId, year, month, value));

  const current = kpiSignature(goalId, year, month, value);
  if (seen !== current) {
    setSeen(current);
    setDraft(value !== null ? String(value) : "");
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const n = Number(trimmed);
    // A number the store would refuse anyway (negative, not finite) just
    // reverts to the last known-good value rather than sending it — the
    // same "don't send what the database would reject" mirroring `setGoalKpi`
    // already does for the goal's own fields.
    if (!Number.isFinite(n) || n < 0) {
      setDraft(value !== null ? String(value) : "");
      return;
    }
    onCommit(n);
  };

  return (
    <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-gold-line bg-gold-soft px-2.5 py-1.5">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value !== null ? String(value) : "");
          }
        }}
        placeholder={copy.year.kpiValuePlaceholder}
        aria-label={copy.year.kpiValue}
        className="bare-input min-w-0 flex-1 rounded-md bg-transparent px-1 text-[13px] tabular-nums text-gold"
      />
      {unit && <span className="shrink-0 text-[12px] text-gold/80">{unit}</span>}
    </div>
  );
}

function NavButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-surface hover:text-text-2 sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}
