# Database schema — decisions and rationale

**Applied and live.** Real data flows through these tables — the app's entire
state is here, and `localStorage` no longer holds any of it.

Six migrations, all applied and **frozen**. Every change from here is a new
numbered migration; none of these are edited in place again.

| | |
| --- | --- |
| [`0001_init.sql`](../supabase/migrations/0001_init.sql) | 9 tables, 2 enums, RLS + 36 policies, composite ownership FKs |
| [`0002_profile_trigger.sql`](../supabase/migrations/0002_profile_trigger.sql) | creates a `profiles` row on signup (`security definer`) |
| [`0003_grants.sql`](../supabase/migrations/0003_grants.sql) | table privileges for `authenticated` — see below |
| [`0004_task_completion_constraint.sql`](../supabase/migrations/0004_task_completion_constraint.sql) | lets an archived task keep its completion time |
| [`0005_migration_marker.sql`](../supabase/migrations/0005_migration_marker.sql) | `profiles.local_migrated_at` |
| [`0006_restore_backup.sql`](../supabase/migrations/0006_restore_backup.sql) | transactional whole-account replace, `security invoker` |

**`0003` exists because RLS and `GRANT` are independent.** `0001` enabled row
level security but never granted table privileges: RLS decides *which rows* a
role sees, `GRANT` decides whether it may touch the table at all. With only the
first, a fully authenticated user gets `42501 permission denied` — which looks
exactly like RLS working, and was briefly misread as such.

**`0004` exists because `0001` encoded a rule the domain does not have.** The
original constraint required `completed_at` to be present exactly when
`status = 'done'`. But `archiveTask` deliberately leaves the timestamp alone, so
a task completed and later archived carries both `archived` and a real
completion time — a row the old constraint rejected. The fix widened the
database to match the model rather than editing the data to fit the database:
`open` must have no timestamp, `done` must have one, `archived` may have either.

```
profiles ──┬── projects ──┐
           ├── routines ──┼── routine_logs   (one row per routine per day)
           ├── tasks ─────┘
           ├── notes                          (never joined to tasks)
           └── day_logs                       (wrap-up record)
```

## The seven decisions worth arguing about

**1. A day is a `date` column, not a table.**
`tasks.planned_date` is the day a task is intended for. A "day" has no identity
of its own — it is just every row matching a date. Consequence: opening a day
is one indexed query, and "move to tomorrow" is an `UPDATE` of one column.
There is no day to create, migrate or garbage-collect.

`planned_date` is **nullable**, and `NULL` is a first-class state: a real task
with no intended day. That is the backlog, and it is the reason All Tasks
exists — without it, a task not assigned to a date has nowhere to live.

**1b. `planned_date` and `due_date` are different questions.**
*When I intend to work on it* versus *when it is actually due*. They are
deliberately **not** constrained against each other: planning to work on
something after its deadline means you are late, and planning well before it is
ordinary. A `check (due_date >= planned_date)` would reject both.

**2. Nothing rolls over, and the schema is why.**
Because `planned_date` only changes on an explicit `UPDATE`, an unfinished task
simply stays on the day it was written. There is no cron, no "carry forward"
flag, no `due_date` that quietly re-surfaces work.

The cost of that honesty is that a task planned for yesterday and left open is
no longer on any visible day. That is exactly what the **overdue** group in All
Tasks is for: it is derived (`planned_date < today and status = 'open'`), never
stored, and it is the only thing standing between "nothing rolls over" and
"things silently disappear".

**3. `size` is a column on the task, not a section membership.**
Sections are a rendering of `size`; dragging a card between them is an `UPDATE
tasks SET size = …`. That is what makes size *persistent* — a task carries its
weight with it into All Tasks, Projects and tomorrow.

**4. Routines never become task rows.**
A routine is a template (`routines`) plus a per-day fact (`routine_logs`).

`routines.weekdays` **is** the recurrence — 7 entries is "every day", 1 is
"weekly", anything between is a chosen set. A separate recurrence enum beside
it would be a second value describing the same fact, free to disagree; the UI
derives which mode is selected instead. Archiving uses `archived_at` alone, for
the same reason as projects.

An optional `fixed_start_min` / `fixed_end_min` on the template puts the routine
on the rail every day it applies, with no dragging. A single date overrides it
through `routine_logs`, which is the *whole* exception model:

```
this date's log override  →  else the template's fixed time  →  else unscheduled
```

Nothing else is needed: completion and per-day scheduling already live on the
same `(routine, day)` row, and archiving leaves past logs untouched so history
survives.
If routines were materialised into `tasks`, All Tasks would fill with hundreds
of "Morning pages" rows and the task list would stop meaning anything.
`routine_logs` rows are created lazily — no row means "not done", so an
untouched routine costs nothing.

**4b. A project is archived by a timestamp, not by a status field.**
`archived_at is null` **is** the active state, and a timestamp records both
*that* it was archived and *when*. There is deliberately no `status` enum
beside it: two columns describing one fact can disagree, and then something has
to police them. Archiving a project leaves its tasks alone — they keep their
`project_id`, so nothing is lost and restoring is a single `UPDATE`.

A project carries `description` (one line, shown wherever it appears) and
`notes` (long-form, project page only). Both are `not null default ''`, so the
UI never has to distinguish empty from absent. `color` stays a palette key —
it is only ever an accent, never a fill.

**4c. The Schedule's two tables never touch `tasks`.**
`time_blocks` (meetings, lunch, travel) and `work_windows` (availability) are
both just `day + start_min + end_min`, and neither joins to a task. Supporting
them required **no change to the task model at all** — the rail simply draws
three independent interval sets over one minute axis.

They are two tables rather than one with a `kind`, because a work window has no
title and renders as background while a blocked item has one and renders as a
chip; merging them would mean a nullable column plus a discriminator the UI
branches on anyway.

Overlapping work windows are **merged on read**, not on write: every total runs
through an interval merge, so work time is never double-counted whatever is
stored.

Merging on write was the first implementation and it was a bug. Availability is
edited through `<input type="time">`, which emits intermediate values as you
type — "13:00" passes through "01:00" — and an intermediate value can overlap
the neighbouring window for one keystroke. Collapsing rows at that instant
destroyed a window the user was not editing and could not get back. The editor
now normalises once, when it closes, where merging cannot eat live input.

`day` here means a real day, matching `notes` / `routine_logs` / `day_logs` —
only `tasks` gets `planned_date`, because only a task can be *meant* for a day.

**5. Notes are structurally incapable of being tasks.**
`notes` has no `size`, no `status`, no `project_id`, and no foreign key to
`tasks`. The requirement "notes must not appear in the task database" is
enforced by the shape of the table, not by a `WHERE` clause somebody can forget.
`x`/`y` are stored as 0–1 fractions of the notes area so positions survive a
window resize.

**6. Schedule blocks are fields, not rows — and a task has no duration.**
`scheduled_start_min` + `scheduled_end_min` live on `tasks` (and
`routine_logs`). Dropping a task on the hour rail sets them; the task stays on
Today and renders its time. Nulls mean unscheduled — the default.

A block's length is `end - start`, computed at render and **never stored**.
There is deliberately no estimate field: a task does not carry a duration
around with it, only a scheduled block does, and only while it is scheduled.
*The trade-off:* one task gets at most one block per day. Splitting a task
across two blocks would need a `schedule_blocks` child table. That is a real
future migration, and it is the right call to defer it: the MVP interaction is
"drag this onto 14:00", not "shard my afternoon".

**Confirmed for the MVP** (2026-08-11): one block per task, no migration now.
Split scheduling gets added only if real use asks for it. When it does, the
move is additive — create `schedule_blocks`, copy the non-null pairs across,
then drop the two columns — so nothing here has to be designed around it today.

The same two fields on `routine_logs` are what let routines occupy the hour
rail as well; that is a settled requirement, not a maybe.

**7. `sort_order` is a `double precision`, not an integer rank.**
Dropping a card between two neighbours writes the midpoint of their orders —
one row updated instead of renumbering the section. Fractions get
re-normalised in a background pass when they run out of precision (~50
consecutive inserts at the same spot); the client already generates orders this
way today.

## Status, and the invariant that keeps it honest

`status` is `open | done | archived` and `completed_at` must agree with it:

```sql
check ((status = 'done') = (completed_at is not null))
```

So "done" always carries *when*, which is what makes the schedule block able to
change appearance on completion and what a future review screen will read.
Archive is a status rather than a delete, so archived work stays queryable and
"Archive" never feels destructive.

`tasks` has deliberately **no `archived_at`** beside that status. An earlier
draft carried both, which is the same "two columns describing one fact can
disagree" trap that decision 4b rejects for projects — just pointing the other
way. The two tables land on opposite single sources of truth on purpose:
`projects` uses a nullable timestamp (there is no other project state to
model), `tasks` uses the status enum (which already has to exist for
open/done). The cost is that a task does not record *when* it was archived;
nothing reads that today, and adding it later is one column.

## What the Schedule view will read

One query per day, union of two shapes — tasks and routine logs share only the
handful of fields an hour-rail block needs:

```sql
select id, title, status, scheduled_start_min, scheduled_end_min from tasks
  where user_id = auth.uid() and planned_date = $1 and scheduled_start_min is not null
union all
select l.id, r.title, …                       from routine_logs l
  join routines r on r.id = l.routine_id
  where l.user_id = auth.uid() and l.day = $1 and l.scheduled_start_min is not null;
```

Note the asymmetry: a task is on the rail because of its **`planned_date`**,
while a routine log is keyed by the **`day`** it actually happened on. Those
are different concepts and the column names keep them apart.

## Client-side migration

Historical, but still load-bearing. The store no longer writes to
`localStorage` — but **backup files carry a `dataVersion`**, and a browser that
has not yet run the one-time import still holds a versioned envelope. Both are
read through `migratePersisted`, so these steps still run, and a browser sitting
on v1 walks all the way up before its rows are mapped to uuids and imported:

- **v1 → v2** — `day → plannedDate`, `dueDate` appears, and a stored
  `durationMin` is folded into `scheduledEndMin` (`start + duration`).
- **v2 → v3** — projects gain `description` and `notes`. Active vs archived
  needed no migration at all, because `archivedAt` already expressed it.
- **v3 → v4** — `timeBlocks` and `workWindows` appear as empty arrays. Purely
  additive: no field is renamed or reinterpreted, so nothing can break.
- **v4 → v5** — routines swap `active: boolean` for `archivedAt` and gain
  `fixedStartMin` / `fixedEndMin` / `createdAt`. Past `routineLogs` are left
  exactly as they are: archiving must never erase history.
- **v5 → v6** — tasks gain `isImportant`, backfilled to `false`. Purely
  additive, like v3 → v4: nothing is renamed or reinterpreted.

Without these steps, data already saved during real use would fail to match its
new shape and vanish, so `migratePersisted` in `day-store.ts` is load-bearing,
not housekeeping.

## Ownership

Every account is a **private personal workspace**. There are no teams, no
shared workspaces, no collaborators, no roles, no admin model — and the schema
is shaped so that adding one later is a visible change, not an accident.

Every user-owned table carries `user_id uuid not null default auth.uid()
references auth.users (id) on delete cascade`. `profiles` is the exception in
form only: its primary key *is* the auth user id.

Two details in that line are load-bearing:

- **`default auth.uid()`** means the client never sends an owner at all. There
  is no field for it to get wrong, and an unauthenticated insert resolves to
  `NULL` and dies on the `NOT NULL` — it fails closed rather than open.
- **`on delete cascade`** from `auth.users` makes deleting the account erase
  every row belonging to it, with no orphans and no cleanup job. Note that
  *triggering* that delete needs admin credentials (the service-role key), so
  it is a dashboard/server operation, never something the browser client can do.

`routine_logs` and `notes` carry their own `user_id` rather than reaching it
through a parent, so no policy needs a join — a join inside a policy is
evaluated per row and is the usual reason Supabase apps get slow.

### Cross-user references are impossible, not merely unlikely

Only two foreign keys point between user-owned tables: `tasks → projects` and
`routine_logs → routines`. Both carry `user_id` **into the key**:

```sql
constraint tasks_project_same_owner
  foreign key (project_id, user_id) references projects (id, user_id)
  on delete set null (project_id)
```

This is not decoration. **Referential-integrity checks run with elevated
privilege and ignore RLS.** With a plain `references projects (id)`, a request
could insert a task whose own `user_id` is honestly `auth.uid()` — passing the
RLS check — while `project_id` pointed at *someone else's* project, and the
foreign key would validate it. The row would be unreadable to its owner's
victim and invisible in the UI, but it would exist. Carrying `user_id` into the
key forces the referenced project to share the owner, and the engine enforces
that on every path: no client, API or hand-written SQL can route around it.

Three consequences worth knowing:

- Each parent needs a `unique (id, user_id)` for the composite key to target.
  `id` is already unique alone; those constraints exist purely so the FK has
  something to reference.
- The **column list on `set null` is required**, not stylistic. A bare
  `on delete set null` would try to null `user_id` as well and fail its
  `NOT NULL`, which would make projects undeletable. Needs PostgreSQL 15+.
- Matching is `MATCH SIMPLE`, so a task with `project_id is null` skips the
  check entirely — exactly right for "no project". There is no partial-null
  loophole, because `user_id` is never null.

`routine_logs` cascades instead of nulling: a log without its routine means
nothing, where a task without a project is an ordinary backlog item.

## Row-level security

RLS is enabled on all nine tables, with **four explicit policies each** —
`select`, `insert`, `update`, `delete` — rather than one `for all`. The two are
functionally equivalent; the split is for auditability. You can see at a glance
that DELETE is restricted, and one command can change later without silently
reopening the others.

```sql
create policy tasks_select_own on tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy tasks_insert_own on tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy tasks_update_own on tasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tasks_delete_own on tasks for delete to authenticated
  using ((select auth.uid()) = user_id);
```

- **`to authenticated`.** Omitting the role attaches a policy to `public`,
  which includes `anon`. That is safe by accident — `auth.uid()` is `NULL`
  there and `NULL = user_id` is never true — but naming the role states the
  intent and skips the check for anonymous requests entirely.
- **`(select auth.uid())`, never bare `auth.uid()`.** The subselect is
  evaluated once per query as an InitPlan instead of once per row. Under RLS
  that is the difference between an index scan and a slow one.
- **UPDATE carries both `using` and `with check`.** `using` decides which rows
  may be touched; `with check` validates the row *after* the write. Without the
  second one, a user could hand a row to another account by rewriting
  `user_id`.

The database enforces this isolation by itself. Application-level filtering is
not a substitute and is not relied on anywhere: if every query in the client
forgot its `where user_id = …`, the result would be no rows, not a leak.
