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
| **Goal** | Up to 5 per project: a short named direction, ordered, plus at most one optional KPI (below). No status, no due date, no progress beyond that one KPI. Once a project has goals, the annual view shows one row per goal instead of one row for the project. | `project_goals` |
| **Goal KPI** | One optional measurable indicator per goal: a fixed *definition* (label, numeric target, optional unit, optional free-text `targetLabel` for display) plus a separate *value* recorded per real calendar month. No history beyond those monthly values, no formula, no second KPI. The resolved target sentence (`targetLabel`, or a plain fallback from the number + unit) shows as a wrapping secondary line under the goal's name in the annual matrix — gold on the "יעד:" label only, ordinary secondary text for the target itself — and as plain text on the Project screen; each month's value shows as a small centred gold chip at the top of that month's cell in the annual matrix and month panel. | definition: columns on `project_goals`; values: `goal_monthly_kpi` |
| **Note** | Sticky note on the day. **Never** a task, never in All Tasks. | `notes` |
| **Schedule block** | A task (or routine) dragged onto the hour rail. It stays on Today and gains a time. | fields on the row |
| **Blocked time** | Meetings, lunch, travel. Occupies time but is not work you tick off — no status, no project, no size. | `time_blocks` |
| **Work window** | When you are available. No title; a day with none has simply not been told yet. | `work_windows` |
| **Monthly focus** | Up to 3 short strings for one project (or one goal) in one month. A planning surface, not a task list — nothing is generated from it and nothing reads it but the annual view. | `monthly_focus` / `goal_monthly_focus` |

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
/year             The annual map. A rolling 12-month window × projects × up to
                  three focus items. Not tasks: nothing is generated from it
                  and nothing else reads it. Only projects that have goals
                  appear: each becomes a group label plus one row per goal.
                  See §1 and the Goals note below §4.
```

`/year` is one route holding two surfaces. The matrix is for seeing the
window, the month panel for writing one month of it, and which you get is
decided in CSS by viewport rather than by stored state — so there is no
hydration-time viewport guess. The window and the open month are plain
component state, not URL segments: every route here is dynamic, so routing a
month change would spend a server round trip on something already in memory.
That is the same trade the Schedule makes for its day, and it costs the same
thing — a month is not linkable, and the browser's back button leaves the page
instead of closing the panel, which is why the way back is drawn on screen
rather than implied.

**The 12 visible months are a rolling window, not a fixed calendar year.**
Before, the matrix always showed January–December of one year, which meant
opening the view in November or December left almost nothing to plan forward
into without switching years entirely. Now the window is anchored on whichever
month is first, and shifts by one month at a time in either direction, so it
can straddle a year boundary at any point, not just at its ends.

The default anchor is 2 months back from the current month, not the current
month itself — the window is [current − 2 … current + 9]. A version that put
the current month first was tried and shipped briefly; it read as forward-only
planning with nothing behind it, and a goal you're mid-way through in, say,
November needs September and October in view to make sense of, not just nine
months of runway ahead. Two months of trailing context was enough to place a
goal in progress without giving up most of the view's actual job, which is
still looking ahead — 9 of the 12 months still are. "היום" resets to this same
anchor, not to a current-month-first window; `YearHeader`'s `isCurrent` prop
means "at the default anchor," which is why it's computed against
`defaultWindowStart` rather than against today's own month. The header shows the visible range instead of a bare year — `shortMonthName`
for each end plus both years when they differ, one year when the window
happens to land on a single calendar one — and each month column carries its
own (year, month) pair rather than assuming a shared year, so a KPI/focus cell
is always read from its actual calendar month regardless of where in the
window it happens to sit.

**The matrix is sized to be read, not to fit.** A month column is 160px and
twelve of them do not fit on any real desktop — that is the point. The first
version picked 86px precisely so all twelve *would* fit, and paid for it in
the thing the screen exists for: focus items broke across three or four lines,
KPI units truncated, and the year read as a block of fragments. Seeing twelve
months at once was never the goal; nobody plans a whole year in one glance,
they read a stretch of it. So 160px is chosen from the viewport backwards —
the 1520px shell minus the 176px project column is 8.4 columns, and a 1440px
laptop gets 7.6 — and the rest of the year is a sideways scroll away. The
width lives in exactly one place, the table's `min-w-[2096px]` (176 + 12×160);
`table-fixed` derives the columns from it, so there is no per-column width
class to fall out of step. The scrollbar itself is hidden (`.no-scrollbar` in
`globals.css` — three declarations, since Firefox, WebKit and legacy Edge each
need a different one), which hides only the bar: wheel, trackpad, touch and
keyboard scrolling are untouched. That is safe *here* specifically because the
scroll is signposted twice over by the header's month arrows and by columns
running off the edge.

**The current month is marked as a *column*, not as a set of cells.** It
carries the `blue-soft` tint it always had, plus a 1px `blue/40` outline — the
same hue as its own header title, so the tint, the title and the line read as
one thing. The mechanism matters because the table is `border-separate`: every
cell in the column contributes only its two *side* edges, the `<thead>` cell
adds the single top, and the table's final row adds the single bottom, which
is what makes one continuous frame instead of twelve stacked boxes each with
its own horizontal rules. The project-header bands have to carry the side
edges too — they keep their own grey fill, since a band is a divider between
projects rather than part of any month, but a column that stopped at every
header and restarted below it would be several outlines, not one. `blue/40`
rather than full-strength `blue`, and no shadow or stronger fill: at full
strength a hairline running the height of the table competes with the KPI
chips and focus cards inside the very column it is framing. `table-fixed`
means the added borders cost the column nothing in width — measured identical
in every row, framed or not.

**The window and the month panel's open month are deliberately two
independent pieces of state, not one shared "year" as before.** When the whole
matrix was a fixed year, both surfaces reading the same `year` was harmless —
it was the only context either one had. Once the window can span two calendar
years, keeping them coupled would mean shifting the window by a single month
could silently relocate whichever month the panel had open by a whole year.
So the header's prev/next shift `windowStart` by a month, the month panel's
own prev/next step its own open `(year, month)` by a month (still rolling the
year over at Dec/Jan, exactly as before), and neither one moves the other. See
the comments on `windowStart` in `year-view.tsx` and on `YearHeader` itself.

Today and All Tasks share every task component — the same inline rename, the
same `TaskMenu`, the same metadata — so the two surfaces cannot drift apart.
They live in `components/task/`; the two views only decide layout.

**Task notes live in the existing `detail` column — no new field.** It was
already persisted end to end (DB, mappers, backup/restore, All Tasks search)
but only surfaced as a one-line subtitle on Big. Adding a separate `notes`
column would have put two near-identical free-text fields on one card, so
`detail` was widened instead: multi-line (Shift+Enter breaks a line, Enter
still commits, as everywhere else), on Big *and* Medium, clamped at rest to 3
and 2 lines respectively, with the full text shown on click. All Tasks and
the project page (both `TaskRow`) don't print notes at all — a long list
would stop being a list — and instead give Big/Medium rows a note button that
opens them under that one task; the button stays visible when a note exists.
Small has no notes field anywhere, but a resized task keeps its notes.
`EditableText`'s `multiline` mode is also what lets a note be *cleared*: a
single-line field ignores an empty commit (a title can't be empty), which
had quietly made the old subtitle impossible to delete.

`TaskMenu`'s project picker offers `activeProjects(...)` only — an archived
project is somewhere a task's history can point, not somewhere a new
assignment should go. The one exception is the task's *own current* project,
appended even if it has since been archived, labeled with a `(בארכיון)` suffix
so the chip still reads as a fact about this task rather than a live choice.
Without it, opening the menu on such a task would either drop that project
from view entirely (making the assignment unreadable in the one place it's
edited) or reassign it the moment anyone touched the menu — silently losing
data the task actually has. The chip is computed from the task's live
`projectId`, not cached, so reassigning away from the archived project simply
drops the chip on the next render, same as any other field.

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
    projects/             ProjectsView, ProjectView, colour, notes,
                          ProjectGoals, LegacyProjectFocus
    schedule/             ScheduleView, Timeline, RailBlock, sidebar, hours
    year/                 YearView, AnnualMatrix, MonthFocus, FocusEditor,
                          YearHeader
    settings/             BackupPanel, ImportPanel
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

### Project goals: two annual-view modes, decided live

Whether a project appears in `AnnualMatrix` at all is never a stored flag — it
is computed on every render from whether `project_goals` has any rows for that
project (`goalsForProject(...).length`). `rowsFor()` builds the whole table's
rows as one flat list up front: a project with goals expands to a header row
plus one row per goal, and **a project with no goals contributes nothing at
all.** Building the list up front is also what lets "is this the table's true
last row" be answered by array index instead of by walking a nested
project → maybe-goals structure.

The empty project used to get a plain row of its own. It was dropped because
of what it cost per project: a name, twelve empty cells and a row of
hairlines, all saying "nothing is planned here" on the screen whose whole job
is showing what *is*. Skipping happens before the header is pushed, so an
empty group band or a stray separator is not something to clean up afterwards
— it is unrepresentable. When *no* project has a goal the matrix renders its
own empty state (`copy.year.noGoalProjects`) rather than a bare header over
nothing; it is deliberately not the `noProjects` message, since "create a
project" is the wrong next step for someone who has five.

This is presentation only. `MonthFocus` still renders a `FocusCard` with a
full editor for every goal-less project, so a project's own monthly focus
items stay visible and editable on the surface that owns them — the filter
removes a row from one view, never a way to reach the data. `AnnualMatrix`
consequently no longer takes the project-level `focus` array at all: the
goal-less row was its only reader.

Existing `monthly_focus` rows are never migrated when a project's first goal
is created. They stop appearing in the annual view (which now only asks each
project's goals for content) and become visible again only in
`LegacyProjectFocus`, on the project's own screen — where the only actions are
an explicit move to a chosen goal (`moveMonthlyFocusToGoal`, which refuses
outright rather than merging if the destination already has content) or an
explicit delete. Nothing does this automatically.

### A goal's KPI: a fixed definition, and one value per month

A KPI is two things that live in two different places, and conflating them
was the first version's mistake (see decision 10 in `docs/SCHEMA.md`):

- **The definition** — label, numeric target, optional unit, optional
  free-text `targetLabel` — is a fact about the goal, fixed until someone
  edits it. `target` is the only number anything measures against or ever
  calculates from; `targetLabel` is a separate sentence for display, typed
  once and never parsed back into a number (see decision 11 in
  `docs/SCHEMA.md`) — "12,000 איש ברשימת תפוצה" says more than "12000" ever
  could, and there is no reliable way to derive one from the other.
  `kpiTargetText(kpi)` resolves which to show: `targetLabel` if present,
  otherwise a plain fallback built from `target` + `unit`. In
  `AnnualMatrix`'s frozen column, that resolved text shows as a second,
  smaller line under the goal's own name (e.g. "יעד: 12,000 איש ברשימת
  תפוצה") — never the metric name, only the target. The gold is carried by
  the label alone: `copy.year.kpiGoalLabel` ("יעד:") renders in
  `text-gold-deep` `font-medium`, and the target itself in plain
  `text-text-2`. `gold-deep` rather than the chip's full-strength
  `text-gold` even for two words, since the base `--color-gold` fails text
  contrast on white outright (~2.6:1) — fine for a hover border, not for
  type. The split is the point though: gold names the category and the
  target stays easy to read, which is also what allows 11.5px here without
  competing with the 13px goal name. It wraps rather than truncating: a target
  sentence is meant to be read in full, not hinted at behind an ellipsis,
  and `table-fixed` on the matrix already guarantees the column can't be
  forced wider by it — only taller. The Project screen, where the goal
  itself is edited, shows the same resolved text as plain (non-gold) text
  instead — gold there would have nothing to relate to, since no monthly
  chip appears on that screen.
- **Each month's value** is a fact about that month, recorded separately
  (`GoalMonthlyKpi`). It appears in exactly two places: as a small, centred,
  shrink-wrapped chip at the top of that goal's cell for that month in
  `AnnualMatrix` (`self-center` so the parent's `items-stretch` can't widen
  it to match the white focus-item cards below it — the whole point is that
  it reads as a compact chip, not another card the same shape as a focus
  step — above any focus-item blocks in the same cell: the hierarchy is
  Project → Goal → the target under its name → that month's KPI value →
  that month's focus steps). On a goal that has a KPI *definition* the slot
  is reserved in all twelve cells whether or not that month was measured —
  an unmeasured month renders the identical chip with `invisible`, so the
  reserved height is the real chip's height by construction rather than a
  `min-h` guess that drifts the next time its padding changes, and
  `visibility: hidden` keeps the placeholder out of the accessibility tree
  as well as off the screen. Without the reservation a single measured month
  pushed its own focus cards down while its neighbours' stayed put, and a
  row read as ragged rather than as a series. A row whose goal has no KPI
  definition reserves nothing: there is no chip anywhere in it to align to.
  The value also appears as one lightweight editable field above the
  focus editor in `MonthFocus`, for whichever month is open. The matrix chip
  and the goal-column definition line render through the same
  `GoalKpiValueBadge` component and `--color-gold` family respectively, so
  the "subtle gold, calm not shouty" treatment can only ever drift in one
  place.

Deliberately no percentage and no progress bar anywhere in the matrix — the
month-by-month raw numbers, read left to right, are the entire point of
showing a KPI in an *annual* view; a percentage or bar per cell would compete
with that for attention rather than support it. The target appears exactly
once, in the goal-column definition line — never repeated inside a month
cell. Reusing the app's existing `--color-gold` family (the Big task card's
own accent) for both the value chip and the definition line was a
deliberate, non-obvious call, and the family needed one new member
(`--color-gold-deep`) once a piece of it had to hold text rather than serve
as an accent — and then needed to be confined to the two-character label
rather than the whole sentence, because a warm yellow-brown stays a category
marker even at AA contrast. See the trap about both in `PROJECT_STATE.md`.

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
| Annual view (`/year`, `monthly_focus`) | **done, applied** |
| Project goals (`project_goals`, `goal_monthly_focus`) | **done, applied** |
| Goal KPI (definition on the goal, monthly values in `goal_monthly_kpi`) | code done; `0014`–`0018` not yet applied |

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
