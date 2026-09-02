-- Paper Today — initial schema
-- Design artifact, never applied: defined now so the client store can be shaped
-- like the DB, applied when Supabase is picked up (see docs/SCHEMA.md).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums

create type task_size   as enum ('big', 'medium', 'small');
create type task_status as enum ('open', 'done', 'archived');

-- ---------------------------------------------------------------- profiles

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  -- day boundaries are personal; "today" is resolved in the user's zone
  timezone     text        not null default 'UTC',

  -- One standing intention shown on Today. A single current value, not a
  -- record per day: it carries forward until it is changed, and changing it
  -- replaces it. No history, no date association — hence a column here rather
  -- than a table of its own.
  motto        text        not null default '',

  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects

create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,

  -- palette key ('blue', 'purple', …), never a hex value: the UI owns colour.
  -- Used only as an accent — a dot beside a task, a hairline on a card.
  color       text not null default 'blue',

  -- one line of context, shown under the name everywhere the project appears
  description text not null default '',
  -- the long-form room: decisions, links, half-thoughts. Project page only.
  notes       text not null default '',

  sort_order  double precision not null default 0,

  -- active / archived, with no second field to contradict it:
  -- null = active, a timestamp = archived, and it records *when*.
  archived_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_user_idx on projects (user_id, sort_order) where archived_at is null;

-- ---------------------------------------------------------------- routines

-- A routine is a template. It never appears in `tasks`, so All Tasks stays
-- a list of real tasks.
create table routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null,

  -- Bitmask-free and readable: 0 = Sunday … 6 = Saturday. This *is* the
  -- recurrence — 7 entries is "every day", 1 is "weekly", between is a chosen
  -- set. A separate recurrence enum would be a second value describing the
  -- same fact, and the two could disagree.
  weekdays    smallint[] not null default '{0,1,2,3,4,5,6}',

  -- Optional fixed time. When set, the routine is drawn on the rail on every
  -- day it applies, without dragging. A single date can still override it via
  -- routine_logs; the template is unaffected.
  fixed_start_min smallint,
  fixed_end_min   smallint,

  sort_order  double precision not null default 0,

  -- active / archived, with no second field to contradict it, as with projects
  archived_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint routines_weekdays_valid
    check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[] and array_length(weekdays, 1) > 0),
  constraint routines_fixed_start_range
    check (fixed_start_min is null or fixed_start_min between 0 and 1439),
  constraint routines_fixed_end_range
    check (fixed_end_min is null or fixed_end_min between 1 and 1440),
  constraint routines_fixed_end_after_start
    check (fixed_end_min is null
           or (fixed_start_min is not null and fixed_end_min > fixed_start_min))
);

create index routines_user_idx on routines (user_id, sort_order) where archived_at is null;

-- ---------------------------------------------------------------- tasks

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  project_id  uuid references projects on delete set null,

  title       text not null,
  detail      text,

  -- persistent, user-changeable; drives which section of the sheet it lands in
  size        task_size   not null default 'medium',
  status      task_status not null default 'open',

  -- WHEN I INTEND TO WORK ON IT. Changed ONLY by explicit user action
  -- (Move to today/tomorrow, pick a date, Wrap Up Day). Nothing rolls over.
  -- NULL = backlog: a real task with no intended day. Only rows where
  -- planned_date = today are drawn on the Today page.
  planned_date date,

  -- THE DEADLINE. Deliberately independent of planned_date and deliberately
  -- unconstrained against it: planning to work on something after its due date
  -- (you're late) or well before it are both legitimate states.
  due_date     date,

  -- A manual, binary marker — important or not, nothing in between. It is
  -- deliberately NOT a priority scale and deliberately independent of size:
  -- a big task is not automatically important, a small one can be. Nothing
  -- sorts, groups or filters on it; it only draws a heart.
  is_important boolean not null default false,

  -- ordering within (planned_date, size); fractional so a reorder is one UPDATE
  sort_order  double precision not null default 0,

  -- schedule block. Present ⇒ the task also shows on the hour rail.
  -- The task stays on Today either way. A task has no duration of its own —
  -- a block's length is end - start, derived, never stored.
  scheduled_start_min smallint,           -- minutes from local midnight, 0..1439
  scheduled_end_min   smallint,           -- 1..1440, so a block can end at 24:00

  completed_at timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_start_range
    check (scheduled_start_min is null or scheduled_start_min between 0 and 1439),
  constraint tasks_end_range
    check (scheduled_end_min is null or scheduled_end_min between 1 and 1440),
  constraint tasks_end_after_start
    check (scheduled_end_min is null
           or (scheduled_start_min is not null and scheduled_end_min > scheduled_start_min)),
  constraint tasks_done_has_timestamp
    check ((status = 'done') = (completed_at is not null))
);

-- btree indexes NULLs, so the "no date" backlog reads from this index too
create index tasks_planned_idx on tasks (user_id, planned_date, size, sort_order)
  where status <> 'archived';
create index tasks_project_idx on tasks (project_id) where status <> 'archived';
create index tasks_schedule_idx on tasks (user_id, planned_date, scheduled_start_min)
  where scheduled_start_min is not null;
-- no index on due_date yet: nothing sorts or filters by it. One line when it does.

-- ---------------------------------------------------------------- routine_logs

-- One row per (routine, day) — created lazily when the routine is first
-- touched on that day. Absence of a row = not done, not scheduled.
create table routine_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  routine_id  uuid not null references routines on delete cascade,
  day         date not null,

  completed_at        timestamptz,
  -- routines occupy the hour rail too; same start/end model as tasks
  scheduled_start_min smallint,
  scheduled_end_min   smallint,

  created_at  timestamptz not null default now(),

  unique (routine_id, day),
  constraint routine_logs_start_range
    check (scheduled_start_min is null or scheduled_start_min between 0 and 1439),
  constraint routine_logs_end_range
    check (scheduled_end_min is null or scheduled_end_min between 1 and 1440),
  constraint routine_logs_end_after_start
    check (scheduled_end_min is null
           or (scheduled_start_min is not null and scheduled_end_min > scheduled_start_min))
);

create index routine_logs_day_idx on routine_logs (user_id, day);

-- ---------------------------------------------------------------- time_blocks

-- Meetings, lunch, travel, appointments — anything that occupies time but is
-- not work you tick off. Deliberately NOT a task: no status, no project, no
-- size, no completion. Title, start, end. That is the whole model.
create table time_blocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  day        date not null,
  title      text not null,
  start_min  smallint not null,
  end_min    smallint not null,
  created_at timestamptz not null default now(),

  constraint time_blocks_range
    check (start_min >= 0 and end_min <= 1440 and end_min > start_min)
);

create index time_blocks_day_idx on time_blocks (user_id, day, start_min);

-- ---------------------------------------------------------------- work_windows

-- When you are actually available to work. No title: a window is not a thing
-- that happens, it is when you are around. A day with no rows has simply not
-- been told yet — which is different from a day with no availability.
--
-- Overlapping windows are tolerated in storage and merged when *read* — every
-- total goes through an interval merge, so work time is never double-counted.
-- They are deliberately NOT merged on write: an edit in progress can hold a
-- transient overlap ("13:00" is typed through "01:00"), and collapsing rows at
-- that moment destroys a window the user meant to keep. The editor normalises
-- once, on close.
create table work_windows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  day        date not null,
  start_min  smallint not null,
  end_min    smallint not null,
  created_at timestamptz not null default now(),

  constraint work_windows_range
    check (start_min >= 0 and end_min <= 1440 and end_min > start_min)
);

create index work_windows_day_idx on work_windows (user_id, day, start_min);

-- ---------------------------------------------------------------- notes

-- Sticky notes. Deliberately NOT tasks: no size, no status, no project.
-- Nothing in All Tasks or Projects ever reads this table.
create table notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  day        date not null,
  body       text not null default '',
  color      text not null default 'butter',   -- palette key
  -- free position within the notes area, stored as 0..1 fractions of the
  -- area box so the layout survives a different viewport width
  x          real not null default 0,
  y          real not null default 0,
  rotation   real not null default 0,          -- degrees, small, for tactility
  z          integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_day_idx on notes (user_id, day);

-- ---------------------------------------------------------------- day_logs

-- Record of the Wrap Up Day flow. Also the only place that knows a day was
-- consciously closed rather than just abandoned.
create table day_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  day         date not null,
  wrapped_at  timestamptz,
  reflection  text,
  unique (user_id, day)
);

-- ---------------------------------------------------------------- updated_at

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();
create trigger notes_touch before update on notes
  for each row execute function touch_updated_at();
create trigger projects_touch before update on projects
  for each row execute function touch_updated_at();
create trigger routines_touch before update on routines
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- RLS

alter table profiles     enable row level security;
alter table projects     enable row level security;
alter table routines     enable row level security;
alter table tasks        enable row level security;
alter table routine_logs enable row level security;
alter table time_blocks  enable row level security;
alter table work_windows enable row level security;
alter table notes        enable row level security;
alter table day_logs     enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own routines" on routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own routine_logs" on routine_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own time_blocks" on time_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own work_windows" on work_windows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notes" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own day_logs" on day_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
