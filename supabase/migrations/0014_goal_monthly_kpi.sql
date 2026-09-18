-- 0014 — Goal-owned monthly KPI values: `goal_monthly_focus`'s sibling, one
-- more time, for the same reason.
--
-- The static "one current value on the goal" model (`0012`) was wrong: a KPI
-- is supposed to show progress *across months*, and a single `kpi_current`
-- column can only ever hold the most recent one, overwriting history on
-- every edit. The fix is the same shape `goal_monthly_focus` already used for
-- exactly this problem — up to three focus items "in one month" instead of
-- one column on the goal — just for a single number instead of a text array.
--
-- `goal_id` is globally unique, the same fact `goal_monthly_focus` and
-- `routine_logs` already lean on, so `unique (goal_id, year, month)` is an
-- ordinary constraint needing no partial predicate, and upserts the same
-- one-line way every other natural-key table here does:
-- `.upsert(row, {onConflict: "goal_id,year,month"})`.
--
-- No row = no measurement, exactly like an untouched `goal_monthly_focus`
-- cell or an untouched `routine_log`: `value` is `not null`, and clearing a
-- month's number deletes the row rather than storing something empty.
create table goal_monthly_kpi (
  id         uuid primary key default gen_random_uuid(),

  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,

  -- No single-column reference to `project_goals` — see the ownership note.
  goal_id    uuid not null,
  -- Carried alongside `goal_id`, not derived from it by a join, so the
  -- composite ownership FK below can pin this row to the one project the
  -- goal actually belongs to without a second lookup.
  project_id uuid not null,

  year       smallint not null,
  month      smallint not null,           -- 1 = January … 12 = December

  value      double precision not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- `goal_id` alone is enough — it is globally unique, so no `user_id` or
  -- `project_id` is needed to make this correct.
  unique (goal_id, year, month),

  constraint goal_monthly_kpi_month_valid check (month between 1 and 12),
  constraint goal_monthly_kpi_year_valid  check (year between 2000 and 2100),
  -- Carried forward from the old `kpi_current` rule: a measured count or
  -- amount is never negative.
  constraint goal_monthly_kpi_value_range check (value >= 0),

  -- OWNERSHIP: the same composite FK `goal_monthly_focus_goal_same_project`
  -- uses, for the identical reason — a plain `references project_goals (id)`
  -- would accept a goal from a different project or a different user,
  -- because referential-integrity checks run with elevated privilege and
  -- ignore RLS. This makes both kinds of borrowing impossible at the engine
  -- level, not just unlikely.
  --
  -- CASCADE: deleting a goal takes its KPI history with it, exactly like it
  -- already takes `goal_monthly_focus` — the app-level undo in `deleteGoal`
  -- is what makes this safe rather than silent.
  constraint goal_monthly_kpi_goal_same_project
    foreign key (goal_id, project_id, user_id) references project_goals (id, project_id, user_id)
    on delete cascade
);

create index goal_monthly_kpi_user_idx on goal_monthly_kpi (user_id, year, month);
create index goal_monthly_kpi_goal_idx on goal_monthly_kpi (goal_id);

create trigger goal_monthly_kpi_touch before update on goal_monthly_kpi
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- RLS

alter table goal_monthly_kpi enable row level security;

create policy goal_monthly_kpi_select_own on goal_monthly_kpi for select to authenticated
  using ((select auth.uid()) = user_id);
create policy goal_monthly_kpi_insert_own on goal_monthly_kpi for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy goal_monthly_kpi_update_own on goal_monthly_kpi for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_monthly_kpi_delete_own on goal_monthly_kpi for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.goal_monthly_kpi to authenticated;
