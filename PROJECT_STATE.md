# Project state

Handoff document. Read this first; it links to the detail rather than repeating
it. Companion docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (structure,
visual language, RTL), [`docs/SCHEMA.md`](docs/SCHEMA.md) (data decisions and
why), [`README.md`](README.md) (feature list, how to run).

---

## 1. What this is

A personal daily planner: **one day, one bounded column** — deliberately not an
endless task list. Hebrew-first, RTL throughout, single-user accounts
backed by Supabase.

Stack: Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript · Tailwind
v4 · zustand (in-memory) · Supabase (Postgres + RLS + auth) · dnd-kit ·
date-fns · lucide-react.

```bash
npm run dev
```

`npm run typecheck`, `npx eslint .`, `npm run build`. All three are currently
clean; keep them that way.

> The folder is named `paper-today` and the SQL calls the app `paper-today`.
> That is a leftover from the first design round, which imitated a sheet of A4.
> **That metaphor was deliberately abandoned** — do not reintroduce paper
> texture, warm colours, serif type or a simulated page.

---

## 2. Status

| Scope | State |
| --- | --- |
| Today page | done |
| Visual language: clean futuristic soft, Hebrew + RTL | done |
| All Tasks, `plannedDate` / `dueDate`, backlog, filters | done |
| Projects: colour, description, notes, archive, project page | done |
| Schedule: rail, availability, blocked time, capacity | done |
| Local backup & restore (Settings) | done |
| Routines: create/edit, recurrence, fixed time, daily override, archive | done |
| **Recurring weekly work hours** (Schedule availability defaults) | remaining |
| Supabase client wiring (`@supabase/ssr`, browser + server) | done |
| Supabase schema + RLS (`0001`–`0011`) | applied |
| Email/password auth (signup, sign-in, sign-out, reset) | done, verified end to end |
| **Supabase persistence** (repository, write queue, account loader) | done, verified end to end |
| **Data migration: localStorage → Supabase** | done, real data migrated and verified |
| **Annual view** (`/year`, `monthly_focus`) | done, applied |
| **Project goals** (up to 5 per project, `project_goals` + `goal_monthly_focus`) | done, applied |
| **Goal KPI** (definition on the goal, one value per goal per month) | code done; **`0014`–`0018` not yet applied, `0012`/`0013` superseded** |

Routes: `/today` · `/schedule` · `/tasks` · `/projects` · `/projects/[id]` ·
`/year` · `/settings`, all behind auth · `/login` · `/signup` ·
`/forgot-password` · `/reset-password` · `/auth/callback` · `/auth/confirm`.
`/` sends you to `/today` when signed in and `/login` when not.

**Goal KPI was redesigned before `0012`/`0013` necessarily ever shipped.**
The first version put one overwritable `kpi_current` column on the goal —
wrong, because a KPI needs to show progress *across months*. `0014`–`0016`
replace that with a `goal_monthly_kpi` table (one value per goal per real
calendar month) and narrow `project_goals` back down to just the definition
(`kpi_label`/`kpi_target`/`kpi_unit`). **Whether `0012`/`0013` were ever
applied to the live database is unconfirmed** — `0015` handles both cases
safely: if `kpi_current` has real data, it's backfilled into
`goal_monthly_kpi` (dated to whichever month the migration happens to run
in) before the column is dropped; if the column was never applied at all,
apply `0009`–`0011` and `0014`–`0018` in order and skip `0012`/`0013`
entirely — 0009-0011 grant no benefit from 0012/0013. `0017` then adds
`target_label`, a separate free-text display form of the target (see below).
**Whichever path applies, the current code (`loadAll()`'s `project_goals`
select asks for `kpi_label`/`kpi_target`/`kpi_unit`/`target_label`, no
`kpi_current`, plus a `goal_monthly_kpi` select) only works once the
database matches `0018`'s end state** — the same all-or-nothing failure mode
every prior migration batch in this project has had before being applied.

**Supabase is the source of truth.** Every row lives in Postgres, scoped to one
`auth.users` id and fenced by RLS. Zustand is still the store the components
read, but it is now an in-memory copy of the account, filled by
`lib/supabase/account.ts` on load and kept in step by explicit writes. **The app
no longer persists domain data to `localStorage` at all** — see §12 for the one
key that remains, deliberately. No secret/service-role key exists anywhere in
the project.

The per-browser limitation that used to live here is **gone**: data is per
*user* now, so signing in as someone else on the same machine shows their
account and nothing of yours.

**Auth is verified end to end**, against the live project with two real
accounts: signup → email confirmation → profile row → sign-in → sign-out →
sign-in → forgot → reset → old password rejected. Cross-account isolation was
tested by having one account attempt to read, update, delete and foreign-key
its way into the other's rows by exact UUID; every attempt returned zero rows
or a `23503` violation.

**Persistence is verified end to end** against the live project: writes to all
eight tables, FK-ordered writes (`addProject` then a task referencing it),
updates, deletes, reload-from-server, sign-out clearing memory, a second
account seeing zero rows, and — the one that shaped the design — six writes
queued and the account switched mid-flight, after which the in-flight write
landed under *its own* account, five were cancelled and reported, and **none
leaked into the other account**.

**The real migration is done and verified.** 206 tasks, 5 projects, 7 routines,
5 routine logs, 2 time blocks, 17 work windows, 3 notes, 2 day logs and the
motto were imported and then checked *by id*, not by count: every
pre-migration row was re-derived through UUIDv5 and looked up in the account.
All 41 project-linked tasks still resolve, no routine log is orphaned, and both
archived-but-completed tasks kept their completion timestamps — the exact case
`0004` was widened for.

Eleven migrations are applied and frozen — `0001_init` through
`0011_restore_backup_goals`; see [`docs/SCHEMA.md`](docs/SCHEMA.md) for the
full table. Every change from here is a new numbered migration.
**`0003` exists because `0001` enabled RLS but never granted table
privileges**: RLS decides which rows a role sees, `GRANT` decides whether it
may touch the table at all, and without both a fully authenticated user gets
`42501 permission denied`. **`0004` exists because `0001` encoded a rule the
domain does not have** — it required `completed_at` to be present exactly when
`status = 'done'`, which would have rejected a task that was completed and
later archived, forcing a choice between discarding a real timestamp and not
migrating the task. See [`docs/SCHEMA.md`](docs/SCHEMA.md), which also covers
the ownership model: every row belongs to one `auth.users` id, cross-user
references are blocked by composite foreign keys, and RLS is enforced by the
database rather than by any query the app writes.

---

## 3. Product rules that must not break

These have been reaffirmed repeatedly. Breaking one is a bug, not a tradeoff.

1. **Nothing rolls over automatically.** `plannedDate` changes only by explicit
   user action (move to today/tomorrow, pick a date, Wrap Up Day). No cron, no
   carry-forward.
2. **Overdue work must stay visible.** Because of rule 1, an unfinished task
   from a past day would vanish — the `באיחור` group in All Tasks is the only
   thing preventing that. It is derived, never stored.
3. **Notes are structurally not tasks.** No size, no status, no project, no FK.
   They never appear in All Tasks or Projects.
4. **A task has no duration.** There is no estimate field. A schedule block is
   `scheduledStartMin` + `scheduledEndMin`; its length is derived, never stored.
   New-block defaults (30 min small, 60 otherwise) are creation-time only.
5. **One schedule block per task.** No split scheduling.
6. **Blocked time is not a task.** Title + start + end only.
7. **Conflicts warn, never block.** A task dropped outside work hours or across
   a meeting still lands; it gets a small amber mark.
8. **Project colour is an accent only.** A dot, a bar, a hairline — never a
   filled background.
9. **A routine occurrence is never a task row.** The template lives in
   `routines`, the per-day fact in `routineLogs`. `weekdays` *is* the
   recurrence; there is no separate mode field. A routine's time resolves as
   *this date's override → the template's fixed time → unscheduled*, and that
   is the entire exception model.

---

## 4. Data model

Full reasoning in [`docs/SCHEMA.md`](docs/SCHEMA.md). The essentials:

- `plannedDate` (nullable) = *when I mean to work on it*; `null` is the backlog.
  Only `plannedDate === today` renders on Today.
- `dueDate` = the deadline. Optional, and deliberately **unconstrained** against
  `plannedDate` — being late or early are both legitimate.
- A project is archived by `archivedAt` alone (`null` = active). There is no
  separate `status` field; two columns describing one fact can disagree.
- Work windows are merged **on read**, never on write. See §8.

State lives in Supabase. `src/lib/store/day-store.ts` holds the in-memory copy
of the signed-in account and no longer persists anything to the browser; each
action updates state and queues its write through `lib/supabase/write-queue.ts`.

- **`MonthlyFocus` is not a task.** Up to three ordered short strings for one
  project in one month, with no status, completion, date or progress of any
  kind, and nothing is ever generated from it. Its natural key is
  `(projectId, year, month)` and it carries **no `id`** — the same shape as
  `DayLog`. `items` is never empty: emptying a cell deletes the row.
- **A project can have up to `MAX_GOALS` (5) `ProjectGoal`s.** A goal is a
  short named direction inside a project — title, explicit integer `order`,
  and at most one optional `GoalKpi` (see below). No status, progress-beyond-
  the-KPI, or due date. Monthly focus then belongs either to the project
  directly (`MonthlyFocus`, no goals yet) or to one of its goals
  (`GoalMonthlyFocus`, once any exist) — never both for the same project at
  the same time in the UI, though old project-level rows are deliberately left
  in place when goals are added (see the trap below). The **annual matrix
  shows only projects that have goals**; a goal-less project is filtered out
  of it entirely (no row, no group header, no separator) and keeps its own
  focus editor in the month panel, which is where its `MonthlyFocus` items
  stay visible and editable. Presentation only — the Projects screen and
  everything else are unaffected. `GoalMonthlyFocus` is
  structurally identical to `MonthlyFocus`, keyed by `(goalId, year, month)`
  instead of `(projectId, year, month)`. Goal `order` is a plain 0-based
  integer, **not** the fractional `sort_order` pattern used elsewhere in this
  file — an explicit user preference, since goals reorder as a short,
  rarely-changed list rather than a drag target; `reorderGoals` rewrites every
  affected row's order, the same shape as `reorderRoutines`.
- **A goal's `kpi: GoalKpi | null` is a *definition* only — `label`,
  `target`, optional `unit`, optional `targetLabel`.** `null`, not an
  optional key, matching `archivedAt`'s convention. `label`/`target` travel
  together — a goal has no KPI at all or a complete definition, enforced by
  `project_goals_kpi_consistent` (`0012`, narrowed by `0015`) and mirrored
  client-side in `setGoalKpi`. Lives as columns on `project_goals` itself,
  **not** a sibling table — a definition has no uniqueness concern to force
  one. See decision 9 in [`docs/SCHEMA.md`](docs/SCHEMA.md).
- **`targetLabel` (`0017`) is a separate, optional, free-text *sentence* for
  display — "12,000 איש ברשימת תפוצה," "Readiness 80," "3 אימונים בשבוע."**
  `target` stays the only number anything measures against or ever
  calculates from; `targetLabel` is never parsed back into one — the two
  fields serve different jobs (measurement vs. display) and neither can
  substitute for the other. `kpiTargetText(kpi)` (in `types.ts`) resolves
  which one to show: `targetLabel` if present, otherwise a plain fallback
  built from `target` + `unit`. Both the annual matrix's goal-column line
  and the Project screen's own summary call this same function, so the two
  screens can never show two different resolutions of the same goal's
  target. No CHECK ties `targetLabel` to `label`/`target` being present,
  matching `kpi_unit`'s own looseness (see decision 11 in `docs/SCHEMA.md`).
- **A KPI's actual *value* is `GoalMonthlyKpi`, one per goal per real
  calendar month — not a field on the goal.** The first cut of this feature
  put a single overwritable `kpi_current` on the goal; that was a genuine
  design mistake (see decision 10 in `docs/SCHEMA.md`), since a KPI exists to
  show progress *across* months and one column can only ever hold the
  latest number. `GoalMonthlyKpi` is structurally the `GoalMonthlyFocus`
  sibling this always should have been: keyed by `(goalId, year, month)`, no
  `id` in the domain type, no row for a month with no measurement — and a
  real `0` is a legitimate value, kept exactly like any other. `setGoalMonthlyKpi`
  mirrors `setGoalMonthlyFocus`'s "set the whole cell, every time" contract.
  Clearing a goal's KPI *definition* (`setGoalKpi(id, null)`) deliberately
  does **not** delete its recorded values — they simply stop being shown
  until a definition exists again, the same "never silently discard data"
  principle the Goals feature's legacy-focus handling already established.
  The annual matrix shows the raw value + unit as a small centred chip
  (`self-center`, shrink-wrapped — not stretched to the white focus cards'
  width, so it reads as a compact chip rather than another card) at the top
  of each month's cell — in a slot every cell of a KPI-carrying row reserves,
  measured or not, the empty case being the same chip rendered `invisible`,
  so focus cards start on one line right across the row. It shows the
  resolved target sentence (`kpiTargetText`)
  as a wrapping secondary line under the goal's own name in the frozen
  column. Both relate to the app's existing `--color-gold` family (see the
  trap below on why reusing it is safe), but carry it very differently: the
  chip is full-strength `text-gold` throughout, while on the definition line
  **only the label `יעד:` is gold** (`text-gold-deep`, `font-medium`) and
  the target text itself is ordinary `text-text-2` at 11.5px. Gold there
  marks the *category* — "this is the KPI family" — and stops; colouring the
  whole sentence gold was tried first and read as weak, because the one
  thing you want to read at a glance ended up in the least legible colour on
  the row. Splitting it is also what let the line grow from 10.5px to
  11.5px: size now separates it from the 13px goal title, so colour no
  longer has to. No percentage, no metric name, no bar inside a month cell
  itself — the target only ever appears once, under the goal's name, and
  wraps rather than truncating: a target sentence is meant to be read in
  full. The Project screen shows the same resolved text too, as plain
  (non-gold) text — gold is reserved for the annual view, where it sits
  beside the monthly chip it relates to.

`STORE_VERSION = 11` still matters, but only for *legacy* envelopes: backup files
carry it, and `migratePersisted` reads both those and any browser that has not
yet run the one-time import.

**`PersistedSlice` + `persistedSlice()` are the single definition of "what this
app's data is".** The backup export, the restore payload and the import all read
through it, so they cannot drift. Add a field there when you add stored state —
and add its `write()` call in the action that changes it.

**Any field rename needs a version bump and a step in `migratePersisted`.** The
user has real data in their own browser; a rename without a migration destroys
it. Existing steps: v1→v2 (`day`→`plannedDate`, `durationMin`→`scheduledEndMin`),
v2→v3 (project `description`/`notes`), v3→v4 (`timeBlocks`, `workWindows`),
v4→v5 (routine `archivedAt` + fixed times), v5→v6 (task `isImportant`),
v6→v7 (`monthlyFocus`), v7→v8 (`goals`, `goalMonthlyFocus` — both default `[]`),
v8→v9 (each goal gains `kpi`, default `null`), v9→v10 (a goal's `kpi.current`,
if a legacy envelope still has one, becomes one `goalMonthlyKpi` entry dated
to the month the browser loads it in — the same "don't discard it" backfill
`0015` does server-side, at the same granularity), v10→v11 (a goal's `kpi`
gains `targetLabel`, default `null`).

**`isImportant` is a marker, not a priority.** One boolean, default `false`,
independent of `size`, and nothing sorts, groups or filters on it. It draws a
heart: rose while open, grey once done, hollow and hover-only when unset. The
Schedule rail shows it read-only — toggling lives in Today, All Tasks and the
Schedule sidebar.

---

## 5. Design system — "clean futuristic soft"

Cool, light, airy, restrained colour. Not paper, not editorial, not a corporate
dashboard. No texture, no gradients, no glass, no dark fills.

Tokens live in `src/app/globals.css` under `@theme`:

| | |
| --- | --- |
| canvas / surface | `#f5f7fa` / `#ffffff` |
| text / text-2 / text-3 | `#1f2937` / `#6b7280` / `#9ca3af` |
| line / line-soft | `#e5e7eb` / `#eef1f6` |
| accents (12, by hue) | blue `#3b82f6` · sky `#0ea5e9` · indigo `#6366f1` · purple `#8b5cf6` · fuchsia `#d946ef` · pink `#ec4899` · rose `#f43f5e` · orange `#f97316` · lime `#84cc16` · green `#22c55e` · teal `#14b8a6` · slate `#64748b` |
| amber (warnings only) | `#f59e0b` |

**Fonts.** Assistant (body) + Rubik (headings) — chosen because Inter/Manrope
carry no Hebrew. Gveret Levin for the daily motto only. All strings live in
`src/lib/copy.ts`; nothing is hardcoded in a component.

**The Schedule brightness ladder** — availability is communicated by lightness
alone, and each rung is a visible step:

```
working hours   #ffffff   the usable part of the day
outside hours   #eef1f7   recedes                    (~1.13 from white)
blocked time    #d6dde8   + diagonal hatch           (~1.21 from off-hours)
```

**Task size hierarchy on the rail** — project supplies the hue, size supplies
the intensity (`src/lib/palette.ts`):

| | side bar | tint | title |
| --- | --- | --- | --- |
| Big | 8px | ~16 % | 16px / 600 |
| Medium | 4px | ~7 % | 13.5px / 500 |
| Small | 2px | ~2.5 % | 12.5px / 400 |

Tints are **pre-composited solids**, not alpha — an alpha fill would let the
availability shading behind it bleed through. Every row in `TASK_TINT` is its
hue mixed with white at those three percentages; when a colour is added, derive
the row rather than eyeballing it. (`green.small` is 1/255 off the formula — it
predates it, and matching the shipped pixel won.)

**`amber` stays out of the project palette.** It is the warning colour, and a
project dot wearing it would blunt the only signal the Schedule has for
"this doesn't fit".

**Back-to-back blocks are separated by a 3px seam.** `blockHeight()` draws every
rail block that much shorter than its true span, off the bottom edge, so two
touching blocks never share an edge. Purely visual — no stored time changes.

---

## 6. UX rules

- **Inline entry, never a modal.** Each section ends in a ghost line that turns
  into a bare input *in that section's own typography*. Enter commits and keeps
  the line open; Esc closes.
- **Click any text to edit it.** `EditableText` is the one implementation —
  Enter commits, Esc reverts, blur commits. Reuse it rather than writing new
  editing logic.
- **The Schedule sidebar lists what's left; the rail shows what happened.**
  Ticking an item off drops it out of the sidebar at once and into the
  `הושלמו היום (N)` drawer at the foot — collapsed by default, a bare line
  rather than a fourth section. The rail deliberately keeps its completed
  blocks. This split is presentational: it reads `status`, stores nothing, and
  applies to the Schedule sidebar only — Today, All Tasks and Projects still
  show completed work in place.
- **Dialogs only for destructive or end-of-day flows** (Wrap Up Day, restore
  confirmation). Never for entry.
- **Hover-only on desktop, always visible on touch.** Drag handles and the `⋯`
  menu use `opacity-0 group-hover:opacity-100 no-hover:opacity-100`. The
  `no-hover` custom variant is defined in `globals.css`.
- **Undo, not confirm, for reversible loss.** Move/archive/delete register a
  6-second undo toast.
- **RTL is the layout, not a coat of paint.** `<html lang="he" dir="rtl">` and
  logical properties everywhere (`ms/me`, `ps/pe`, `start/end`, `text-start`).
  Times and ranges are wrapped in `.ltr-run` so bidi can't reorder them.

---

## 7. Code map

```
src/
  app/            routes; layout.tsx holds the fonts and dir="rtl"
  components/
    shell/        AppShell (wide: Schedule + Year), NavTabs, MobileNav
    task/         shared by Today + All Tasks: EditableText, TaskMenu, meta
    today/        TodayView, cards, composers, notes, wrap-up, motto
    tasks/        AllTasksView, TaskRow, FilterBar
    projects/     ProjectsView, ProjectView, colour picker, notes,
                  ProjectGoals (up to 5 goals), LegacyProjectFocus (pre-goals
                  monthly_focus rows, surfaced for move-or-delete only)
    schedule/     ScheduleView, Timeline, RailBlock, sidebar, work hours
    year/         YearView (matrix ⇄ month), AnnualMatrix, MonthFocus, FocusEditor
    settings/     BackupPanel, ImportPanel (the one-time localStorage import)
    sync-banner.tsx  the only place an unsaved write becomes visible
    ui/           Checkbox, Popover, Section, GoalKpiValueBadge (one month's
                  KPI value — shared by AnnualMatrix and MonthFocus; the
                  Project screen shows the KPI's target as plain text instead)
  lib/
    types.ts      domain types — the contract with the DB
    copy.ts       every user-facing string (Hebrew)
    date.ts       DayKeys ('YYYY-MM-DD'), he-locale formatting, buckets
    schedule.ts   pure minute/pixel maths, intervals, lanes, capacity
    palette.ts    accent classes — plain data, no React, no import cycles
    backup.ts     export envelope + strict validation
    auth-actions.ts  "use server": sign in/up/out, reset, update password
    supabase/
      env.ts        literal process.env.NEXT_PUBLIC_* reads
      client.ts     browser client        server.ts  server client (async cookies)
      auth.ts       requireUser() / getOptionalUser()
      proxy.ts      session refresh + optimistic redirect
      ids.ts        newId() = real uuid; UUIDv5 derivation for legacy ids
      mappers.ts    row ↔ domain: snake_case, order↔sort_order, undefined→null
      repository.ts every read and write; no user_id filters — RLS does that
      write-queue.ts session-bound FIFO; one request in flight, no debounce
      account.ts    bind → clear → load, plus the auth-change listener
      payload.ts    restore/import payload builder + pre-flight validator
    migration/
      local-import.ts  the one-time localStorage → Supabase import
    store/        in-memory copy of the account; each action queues its write
    mock/seed.ts  demo data — dev and tests ONLY, never written to an account
  proxy.ts        session refresh + optimistic redirect (NOT middleware.ts)
```

---

## 8. Traps already hit — do not re-introduce

Each of these was a real bug that took real debugging.

- **A CHECK passes when its expression is NULL, and `array_length` of an empty
  array *is* NULL.** `check (array_length(items,1) between 1 and 3)` waves every
  empty array straight through. It needs `coalesce(array_length(items,1), 0)`.
  This is the same shape as the `CASE` without an `ELSE` in `0004` — the second
  time this exact hole was nearly shipped. Grammar parsing will not catch it;
  only executing it against a real server does.
- **A horizontally scrolling grid escapes `overflow-x-auto` in RTL.** The
  annual matrix scrolls correctly inside its wrapper — `clientWidth` 356,
  `scrollWidth` 560 — and Chrome *still* propagated the inline-end overflow to
  the document, which stretched the `fixed inset-x-0` bottom nav to 558px and
  gave every page the horizontal scroll the mobile pass existed to remove.
  `overflow-x: clip` and `isolation` do not help; `contain: paint` does, by
  making the wrapper a containing block. Measured 559px → 390px. If you add
  another sideways-scrolling region, check the document width, not just the
  region's.
- **Never merge intervals on write.** Work hours are edited via
  `<input type="time">`, which emits intermediate values while typing ("13:00"
  passes through "01:00"). Merging on every keystroke fused a transiently
  overlapping neighbour and destroyed it irreversibly. Merge on close; totals
  merge on read anyway.
- **`<input type="date">` — read this before touching it again; a debounce
  was tried here and is now known to be actively wrong, not just superseded.**
  Real bugs, in order:
  1. The field reports `""` for every intermediate state, and
     `onChange(e.target.value || null)` turned that into
     `setPlannedDate(id, null)` — dropping the task into the backlog *and*
     voiding its schedule block. *Fix: require a complete `YYYY-MM-DD` before
     writing anything.*
  2. That wasn't enough: the up/down spinner on a focused segment
     (day/month/year) reports a complete, valid, *different* date on every
     tick — moving the month by one is itself a whole valid day — so
     committing on any complete value still fired on every spin. Since Today
     shows only `plannedDate === today`, the first tick moved the task off
     the page and unmounted the very card the open menu was on; the menu just
     vanished mid-navigation, before a day was ever chosen. *Fix: commit only
     on blur or Enter, like `EditableText`.*
  3. **A wrong fix, tried and reverted:** to also catch a calendar pick that
     never blurs the field (browser's popup, not part of this page — see 4),
     a value that held still for 300ms with no further change was made to
     also commit, on top of blur/Enter. This reopened (2), *worse*: a real
     person clicking the spinner pauses to look at the result before clicking
     again, often for longer than any reasonable timeout, and each tick is
     independently a complete, valid, different date. The task moved a
     section forward **on its own, mid-browse, with no explicit action from
     the user** — confirmed live: a task planned for today silently landed on
     a date a month out from three spinner clicks with ordinary pauses
     between them. However short the delay, any "quiet moment = done" timer
     makes this same mistake against a real click cadence, so **don't
     reintroduce a timer here** — blur/Enter, full stop. The cost is accepted:
     a calendar pick that never blurs the field sits as an uncommitted draft
     until the user actually leaves the field, which needs an extra explicit
     action but never moves anything on its own.
  4. Separately: the calendar dropdown isn't part of this page's DOM — it's
     the browser's own popup. A click inside it can report a target
     `Popover`'s outside-click detector doesn't recognise as "inside" the
     menu, so the *whole menu* closed mid-browse, before a day was ever
     clicked — not a date-value bug, a `Popover` one. *Fix: `Popover` takes
     an optional `suspendCloseRef` — while `.current` is true, an outside
     pointerdown is ignored (Escape still closes it). `DateInput` sets it on
     focus and clears it on blur, shared by both the planned-date and
     due-date fields via one ref from `TaskMenu`.* Verified with **synthetic
     events**, not `.focus()`: calling `.focus()` from a script updates
     `document.activeElement` but does not reliably dispatch the `focusin`
     React needs, in this harness — a real click does not have that problem,
     but a test relying on `.focus()` alone will look broken when the code is
     fine, or (more dangerously) look fine when it isn't.
- **It is `proxy.ts`, not `middleware.ts`.** Next 16 deprecated the
  `middleware` file convention and renamed it to `proxy` — same behaviour, but
  the file *and the exported function* are both `proxy`. Every Supabase SSR
  guide currently published still says `middleware.ts` with
  `export async function middleware`, so copying one in verbatim gets you
  deprecated code that Next may simply not run. Related: Next explicitly says a
  proxy "should not be used as a full session management or authorization
  solution" and must avoid database calls, because it runs on every request
  including prefetches. That is why the real gate is `requireUser()` inside
  each page, and why the proxy uses `getClaims()` — this project's JWTs are
  ES256, so that verifies locally against cached JWKS instead of making a
  network round-trip per navigation the way `getUser()` would.
- **Never trust `getSession()` on the server.** It reads the cookie without
  verifying it; the SDK's own docs say the user object it returns "must not be
  trusted". Use `getClaims()` (verifies the signature) or `getUser()` (asks the
  auth server).
- **`signOut()` defaults to `scope: "global"` — it signs the user out
  *everywhere*.** Not just this browser: every session that user holds, on
  every device, including one they are in the middle of using. During auth
  testing this silently killed a live password-recovery session in another
  browser, and the reset then failed with `403 Session not found` several
  minutes later — with nothing linking cause to effect. App logout is
  `signOut({ scope: "local" })`. Reserve `global` for a deliberate "sign out
  everywhere" button, so the reach is the user's choice rather than a default.
  The same hazard applies to *test* flows: signing an account out in one
  browser invalidates whatever that account is doing in another.
- **Log the error from every Supabase auth call, even ones whose result the UI
  must not reveal.** The auth actions deliberately return vague messages so
  they cannot be used to probe which addresses are registered — and that
  vagueness was extended, wrongly, to the server. Four separate failures in
  this phase were invisible for exactly this reason: an email-send rate limit
  (`429`), a failed code exchange, and a revoked recovery session all surfaced
  as the same shrug on screen and *nothing at all* in the log. Keep the message
  vague for the browser and precise in `logAuthFailure`; the two audiences have
  opposite requirements.
- **Never delete a row because an edit made it momentarily invalid.** Push the
  other edge instead.
- **Don't sort a list the user is editing.** Re-sorting on keystroke moves the
  row out from under the cursor. Freeze order while open, normalise on close.
- **Popovers must be portalled.** Several cards use `overflow-hidden` to clip a
  rounded accent strip, which also clipped an anchored menu (429px cropped to
  90px). `Popover` now renders into `<body>` with computed fixed coordinates.
- **Custom CSS classes belong in `@layer components`.** An unlayered rule beats
  *every* layered one, so `.bare-input`'s `font: inherit` silently overrode the
  typography utilities on every composer.
- **Memoise ref callbacks passed to dnd-kit.** An inline arrow ref re-runs
  (null → node) each render and re-measures the droppable — an update loop.
- **Never build Tailwind class names by interpolation** (`bg-${color}`); use the
  static maps in `palette.ts`.
- **Don't select derived arrays inside a zustand selector** — it returns a new
  reference each render and spins `useSyncExternalStore`. Select the raw slice,
  derive in `useMemo`.
- **Don't rewrite files containing Hebrew with PowerShell** (`Get-Content` /
  `Set-Content` mangles UTF-8). Use the editing tools.
- **RLS does not stop a write landing in the wrong account.** Inserts omit
  `user_id` and let it default to `auth.uid()`, so a write queued as one user
  and sent after a switch is stamped with the *new* user's id — and the insert
  policy **approves** it, because it is a legitimate row for whoever is signed
  in now. RLS keeps other people out of your data; it has nothing to say about
  your data being filed under someone else's name. Hence `write-queue.ts`:
  every job carries the id it was queued for, and that is re-checked against
  the live session immediately before the request goes out.
- **Never derive writes by diffing the store.** It was the tempting design —
  no per-action lines, one subscriber. It fails because hydration is
  indistinguishable from mutation: `replaceAll` loading an account looks
  exactly like the user editing every row at once, so the whole thing rests on
  a suppression flag being right on every load, error path and account switch.
  Explicit `write()` calls make `replaceAll` silent *by construction*.
- **A debounce is not a free way to batch writes.** Any timer creates a window
  in which a write is owed but unsent, which is the window an account switch
  slips through. Bursty actions (a note textarea per keystroke, a drag per
  frame) are collapsed instead by a `key` on the job plus reading the row at
  *send* time: a second write for the same row skips if one is still queued,
  and the queued one sends the newest state. No timer, no window.
- **`ON CONFLICT DO NOTHING`, never `DO UPDATE`, in the import.** A retry must
  not overwrite edits made in the app between two attempts. Verified: a task
  renamed after a partial import kept its new title when the import re-ran.
- **Reconcile by id, not by count.** Counts agreeing proves nothing when an
  account already holds rows — a real run read *local 1 / remote 2 / missing 0*
  and was correct. Derived ids are known in advance; check membership.
- **`app/layout.tsx` had a stale `TestHook` import twice in this phase.** If a
  temporary debug component is mounted, delete the file *and* both lines in the
  layout, then `grep` for the name before claiming it is gone.
- **`process.env.NEXT_PUBLIC_X` written as a literal is replaced at *build*
  time — in server code too, not just the browser.** So a server component
  reading it that way reports what the build baked in, not the environment. To
  read the real runtime environment, look the name up dynamically
  (`process.env[["NEXT","PUBLIC",…].join("_")]`), which the bundler cannot fold
  into a literal. Without that distinction a stale build and a wrong variable
  are indistinguishable — which cost several rounds of diagnosis in production.
- **"Is it defined?" proves nothing about an env var.** Production spent a day
  returning `401 Invalid API key` because
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` contained the *project URL*: a
  non-empty, whitespace-clean, correctly-named string that passed every
  presence check and made `supabaseEnv()` perfectly happy. What identified it
  was **length + first six characters** against a known-good baseline (40/
  `https:` = the URL; 46/`sb_pub` = the key), plus a live probe that actually
  called Supabase with the value. Diagnose config by *shape and effect*, never
  by existence.
- **A nullable discriminator column plus a partial unique index cannot be
  upserted through PostgREST.** The obvious shape for goal-owned focus was one
  `monthly_focus` table with a nullable `goal_id`, and "at most one
  project-level row per (project, year, month)" needs a partial unique index
  (`... where goal_id is null`) because SQL `UNIQUE` never treats two `NULL`s
  as duplicates. Postgres can resolve `INSERT ... ON CONFLICT` against a
  partial index only by repeating its `WHERE` predicate in the `ON CONFLICT`
  clause — which `.upsert(row, { onConflict: "..." })`'s plain column-list
  string cannot express. This is why `goal_monthly_focus` is a separate sibling
  table, not a nullable column on `monthly_focus`; the two-table design was a
  constraint, not a style preference. See decision 8 in `docs/SCHEMA.md` — and
  decisions 9/10 for the KPI's two *different* calls on the same question: no
  uniqueness concern exists for the KPI's fixed *definition* (label/target),
  so that stays two plain nullable columns on `project_goals`; but the KPI's
  *value* turned out to need exactly `goal_monthly_focus`'s own shape once it
  was understood as "one number per month," and the first version of this
  feature (`0012`) got that wrong by putting a single overwritable
  `kpi_current` on the goal, destroying history on every edit — corrected in
  `0014`–`0016`. The lesson generalises: a superficially-similar "one more
  optional thing" is not one call, it's a fresh check of whether *this*
  attribute needs a key at all.
- **A live, uncommitted `<textarea>`/`<input>` is still part of
  `document.body.textContent`.** Verifying a save by grepping page text after
  typing gives a false positive — it cannot distinguish "typed but never
  committed to the store" from "actually saved". Query the specific rendered
  element (`input.value`, or the real `<li>` list an item renders into) instead
  of `body.textContent`, and to check real persistence, force a remount that
  does not reset the store (switching tabs in a harness, not reloading the
  page) and re-read the same element.
- **`--color-gold` already meant something before the KPI badge needed a
  gold treatment.** `globals.css` reserves gold for exactly one thing — a Big
  task's card — and says so explicitly: "if a project could be gold, gold
  would stop meaning 'big'." That reservation is scoped to `PaletteColor` (a
  *project's own* selectable accent) never including gold, not a blanket ban
  on the hex values appearing anywhere else. The KPI badge
  (`goal-kpi-badge.tsx`) reuses the same three tokens outright rather than
  minting a second, slightly-different gold — it carries no project-
  selectable colour of its own and never appears near a task's size marker,
  so there is nothing here for a project to "become." Two near-identical
  golds meaning two different things would have been worse than reusing one
  gold for two *unrelated* surfaces that never appear together.
- **An accent colour and a text colour are not the same job, even in the same
  family.** `--color-gold` (`#c9a227`) was designed to be a hover border and
  a tint — both cases where WCAG contrast doesn't apply. The first version of
  the goal-column KPI line used it at partial opacity for exactly that
  reason, and it read as pale and hard to read, because the base value fails
  text contrast on white outright (~2.6:1, nowhere near the 4.5:1 normal text
  needs) — no opacity value was ever going to fix that, since opacity only
  moves *toward* the failing number. The fix was a genuinely new, darker
  token (`--color-gold-deep`, ~5.5:1) rather than a tweak to an existing one:
  reusing `gold`/`gold-line`/`gold-soft` was right when the job was an
  accent, and wrong once the job became a sentence someone has to read.
  The second half of the lesson: even at AA, the darker token still read as
  "weak and awkward" while it carried the *whole* line, because a warm
  yellow-brown is a category marker, not a text colour. What worked was
  shrinking the coloured region rather than darkening it further — gold on
  `יעד:` alone, plain `text-text-2` for the target. A palette colour that
  says "which kind of thing is this" should label content, not be it.
- **Never hand someone a block of CLI commands where one is interactive.**
  `vercel env add` waits for a value on stdin; pasted as a block, it swallowed
  the *next command line* and stored it as the key (66 chars beginning
  `npx ve`). Pipe the value in instead — `… | vercel env add NAME production` —
  so there is no prompt to hijack.

---

## 9. Known gaps and open questions

- **Work hours are still set per day.** Recurring weekly defaults are the one
  remaining piece of the routines brief; routines themselves are complete.
- **A fixed-time routine can't be hidden for a single day.** Its time is owned
  by the template, so the rail block has no ✕ — you change it by editing the
  routine. A "skipped today" flag would be a third state on the log, which the
  simplest-override rule deliberately avoids. Revisit if it bites in practice.
- **The task menu lists archived projects.** All Tasks filters to active ones;
  the menu does not. Flagged to the user, not yet fixed.
- **Backup is manual only.** It relies on the user pressing *Download backup*.
- **`Reset demo day` is gone.** It refilled the store from `buildSeed()`, which
  was harmless against one browser's localStorage and is not harmless against a
  real account — every seeded row would be written in as though the user had
  typed it. There is no safe version of that button, so it was removed rather
  than rewired. `buildSeed` remains for development and tests; nothing in the
  running app calls it, and **seed data must never reach a Supabase account**.
- **A failed write is reported, not retried in the background.** The queue
  retries once, then the banner says so and offers *reload from server*. That is
  the deliberate limit of this design — there is no offline queue.
- **Motto contrast is ~3.2:1** (`#848b98`) — deliberately soft, below WCAG AA.
  One token step darker is `text-text-2`.
- Build prints `Failed to find font override values for font 'Gveret Levin'` —
  no fallback metrics exist for it, so the motto line may shift slightly on
  load. Harmless.
- The Schedule header's "hours planned" counts routine blocks, while the task
  count next to it counts tasks only.

---

## 10. Working agreement

- The user drives this in **phases and reviews each one** before the next.
- **When a phase touches the data model, propose the schema change and wait for
  approval before writing code.** This has been asked for explicitly, and two
  proposals were corrected on review (a redundant `status` enum was dropped; an
  estimated-duration field was rejected).
- Report honestly: state what was verified, what wasn't, and what you changed
  beyond the literal request.

## 11. The pre-Supabase backup key — do not delete yet

The migration did **not** delete the browser's old data. It renamed the key:

```
paper-today/day  →  paper-today/day.pre-supabase-backup
```

In the user's browser that archive is **70,933 bytes** and holds the exact v6
envelope as it stood immediately before the import — 206 tasks, 5 projects, 7
routines, 5 routine logs, 2 time blocks, 17 work windows, 3 notes, 2 day logs.
The app never reads it. Nothing writes it.

**Leave it there.** It is the only pre-migration copy in that browser, and it is
the only thing that could reconstruct the original if the import turns out to
have got something subtly wrong that the id-by-id check did not model. It costs
70 KB of a multi-megabyte quota.

Settings offers *הורד את העותק הישן* (download it) and *מחק את העותק הישן*
(delete it, behind a two-step confirm). **The delete is the user's to press,
deliberately, once they have lived with the migrated data for a while — not a
tidy-up for anyone else to do.** Retiring it early is unrecoverable: the account
holds the migrated rows, but the pre-migration snapshot exists nowhere else
unless the user separately downloaded the JSON.

`archiveLocalKey()` also refuses to overwrite an existing archive, so a second
import can never replace the original snapshot with one that has since been
through the app.

Related: `profiles.local_migrated_at` (added in `0005`) records when the import
finished. It is written **only after** reconciliation passes, and it is what
stops the import prompt reappearing. Clearing it would make the panel offer the
import again — harmless, because the import is idempotent, but confusing.

---

## 12. Environment

Node 24.19 was installed mid-session via winget. If tooling reports `node` or
`npm` as unknown, the shell has a stale PATH — open a new terminal, or prepend:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

`.claude/launch.json` (in the parent folder) starts the dev server via an
absolute path to `node.exe` for the same reason.

Verification in this project has been done by driving the running app in a
browser and asserting on computed styles and store state. Two harness limits to
know about: a hidden browser pane dispatches **no focus and no scroll events**,
so blur-to-save and scroll-repositioning must be exercised by dispatching the
events directly.
