"use client";

/**
 * Up to `MAX_GOALS` short directions inside a project. This is where a
 * project switches — live, not by a stored flag — between the annual view's
 * two modes: with none, the project keeps its own single row; with any, the
 * project becomes a group label and each goal gets a row of its own. See
 * `goalsForProject` and the note at the top of `annual-matrix.tsx`.
 *
 * Delete has no confirmation dialog, matching every other destructive action
 * in this app (`deleteTask`, `archiveProject`): it applies immediately and
 * the store's one-shot undo — cascading the goal's own monthly focus back in
 * with it — is what makes that safe rather than a modal.
 *
 * Each goal may also carry one optional KPI *definition* (`goal.kpi`) —
 * label, numeric target, unit, and an optional free-text `targetLabel` for
 * display — edited inline right below its title via `GoalKpiRow`. The
 * definition is all that lives here; a KPI's actual month-by-month
 * measurements are edited in the month panel instead (see `month-focus.tsx`)
 * and shown in the annual matrix, not on this screen — see the note on
 * `GoalMonthlyKpi`. Unlike the goal itself, clearing a KPI definition has no
 * undo: it doesn't touch any measurements already recorded (see
 * `setGoalKpi`), so nothing is actually lost by clearing it.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";

import { InlineComposer } from "@/components/today/inline-composer";
import { EditableText } from "@/components/task/editable-text";
import { PROJECT_DOT } from "@/lib/palette";
import { goalsForProject, useDayStore } from "@/lib/store/day-store";
import { kpiTargetText, MAX_GOALS } from "@/lib/types";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { GoalKpi, PaletteColor, ProjectGoal } from "@/lib/types";

export function ProjectGoals({ projectId, color }: { projectId: string; color: PaletteColor }) {
  const goals = useDayStore((s) => s.goals);
  const addGoal = useDayStore((s) => s.addGoal);
  const updateGoal = useDayStore((s) => s.updateGoal);
  const deleteGoal = useDayStore((s) => s.deleteGoal);
  const reorderGoals = useDayStore((s) => s.reorderGoals);

  const mine = goalsForProject(goals, projectId);

  const move = (id: string, delta: number) => {
    const ids = mine.map((g) => g.id);
    const index = ids.indexOf(id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorderGoals(projectId, ids);
  };

  return (
    <section>
      <h2 className="text-[12px] font-semibold tracking-[0.05em] text-text-2">
        {copy.projects.goals.title}
        {mine.length > 0 && (
          <span className="ms-2 font-normal tabular-nums text-text-3">
            {copy.projects.goals.countOf(mine.length, MAX_GOALS)}
          </span>
        )}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-3">{copy.projects.goals.hint}</p>

      {mine.length > 0 && (
        <ul className="shadow-flat mt-4 overflow-hidden rounded-2xl border border-line-soft bg-surface">
          {mine.map((goal, i) => (
            <li
              key={goal.id}
              className={cn("group/goal px-4 py-3", i > 0 && "border-t border-line-soft")}
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("h-3 w-3 shrink-0 rounded-full", PROJECT_DOT[color])} />

                <EditableText
                  value={goal.title}
                  onCommit={(title) => updateGoal(goal.id, title)}
                  ariaLabel={copy.a11y.goalTitle}
                  className="min-w-0 flex-1 text-[14px] text-text"
                />

                <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within/goal:opacity-100 group-hover/goal:opacity-100 no-hover:opacity-100">
                  <IconButton
                    label={copy.projects.goals.moveUp}
                    onClick={() => move(goal.id, -1)}
                    disabled={i === 0}
                  >
                    <ChevronUp size={14} strokeWidth={2} />
                  </IconButton>
                  <IconButton
                    label={copy.projects.goals.moveDown}
                    onClick={() => move(goal.id, 1)}
                    disabled={i === mine.length - 1}
                  >
                    <ChevronDown size={14} strokeWidth={2} />
                  </IconButton>
                  <IconButton label={copy.projects.goals.remove} onClick={() => deleteGoal(goal.id)}>
                    <X size={14} strokeWidth={2} />
                  </IconButton>
                </span>
              </div>

              {/* Indented to sit under the title, not the dot — Project >
                  Goal > KPI reads as nesting, not as a sibling row. */}
              <div className="ps-[22px]">
                <GoalKpiRow goal={goal} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {mine.length < MAX_GOALS ? (
        <div
          className={cn(
            "shadow-flat mt-3 rounded-2xl border border-line-soft bg-surface py-1",
            mine.length === 0 && "mt-4",
          )}
        >
          <div className="px-4">
            <InlineComposer
              variant="small"
              prompt={copy.projects.goals.add}
              onAdd={(title) => addGoal(projectId, title)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-text-3">{copy.projects.goals.max}</p>
      )}
    </section>
  );
}

/** A blank draft — every field a plain string, so a number input can hold
 * `""` mid-edit without fighting a numeric state type. */
type KpiDraft = { label: string; target: string; unit: string; targetLabel: string };

function draftFrom(kpi: GoalKpi | null): KpiDraft {
  return kpi
    ? { label: kpi.label, target: String(kpi.target), unit: kpi.unit ?? "", targetLabel: kpi.targetLabel ?? "" }
    : { label: "", target: "", unit: "", targetLabel: "" };
}

/**
 * One goal's KPI *definition*: a quiet "יעד: 12,000 נרשמים" line plus
 * hover-revealed edit/remove when one exists, a ghost "add" line when it
 * doesn't, or the compact inline form while either is being written. Three
 * states, one component, so a goal never shows more than one of them at
 * once. Deliberately not gold and not a badge — gold is reserved for an
 * actual measured month, which this screen never shows (see the file note).
 */
function GoalKpiRow({ goal }: { goal: ProjectGoal }) {
  const setGoalKpi = useDayStore((s) => s.setGoalKpi);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<KpiDraft>(() => draftFrom(goal.kpi));
  const [error, setError] = useState(false);

  const open = () => {
    setDraft(draftFrom(goal.kpi));
    setError(false);
    setEditing(true);
  };

  const save = () => {
    const label = draft.label.trim();
    const target = Number(draft.target);
    const unit = draft.unit.trim();
    const targetLabel = draft.targetLabel.trim();

    if (!label || !Number.isFinite(target) || target <= 0) {
      setError(true);
      return;
    }
    setGoalKpi(goal.id, { label, target, unit: unit || null, targetLabel: targetLabel || null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-2 max-w-sm rounded-xl border border-line-soft bg-canvas p-2.5">
        <input
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder={copy.projects.goals.kpi.labelPlaceholder}
          aria-label={copy.projects.goals.kpi.label}
          className="bare-input block w-full rounded-md border border-line-soft bg-surface px-2 py-1.5 text-[12.5px]"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={draft.target}
            onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
            placeholder={copy.projects.goals.kpi.target}
            aria-label={copy.projects.goals.kpi.target}
            className="bare-input w-[76px] rounded-md border border-line-soft bg-surface px-2 py-1.5 text-[12.5px] tabular-nums"
          />
          <input
            value={draft.unit}
            onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
            placeholder={copy.projects.goals.kpi.unit}
            aria-label={copy.projects.goals.kpi.unit}
            className="bare-input w-[96px] min-w-0 flex-1 rounded-md border border-line-soft bg-surface px-2 py-1.5 text-[12.5px]"
          />
        </div>

        <input
          value={draft.targetLabel}
          onChange={(e) => setDraft((d) => ({ ...d, targetLabel: e.target.value }))}
          placeholder={copy.projects.goals.kpi.targetTextPlaceholder}
          aria-label={copy.projects.goals.kpi.targetText}
          className="bare-input mt-1.5 block w-full rounded-md border border-line-soft bg-surface px-2 py-1.5 text-[12.5px]"
        />
        <p className="mt-1 text-[11px] leading-snug text-text-3">{copy.projects.goals.kpi.targetTextHint}</p>

        {error && (
          <p role="alert" className="mt-1.5 text-[11.5px] text-rose">
            {copy.projects.goals.kpi.invalid}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="cursor-pointer rounded-full bg-blue px-3 py-1 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {copy.projects.goals.kpi.save}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="cursor-pointer text-[12px] text-text-3 transition-colors hover:text-text-2"
          >
            {copy.projects.goals.kpi.cancel}
          </button>
        </div>
      </div>
    );
  }

  if (goal.kpi) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <p className="text-[12px] text-text-3">{copy.projects.goals.kpi.targetLine(kpiTargetText(goal.kpi))}</p>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within/goal:opacity-100 group-hover/goal:opacity-100 no-hover:opacity-100">
          <IconButton label={copy.projects.goals.kpi.edit} onClick={open}>
            <Pencil size={13} strokeWidth={2} />
          </IconButton>
          <IconButton label={copy.projects.goals.kpi.remove} onClick={() => setGoalKpi(goal.id, null)}>
            <X size={13} strokeWidth={2} />
          </IconButton>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="mt-1.5 cursor-pointer text-[12px] text-text-3 transition-colors hover:text-text-2"
    >
      + {copy.projects.goals.kpi.add}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-7 items-center justify-center rounded-md transition-colors",
        disabled
          ? "cursor-default text-text-3/30"
          : "cursor-pointer text-text-3 hover:bg-canvas hover:text-text-2",
      )}
    >
      {children}
    </button>
  );
}
