# Paper Today — Architecture

A personal daily planner: **one day, one bounded column** — deliberately not an
endless task list. Hebrew-first, RTL throughout, local-only.

> The folder is named `paper-today` and the SQL calls the app `paper-today`.
> That is a leftover from the first design round, which imitated a sheet of A4.
> **That metaphor was deliberately abandoned** — §5 describes the visual
> language that replaced it. Do not reintroduce paper texture, warm colours,
> serif type or a simulated page.

---

## 1. Product model (the part that drives every technical decision)

| Concept | Meaning | Lives where |
| --- | --- | --- |
| **Day** | One calendar day. The Today page *is* the day for `today`. | derived, not a row |
| **Task** | Has a persistent `size` (`big` / `medium` / `small`), a nullable `planned_date` (when I mean to do it) and an optional `due_date` (the deadline). Size is a property of the task, not of the layout. | `tasks` |
| **Backlog** | `planned_date is null`. A real task with no intended day. Visible only in All Tasks — never on Today. | `tasks` |
| **Routine** | A recurring intention. Its template is stored once; each day it produces a check, never a task row. | `routines` + `routine_logs` |
| **Project** | Name, accent colour, one-line description, long-form notes. Active or archived, and nothing else — no milestones, no progress, no dependencies. | `projects` |
| **Note** | Sticky note on the day. **Never** a task, never in All Tasks. | `notes` |
| **Schedule block** | A task (or routine) dragged onto the hour rail. It stays on Today and gains a time. | fields on the row |
| **Blocked time** | Meetings, lunch, travel. Occupies time but is not work you tick off — no status, no project, no size. | `time_blocks` |
| **Work window** | When you are available. No title; a day with none has simply not been told yet. | `work_windows` |

Two rules that fall out of this and must never be broken:

1. **Nothing moves by itself.** Unfinished tasks do not roll into tomorrow. A task changes day only when the user says so (`Move to tomorrow`, or the `Wrap Up Day` flow).
2. **Scheduling is decoration, not relocation.** Dragging a task into the Schedule sets `scheduled_start_min`; it does not remove the task from Today.

---

## 2. Stack

- **Next.js 16** (App Router, Turbopack) — routing + future server actions
- **React 19.2** / **TypeScript**
- **Tailwind v4** — CSS-first theming via `@theme` in `globals.css`
- **dnd-kit** — reordering, cross-section size change, later Today → Schedule
- **zustand** — in-memory copy of the signed-in account (no `persist`)
- **Supabase** — Postgres + RLS + auth; the source of truth for all data

### Why zustand now

The Today page is a single dense interactive surface: reorder, resize, inline
add, inline rename, sticky notes, wrap-up. Prop-drilling that through server
components would fight the framework. So the app keeps the whole day in one
client store behind a narrow action API (`addTask`, `setSize`, `moveToDay`, …).
That store is now an in-memory copy of the account rather than a persisted one:
an action updates it immediately and queues the write, so the screen never waits
for the network. **Components never touch storage directly**, which is why the
move to Supabase changed none of them.

---

## 3. Routes

```
/                 → redirect to /today
/today            The day. Only tasks whose planned_date is today.
/tasks            All Tasks. Every open task, grouped
                  overdue / today / tomorrow / upcoming / no date.
/settings         Backup & restore. Manual, local, all-or-nothing.
/projects         The list. Active projects, with an archive drawer.
/projects/[id]    One project: description, long-form notes, and its tasks
                  grouped overdue / today / later / no date.
/schedule         A daily visual planner, not a calendar. Sidebar of the day's
                  planned tasks beside a vertical rail; three independent
                  layers over one minute axis.
```

Today and All Tasks share every task component — the same inline rename, the
same `TaskMenu`, the same metadata — so the two surfaces cannot drift apart.
They live in `components/task/`; the two views only decide layout.

Nav is a row of soft pills above the column; the active one is a raised white
surface and nothing more.

---

## 4. Directory layout

```
src/
  app/
    layout.tsx            fonts, lang="he" dir="rtl"
    page.tsx              redirect → /today
    today/page.tsx        server shell, renders <TodayView/>
    schedule|tasks|projects/page.tsx   server shells for their views
    projects/[id]/page.tsx one project
    settings/page.tsx     backup & restore
    globals.css           @theme tokens, elevations, motion
  components/
    shell/                AppShell (wide variant for Schedule), NavTabs
                          (UnbuiltPage is a leftover — no longer imported)
    task/                 shared by both views: EditableText, TaskMenu, meta
    today/                TodayView + its cards, composers, notes, wrap-up
    tasks/                AllTasksView, TaskRow, FilterBar
    projects/             ProjectsView, ProjectView, colour, notes
    schedule/             ScheduleView, Timeline, RailBlock, sidebar, hours
    settings/             BackupPanel
    ui/                   Checkbox, Popover, Section — dumb primitives
  lib/
    types.ts              domain types — the contract with the DB
    copy.ts               every user-facing string, Hebrew
    date.ts               day keys ('YYYY-MM-DD'), he locale formatting
    schedule.ts           pure minute/pixel maths, intervals, lanes, capacity
    palette.ts            project accent classes — plain data, no cycles
    cn.ts
    mock/seed.ts          realistic mock day, generated against today's date
    store/day-store.ts    in-memory account state; each action queues its write
    supabase/             clients, repository, mappers, ids, write queue, loader
    migration/            the one-time localStorage import
```

### The seam

```
  read   components ◀── useDayStore() ◀── account.ts ◀── repository ◀── Supabase
  write  action ──▶ set() ──▶ write-queue ──▶ repository ──▶ Supabase
                    (instant)  (FIFO, session-bound, one in flight)
```

Every mutation was already shaped like a row update (`{ id, patch }`), and every
ordering operation already wrote a fractional `order` — the same value the
`sort_order double precision` column expects. That is why the swap touched no
component: the seam held.

The queue is **not** a sync engine. One request in flight, strict FIFO, one
retry, and every job carries the user id it was queued for — re-checked against
the live session immediately before it is sent, so a write can never land in an
account other than the one that made it. There is no debounce, no offline
buffer and no realtime.

### One definition of "persistent"

`PersistedSlice` + `persistedSlice()` in the store remain the single answer to
"what is this app's data". The backup export, the restore payload and the
one-time import all read through it, so a field added to the store cannot end up
saved but missing from backups — the definitions cannot drift.

Restore validates first and then applies in **one** `set()`, so the store never
observes a half-restored day. Older backups are upgraded through the same
`migratePersisted` chain the store uses; newer ones are refused rather than
guessed at.

---

## 5. Visual language — clean futuristic soft

Cool, light, airy, restrained colour. Explicitly **not** paper, not editorial,
not a corporate dashboard. There is no texture, no warm hue, no gradient, no
glass, and no simulated A4. The day stays bounded because the column is
bounded, not because it imitates a physical page.

| Token | Value | |
| --- | --- | --- |
| canvas | `#F5F7FA` | page |
| surface | `#FFFFFF` | cards |
| text / text-2 / text-3 | `#1F2937` / `#6B7280` / `#9CA3AF` | |
| line / line-soft | `#E5E7EB` / `#EEF1F6` | hairlines only |
| blue / purple / teal / green | `#3B82F6` / `#8B5CF6` / `#14B8A6` / `#22C55E` | accent, never fill |

Type is **Rubik** for headings and Big-task titles, **Assistant** for
everything else — chosen over Inter/Manrope because both carry Hebrew *and*
Latin from the same hand, so a Hebrew task with a `9:30` on it doesn't look
spliced. No italics anywhere.

**Visual hierarchy** is carried by four things at once, not just font size:
block size, surrounding whitespace, elevation, and whether the row is a card at
all.

```
BIG      white card · 1 per row · 28px/600 Rubik · 28px padding · blue-lit shadow
MEDIUM   white card · 2 per row · 16px/500 · hairline border · almost flat
ROUTINE  bare row   · 2 columns · 14px · round teal checkbox + repeat glyph
SMALL    bare row   · 2 columns · 14px · no card, project shown as a dot only
```

Sections are separated by **whitespace and a coloured dot**, never by a rule
across the width — a long horizontal line is the single strongest cue that you
are looking at a printed document.

**Completion** is opacity plus a green fill in the checkbox plus a thin
strikethrough. Satisfying, not loud.

**Inline entry, never a modal.** Each section ends in a ghost line
(`+ כתוב משימה גדולה…`). Clicking it turns the line into a bare, borderless
input with the section's own typography — you write at the place the thing will
live. `Enter` commits and keeps the line open for the next one; `Esc` or an
empty blur closes it.

### The Schedule is three layers, not a calendar

The rail is one minute axis with three **independent** interval sets drawn over
it, none of which joins to another:

```
work_windows   background tint · availability      z 0
time_blocks    meetings, lunch, travel             z 10
tasks/routines the blocks you tick off             z 20
current time   only when the selected day is today z 40
```

That layering is what kept the task model untouched: adding availability and
blocked time required **zero changes to `tasks`**.

- **Geometry lives in `lib/schedule.ts`**, not in components — minutes⇄pixels,
  interval merging/inversion, lane packing for overlaps, and the capacity sums.
  It is pure, so the maths can be corrected without touching the UI.
- **Lines every 30 minutes, snapping every 15.** The visual grid and the
  interaction grid are deliberately different resolutions.
- **A block is drawn a few pixels shorter than its span.** Two blocks that
  touch — one ending exactly where the next begins — would otherwise share an
  edge and read as a single shape. The sliver comes off the *bottom*, so a
  block still starts level with its own minute and the grid line. Visual only:
  `blockHeight()` in `lib/schedule.ts`, no stored time touched, and every kind
  on the rail goes through it, so task, routine and blocked time all separate
  the same way.
- **A new block's length is a creation default only** (30 min for a small task,
  60 otherwise). Nothing is written to the task: it still has no duration, and
  a block's length is always `end - start`.
- **Resizing is raw pointer events, not dnd-kit.** It only needs a vertical
  delta, and keeping it separate stops it fighting the drag context that moves
  the block.
- **Conflicts warn, never block.** A task dropped outside work hours or across a
  meeting still lands; it just carries a small amber mark.

### RTL is the layout, not a coat of paint

`<html lang="he" dir="rtl">`, and every directional style is logical rather
than physical: `ms/me`, `ps/pe`, `start/end`, `text-start`. Consequences worth
knowing:

- Drag handles sit in the **inline-start** margin, which is the right in
  Hebrew. `AppShell` carries `px-7` on phones purely so that gutter exists.
- Card accent strips use `start-0`, so they run down the right edge.
- Sticky-note `x` is stored as a fraction **from the inline-start edge**, so a
  drag to the left *increases* it; `NotesArea` flips the delta by direction and
  the note clamps its own position at render as well as on drop.
- Times and ranges (`9:30–11:00`) are wrapped in `.ltr-run`
  (`direction: ltr; unicode-bidi: isolate`) so bidi can't reorder them.
- Every string lives in `lib/copy.ts`. Swapping that file is what a second
  language would need — nothing is hardcoded in a component.

**Cross-section drag = size change.** dnd-kit runs one `DndContext` over the
three task sections. Dragging a card from Medium into Big rewrites
`task.size = 'big'` — which is exactly what "size is persistent" means. Live
preview happens in `onDragOver`, commit in `onDragEnd`.

**Notes are a separate `DndContext`** with free x/y translation clamped to the
notes area, so sticky notes never interact with task sortables. `rotation` is
still on the model but is no longer expressed — a tilted note reads as paper.

**Wrap Up Day** is a deliberate end-of-day flow: it lists what is still open and
asks for a decision per task (tomorrow / archive / leave it). It is the *only*
thing that moves work between days in bulk, and the user drives every choice.

---

## 6. Status

| Scope | Status |
| --- | --- |
| Today page: full interaction, notes, wrap-up | **done** |
| Visual language: clean futuristic soft, Hebrew + RTL | **done** |
| All Tasks: `planned_date` / `due_date`, backlog, filters | **done** |
| Projects: colour, description, notes, archive, project page | **done** |
| Schedule: hour rail, availability, blocked time, capacity | **done** |
| Local backup & restore (Settings) | **done** |
| Routine recurrence engine | **done** |
| Recurring weekly work hours | **remaining** |
| Supabase: schema, RLS, auth | **done, verified end to end** |
| Supabase persistence + real-data migration | **done, verified end to end** |

Schedule was built after All Tasks deliberately: without a backlog, any task not
assigned to today effectively disappeared, which made planning impossible and
made a calendar premature.

Auth and Supabase were deliberately built last: doing them earlier would have
frozen UX decisions that were still moving, and would have meant migrating a
data model that had not settled.

### Settled decisions

**Routines are schedulable.** They consume real time, so they drop onto the
hour rail alongside tasks and get a block of their own: `routine_logs` carries
`scheduled_start_min` / `scheduled_end_min`, the same pair a task uses, and the
rail iterates the two shapes over one minute axis. A routine block stays
*visually distinguishable*: same block geometry as a task, plus the quiet
repeat glyph the Today page already uses on routine lines. Subtle, not a
second colour scheme.

**One time block per task, for now.** Confirmed as an MVP constraint rather
than an oversight: `scheduled_start_min` stays a field on the row and there is
no `schedule_blocks` child table. Split scheduling waits for evidence that it
is actually needed — see decision 6 in `SCHEMA.md` for what that migration
would cost.
