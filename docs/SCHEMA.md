# Database schema — decisions and rationale

DDL: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Not applied yet — Supabase is not started. It exists now because the client
store is deliberately shaped like these rows, so the swap is mechanical.

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

The store persists to `localStorage` under a version, and steps are applied in
order so a browser sitting on v1 walks all the way up:

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

## Row-level security

Every table is RLS-enabled with a single `auth.uid() = user_id` policy for all
operations. `routine_logs` and `notes` carry their own `user_id` (denormalised
from their parent) so no policy needs a join — a join in a policy is evaluated
per row and is the usual reason Supabase apps get slow.
