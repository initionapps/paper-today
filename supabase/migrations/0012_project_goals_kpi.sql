-- 0012 — Goal KPI: one optional, simple measurable indicator per goal.
--
-- MVP-deliberately thin, matching `project_goals` itself: a label, a current
-- value, a target value, and an optional unit — no history, no formulas, no
-- second KPI, no dashboard. `project_goals` already exists in the live
-- database (0009), so this is a pure addition rather than a change to it.
--
--
-- WHY FOUR COLUMNS ON `project_goals`, NOT A SIBLING TABLE
--
-- `goal_monthly_focus` is a separate table from `monthly_focus` because "at
-- most one project-level row per (project, year, month)" needs a partial
-- unique index, and Postgres can only resolve `INSERT ... ON CONFLICT`
-- against a partial index by repeating its `WHERE` clause in the `ON
-- CONFLICT` clause itself — which PostgREST's `.upsert(row, {onConflict:
-- "..."})` has no way to express. That was a genuine constraint, not a style
-- choice (see 0010's note).
--
-- A KPI has no such uniqueness concern: it is strictly one-optional-value-
-- per-goal, never part of any key. Four nullable columns on the row that
-- owns it is the simplest shape that is still correct — a second table here
-- would only be duplicating `project_goals`'s own primary key for nothing.
--
--
-- WHY `double precision`, NOT `numeric`
--
-- Matches `sort_order` and the notes' `x` / `y` / `rotation` columns already
-- in this schema. It also avoids a real trap: Supabase/PostgREST returns a
-- `numeric` column as a *string*, not a JS number, which would force every
-- reader of this column to `parseFloat` for no benefit here — these are
-- display counts and amounts ("2 / 3 workouts", "4,200 / 12,000
-- subscribers"), not money that needs exact decimal arithmetic.
alter table project_goals
  add column kpi_label   text,
  add column kpi_current double precision,
  add column kpi_target  double precision,
  add column kpi_unit    text;

-- All three of label/current/target travel together: either a goal has no
-- KPI at all, or it has a complete one. A half-filled KPI (a target with no
-- label, say) is not a state the UI can ever produce, so the database
-- refuses to hold one rather than trusting every future writer to keep the
-- three in step by hand. `kpi_unit` stays independently nullable even when a
-- KPI exists — "3 workouts a week" is a complete KPI without a unit string.
alter table project_goals add constraint project_goals_kpi_consistent check (
  (kpi_label is null and kpi_current is null and kpi_target is null)
  or
  (kpi_label is not null and btrim(kpi_label) <> '' and kpi_current is not null and kpi_target is not null)
);

alter table project_goals add constraint project_goals_kpi_current_range
  check (kpi_current is null or kpi_current >= 0);

alter table project_goals add constraint project_goals_kpi_target_positive
  check (kpi_target is null or kpi_target > 0);

-- No RLS or grant changes: these are plain columns on a table that already
-- has both, and a policy is per-row, not per-column.
