# Paper Today

A personal daily work page: **one day, one bounded column** — not an endless
list. Hebrew-first and RTL throughout, in a clean-futuristic-soft visual
language (cool light canvas, white cards, restrained colour accents).

> The project name is a leftover from the first design round, which imitated a
> sheet of A4. That metaphor was deliberately dropped — see
> [`docs/ARCHITECTURE.md §5`](docs/ARCHITECTURE.md).

- [`PROJECT_STATE.md`](PROJECT_STATE.md) — **start here**: current state, settled decisions, traps already hit
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — project structure, status, interaction design
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — database decisions and rationale
- [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — the DDL (not applied yet)

## Run it

```bash
npm run dev
```

Then open <http://localhost:3000> — `/` redirects to `/today`.

```bash
npm run typecheck   # tsc --noEmit
npx eslint .
npm run build
```

Node 20.9+ is required (built and verified on Node 24.19, Next 16.3, React 19.2).

## What's built

All of it is driven by realistic mock data in [`src/lib/mock/seed.ts`](src/lib/mock/seed.ts)
and held in a zustand store persisted to `localStorage`.

| | |
| --- | --- |
| **Hierarchy** | Big white cards → Medium half-cards → Routines → Small checklist, separated by whitespace and a coloured dot per section |
| **Language** | Hebrew UI and seed data; every string in [`src/lib/copy.ts`](src/lib/copy.ts) |
| **Inline entry** | A ghost line at the end of each section becomes a bare input. Enter adds and keeps the line open; Esc closes. No dialogs. |
| **Inline rename** | Click any title. Enter commits, Esc reverts. |
| **Size is persistent** | Change it from the `⋯` menu, or drag a card into another section — the drop rewrites `task.size`. |
| **Reordering** | Drag by the handle in the left margin. Fractional `order`, so one row changes. |
| **Notes** | Click anywhere in the Notes area to leave a sticky note; drag it anywhere. Notes are not tasks and are stored separately. |
| **Move / Archive / Done** | Per task, from the `⋯` menu. Date moves and Archive are undoable for six seconds. |
| **Wrap Up Day** | Lists what is still open and asks for a decision per task: tomorrow, backlog, archive, or leave it. |
| **All Tasks** | Every open task grouped overdue / today / tomorrow / upcoming / no date, with filters for size, project and date. Add straight into a group, choosing the date as you write. |
| **Dates** | `plannedDate` = when you mean to do it (nullable — `null` is the backlog). `dueDate` = the deadline, optional and independent. |
| **Schedule** | A daily planner: the day's tasks in a sidebar beside a vertical rail. Drag to place, drag to move, drag the bottom edge to resize — lines every 30 min, snapping every 15. Tick a task done straight from a block. Work-hour windows tint availability, blocked time sits between them, and the header shows work / blocked / scheduled / remaining. |
| **Backup** | Settings → download every persisted field as one JSON file, or restore from one. Validated before anything is touched, applied all-or-nothing, entirely local. |
| **Projects** | Name, accent colour, one-line description and long-form notes. A project page lists its tasks grouped overdue / today / later / no date, and you can add straight into it choosing Big / Medium / Small. Archiving is a timestamp; tasks keep their project. |

**Nothing rolls over.** An unfinished task stays on the day it was written until
you move it — and shows up under **באיחור** in All Tasks so it can't quietly
disappear.

`Reset demo day` at the foot of the Today page restores the seed.

## Not built yet, on purpose

Auth, Supabase and the routine recurrence engine are deferred (see the status
table in `docs/ARCHITECTURE.md`). The Routines section renders seeded routines
and records per-day completions; its `+ הוסף שגרה` line explains that adding
them lands later. Work hours are set per day — recurring weekly defaults come
with the routine engine.

Projects are deliberately thin: no milestones, no progress bars, no
dependencies, no charts. A colour, a sentence, a notes field, and the tasks.

Two things worth knowing about All Tasks: a task added there starts as
**medium** (size is one click away in the menu), and the add-lines are hidden
while a filter is active, so a new task can't appear and immediately vanish.
