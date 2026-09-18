-- 0009 — Project goals: an optional layer between a project and its months.
--
-- Up to five short named directions inside a project. A goal carries nothing
-- but a title and a position in this MVP: no KPI, no status, no due date, no
-- description. It exists to give the annual view somewhere more specific than
-- "the project" to hang monthly focus on, when a project is big enough to want
-- that split.
--
--
-- WHY A PLAIN SMALLINT POSITION, NOT `sort_order double precision`
--
-- Every other orderable table here — projects, routines, tasks — uses a float
-- with a midpoint-insert helper, because those lists are large enough and
-- edited often enough that rewriting every row on every reorder would be real
-- cost, and a float lets one row move without touching its neighbours.
--
-- A goal list is capped at five. Rewriting all five positions on every reorder
-- is the cheapest possible operation, and a plain integer you can read
-- straight off the row (0, 1, 2, 3, 4) needs no explanation the way "why is
-- this order value 1.5" eventually does. Reordering here writes every
-- affected goal's `sort_order` independently, exactly the way
-- `reorderRoutines` already writes every routine's — see
-- `day-store.ts`. No uniqueness is enforced on the column: it is a rendering
-- order, not an identity, and two goals transiently sharing a value while a
-- reorder's writes are still draining through the queue is harmless.
create table project_goals (
  id          uuid primary key default gen_random_uuid(),

  -- `default auth.uid()` so the client never sends an owner — same reasoning
  -- as every other table here: an unauthenticated insert gets NULL and fails
  -- the NOT NULL, which fails closed rather than open.
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,

  -- No single-column reference to `projects` — see the ownership note below.
  project_id  uuid not null,

  title       text not null,
  sort_order  smallint not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint project_goals_title_not_blank check (btrim(title) <> ''),

  -- `id` is already unique on its own; this exists solely to give the
  -- composite foreign key from `goal_monthly_focus` a unique key to point at —
  -- the same reason `projects_id_user_key` exists.
  constraint project_goals_id_project_user_key unique (id, project_id, user_id),

  -- OWNERSHIP, not just referential integrity — the same reasoning as every
  -- composite FK in this schema: a plain `references projects (id)` would
  -- accept another user's project id, because referential integrity checks
  -- run with elevated privilege and ignore RLS. Carrying `user_id` into the
  -- key forces the referenced project to belong to the same owner.
  --
  -- CASCADE: the app never deletes a project (`archiveProject` sets
  -- `archived_at` and leaves every row alone), so this fires only on account
  -- deletion or direct DB work — same note `monthly_focus` already carries.
  constraint project_goals_project_same_owner
    foreign key (project_id, user_id) references projects (id, user_id)
    on delete cascade
);

create index project_goals_project_idx on project_goals (project_id, user_id, sort_order);

create trigger project_goals_touch before update on project_goals
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- max 5
--
-- Not expressible as a CHECK or a UNIQUE constraint — both evaluate one row at
-- a time and neither can count siblings. A BEFORE INSERT trigger is the
-- standard way to enforce a per-group row cap in Postgres. The database is
-- what makes "at most five" true; the client mirrors it only so the fifth
-- attempt never reaches the network.
create or replace function public.project_goals_enforce_max()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.project_goals
  where project_id = new.project_id;

  if v_count >= 5 then
    raise exception 'a project may have at most 5 goals'
      using errcode = '23514'; -- check_violation: a cap, reported the same way a CHECK would be
  end if;

  return new;
end;
$$;

create trigger project_goals_max_five
  before insert on project_goals
  for each row execute function public.project_goals_enforce_max();

-- ---------------------------------------------------------------- RLS
--
-- Four explicit policies, `to authenticated`, `(select auth.uid())` — the same
-- shape as every other table; the reasoning is written out in `0001`.

alter table project_goals enable row level security;

create policy project_goals_select_own on project_goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy project_goals_insert_own on project_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy project_goals_update_own on project_goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy project_goals_delete_own on project_goals for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.project_goals to authenticated;
