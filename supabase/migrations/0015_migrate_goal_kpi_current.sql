-- 0015 — Retiring `project_goals.kpi_current`, now that `goal_monthly_kpi`
-- (0014) exists to hold it properly.
--
-- `0012` gave each goal one current value. That was the wrong shape — see
-- 0014's note — and this migration completes the move rather than leaving
-- the old column sitting alongside the new table. `0012`/`0013` may already
-- be applied to a live database with real data in `kpi_current`, so this
-- does not simply drop the column: any existing value is carried forward
-- first, into the calendar month this migration happens to run in. That is
-- the best available answer to "which month was this value for" — the old
-- model never recorded one — and it is far better than discarding a number
-- someone actually entered.
--
-- Order matters: the backfill must run before the column it reads is
-- dropped, and both must run before `project_goals_kpi_consistent` is
-- redefined without `kpi_current` in it.

-- ---------------------------------------------------------------- backfill
insert into public.goal_monthly_kpi (user_id, goal_id, project_id, year, month, value)
select
  user_id,
  id,
  project_id,
  extract(year  from now())::smallint,
  extract(month from now())::smallint,
  kpi_current
from public.project_goals
where kpi_current is not null;

-- ---------------------------------------------------------------- retire the column
alter table public.project_goals drop constraint project_goals_kpi_current_range;
alter table public.project_goals drop constraint project_goals_kpi_consistent;
alter table public.project_goals drop column kpi_current;

-- Same shape as before, minus `kpi_current`: a goal has no KPI definition at
-- all, or a complete one (non-blank label plus a target). `kpi_unit` stays
-- independently optional either way.
alter table public.project_goals add constraint project_goals_kpi_consistent check (
  (kpi_label is null and kpi_target is null)
  or
  (kpi_label is not null and btrim(kpi_label) <> '' and kpi_target is not null)
);

-- `project_goals_kpi_target_positive` (0012) is untouched — `kpi_target`
-- still exists and the rule still applies to it unchanged.
