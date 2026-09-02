# Project state

Handoff document. Read this first; it links to the detail rather than repeating
it. Companion docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (structure,
visual language, RTL), [`docs/SCHEMA.md`](docs/SCHEMA.md) (data decisions and
why), [`README.md`](README.md) (feature list, how to run).

---

## 1. What this is

A personal daily planner: **one day, one bounded column** — deliberately not an
endless task list. Hebrew-first, RTL throughout, local-only.

Stack: Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript · Tailwind
v4 · zustand (persisted to `localStorage`) · dnd-kit · date-fns · lucide-react.

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
| **Supabase / auth** | not started |

Routes: `/today` · `/schedule` · `/tasks` · `/projects` · `/projects/[id]` ·
`/settings`. `/` redirects to `/today`.

**Nothing is server-side.** No Supabase, no SQLite, no cloud, no auth. The SQL
in `supabase/migrations/0001_init.sql` is a design artifact that has **never
been applied**; it exists so the client store is shaped like the eventual rows.

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

State lives in `src/lib/store/day-store.ts`, currently `STORE_VERSION = 6`,
persisted under `localStorage["paper-today/day"]`.

**`PersistedSlice` + `persistedSlice()` are the single definition of "what
survives a reload".** `partialize` and the backup export both read through it,
so the two cannot drift. Add a field there when you add persisted state.

**Any field rename needs a version bump and a step in `migratePersisted`.** The
user has real data in their own browser; a rename without a migration destroys
it. Existing steps: v1→v2 (`day`→`plannedDate`, `durationMin`→`scheduledEndMin`),
v2→v3 (project `description`/`notes`), v3→v4 (`timeBlocks`, `workWindows`),
v4→v5 (routine `archivedAt` + fixed times), v5→v6 (task `isImportant`).

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
    shell/        AppShell (wide variant for Schedule), NavTabs
    task/         shared by Today + All Tasks: EditableText, TaskMenu, meta
    today/        TodayView, cards, composers, notes, wrap-up, motto
    tasks/        AllTasksView, TaskRow, FilterBar
    projects/     ProjectsView, ProjectView, colour picker, notes
    schedule/     ScheduleView, Timeline, RailBlock, sidebar, work hours
    settings/     BackupPanel
    ui/           Checkbox, Popover, Section
  lib/
    types.ts      domain types — the contract with the DB
    copy.ts       every user-facing string (Hebrew)
    date.ts       DayKeys ('YYYY-MM-DD'), he-locale formatting, buckets
    schedule.ts   pure minute/pixel maths, intervals, lanes, capacity
    palette.ts    accent classes — plain data, no React, no import cycles
    backup.ts     export envelope + strict validation
    store/        the seam Supabase will slot into
    mock/seed.ts  demo data; delete when Supabase lands
```

---

## 8. Traps already hit — do not re-introduce

Each of these was a real bug that took real debugging.

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
- **`Reset demo day`** at the foot of Today wipes real data without
  confirmation. Fine while it's demo data; revisit before real daily use.
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

## 11. Environment

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
