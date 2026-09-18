-- 0007 — Monthly focus: the annual map.
--
-- Twelve months × projects × up to three things that matter. Deliberately NOT
-- tasks: no status, no completion, no due date, no size, and nothing here is
-- ever materialised into `tasks`. It is a planning surface, and the only thing
-- it records is intent.
--
--
-- WHY `items` IS AN ARRAY AND NOT THREE ROWS
--
-- The alternative was one row per item with a `position` column. That needs
-- `unique (project_id, year, month, position)` to cap the count, and then a
-- plain swap of two items violates that constraint halfway through unless the
-- whole reorder is deferred or routed through a temporary position. An array
-- has the order in it already: reordering is rewriting the value.
--
-- It also matches what `routines.weekdays` already does — a small, bounded,
-- ordered set living in one column rather than split across rows that could
-- disagree with each other. And it keeps a cell edit to a single upsert, which
-- is what lets the client's write queue collapse a burst of typing across
-- three items into one request carrying the final state.
--
--
-- A ROW EXISTS ONLY IF THE CELL HAS CONTENT
--
-- Empty months have no row, exactly as `routine_logs` has no row for a routine
-- that was never touched that day. Removing the last item deletes the row
-- rather than storing an empty array — which is why the bound below is
-- `between 1 and 3` and not `<= 3`. There is no such thing as a stored empty
-- focus cell.

create table monthly_focus (
  id         uuid primary key default gen_random_uuid(),

  -- `default auth.uid()` so the client never sends an owner: there is no field
  -- for it to get wrong, and an unauthenticated insert gets NULL and fails the
  -- NOT NULL. Fails closed rather than open. Same as every other table here.
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,

  -- No single-column reference to `projects` — see the ownership note below.
  project_id uuid not null,

  year       smallint not null,
  month      smallint not null,           -- 1 = January … 12 = December

  -- Ordered. Index 0 is the first focus item. 1–3 entries, never 0.
  items      text[] not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One cell per project per month, and the natural key the client upserts on.
  -- `project_id` is globally unique, so this needs no `user_id` to be correct —
  -- and it leads with `project_id`, which is what the cascade below looks up.
  unique (project_id, year, month),

  constraint monthly_focus_month_valid check (month between 1 and 12),
  -- A guard against a typo or a bad import, not a business rule about how far
  -- ahead anyone may plan.
  constraint monthly_focus_year_valid  check (year between 2000 and 2100),

  -- `coalesce` is load-bearing, and its absence would be a silent hole rather
  -- than a visible bug: `array_length('{}'::text[], 1)` is NULL, and a CHECK
  -- constraint *passes* when its expression evaluates to NULL. Without the
  -- coalesce this constraint would wave every empty array straight through —
  -- the same trap as the CASE without an ELSE in 0004.
  constraint monthly_focus_items_bounded
    check (coalesce(array_length(items, 1), 0) between 1 and 3),

  -- `array_length(…, 1)` only measures the first dimension, so a nested array
  -- would satisfy the bound above while holding any number of values.
  constraint monthly_focus_items_flat
    check (array_ndims(items) = 1),

  -- An item that renders as nothing still occupies one of the three slots.
  -- The client trims before writing; this catches what the client missed.
  -- (Whitespace-only text is not caught here — that needs a subquery, which a
  -- CHECK cannot have. `findInvalidRows` reports it before a restore.)
  constraint monthly_focus_items_not_blank
    check (not ('' = any (items))),

  -- OWNERSHIP, not just referential integrity.
  --
  -- Referential integrity checks run with elevated privilege and ignore RLS, so
  -- a plain `references projects (id)` would accept another user's project id:
  -- the row would pass the monthly_focus RLS check (its own user_id is still
  -- auth.uid()) while pointing across accounts. Carrying `user_id` into the key
  -- forces the referenced project to belong to the same owner.
  --
  -- CASCADE rather than SET NULL, because `project_id` is NOT NULL: a focus
  -- item with no project is meaningless, the way a routine log with no routine
  -- is. (A *task* with no project is ordinary, which is why that one sets null.)
  --
  -- Note this fires on a genuine DELETE only. The app never deletes a project —
  -- `archiveProject` sets `archived_at` and leaves every row in place, so an
  -- archived project keeps its focus data and restoring it brings the data back
  -- with it. This cascade exists for account deletion and direct DB work.
  constraint monthly_focus_project_same_owner
    foreign key (project_id, user_id) references projects (id, user_id)
    on delete cascade
);

-- The annual view reads a whole year at a time; `loadAll` reads the lot.
create index monthly_focus_user_idx on monthly_focus (user_id, year, month);

create trigger monthly_focus_touch before update on monthly_focus
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- RLS
--
-- Four explicit policies rather than one `for all`, scoped `to authenticated`,
-- with `(select auth.uid())` so the subselect is an InitPlan evaluated once per
-- query instead of once per row. Identical in shape to the nine tables in 0001;
-- the reasoning is written out there.

alter table monthly_focus enable row level security;

create policy monthly_focus_select_own on monthly_focus for select to authenticated
  using ((select auth.uid()) = user_id);
create policy monthly_focus_insert_own on monthly_focus for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy monthly_focus_update_own on monthly_focus for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy monthly_focus_delete_own on monthly_focus for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 0003 set `alter default privileges … grant … on tables to authenticated`
-- precisely so "table number ten" would not repeat the 42501 outage. That
-- covers this table when the migration is applied by the same role that ran
-- 0003 — this line makes it true regardless of which role applies it, and
-- states the privilege in the migration that creates the table rather than in
-- one three files back.
grant select, insert, update, delete on public.monthly_focus to authenticated;
