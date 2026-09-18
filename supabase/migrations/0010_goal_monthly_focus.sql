-- 0010 — Goal-owned monthly focus: `monthly_focus`'s sibling, not its replacement.
--
-- `monthly_focus` (0007) stays exactly as it is. This is a second table for
-- the same idea — up to three short things that matter in one month — owned
-- by a goal instead of directly by a project. It exists as its own table
-- rather than as a nullable `goal_id` column on `monthly_focus`, for a reason
-- worth stating plainly because it is not a style choice:
--
-- `monthly_focus` is keyed `unique (project_id, year, month)`. Once one
-- project can have several goals, "one project-level row per month" and "one
-- row per goal per month" are two different invariants that both mention
-- `project_id` — a single table can't express both with one ordinary UNIQUE
-- constraint. The natural fix, "at most one row where goal_id is null," is
-- only expressible as a *partial* unique index — and Supabase's upsert can
-- only target an ordinary one; PostgREST has no way to carry a partial
-- index's `where` predicate through `on_conflict=`. Making it work anyway
-- means a generated sentinel column standing in for NULL — solvable, but
-- exactly the kind of cleverness that is hard to get right once and harder
-- for the next person to trust without re-deriving it.
--
-- Two plain tables sidestep the whole problem. `goal_id` here is globally
-- unique — the same fact `routine_logs` already leans on for its own
-- `unique (routine_id, day)` — so `unique (goal_id, year, month)` is ordinary,
-- needs no partial predicate, and is upsertable with the same one-line
-- `.upsert(row, {onConflict: "goal_id,year,month"})` every other natural-key
-- table here already uses. It also makes "existing project-level focus is
-- never touched by adding goals" true by construction: there is nothing to
-- migrate, because it is a different table.
--
-- Every CHECK below is copied from `monthly_focus` unchanged — same items
-- bound, same flatness guard, same blank-item guard, same coalesce-before-
-- array_length trap avoided for the same reason (0007's comment explains it:
-- `array_length('{}',1)` is NULL, and a CHECK passes on NULL).

create table goal_monthly_focus (
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

  items      text[] not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- `goal_id` alone is enough — it is globally unique, like `routine_id` in
  -- `routine_logs`, so no `user_id` or `project_id` is needed to make this
  -- correct.
  unique (goal_id, year, month),

  constraint goal_monthly_focus_month_valid check (month between 1 and 12),
  constraint goal_monthly_focus_year_valid  check (year between 2000 and 2100),

  constraint goal_monthly_focus_items_bounded
    check (coalesce(array_length(items, 1), 0) between 1 and 3),
  constraint goal_monthly_focus_items_flat
    check (array_ndims(items) = 1),
  constraint goal_monthly_focus_items_not_blank
    check (not ('' = any (items))),

  -- OWNERSHIP: this is the constraint that makes "a goal must belong to the
  -- same project and user" and "cross-project goal references are impossible"
  -- true at the engine level rather than by application discipline. Pointing
  -- at `project_goals (id, project_id, user_id)` means a row here can only
  -- name a goal that is *itself* attached to the exact `project_id` this row
  -- also carries, for the same `user_id` — a goal from a different project of
  -- the same user is rejected exactly as a goal from a different user is.
  --
  -- CASCADE: deleting a goal takes its focus history with it. The app-level
  -- undo (`deleteGoal` in the store) is what makes this safe rather than
  -- silent — see the note there. This fires on a genuine goal delete, which,
  -- unlike a project, is a real and expected user action, not only an
  -- account-deletion path.
  constraint goal_monthly_focus_goal_same_project
    foreign key (goal_id, project_id, user_id) references project_goals (id, project_id, user_id)
    on delete cascade
);

create index goal_monthly_focus_user_idx on goal_monthly_focus (user_id, year, month);
create index goal_monthly_focus_goal_idx on goal_monthly_focus (goal_id);

create trigger goal_monthly_focus_touch before update on goal_monthly_focus
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- RLS

alter table goal_monthly_focus enable row level security;

create policy goal_monthly_focus_select_own on goal_monthly_focus for select to authenticated
  using ((select auth.uid()) = user_id);
create policy goal_monthly_focus_insert_own on goal_monthly_focus for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy goal_monthly_focus_update_own on goal_monthly_focus for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_monthly_focus_delete_own on goal_monthly_focus for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.goal_monthly_focus to authenticated;
