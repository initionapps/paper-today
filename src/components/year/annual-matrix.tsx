"use client";

/**
 * Twelve months across, projects down. The actual words, not a summary of them.
 *
 * An earlier version drew one small bar per focus item instead of the text. It
 * was calm and it scanned beautifully and it was wrong: it told you *that*
 * March had two things in it and never *what*, so the only way to read the year
 * was to open twelve months one at a time. The point of this screen is to know
 * what each project is about in each month without clicking anything.
 *
 * Fitting real text meant paying for it in width. The page uses the 1520px
 * `matrix` shell rather than the 1180px one, and the project column is a fixed
 * 176px instead of a flexible ~104px.
 *
 * A month column is 160px, which does **not** fit twelve of them on any real
 * desktop — deliberately. The first version sized the column so all twelve
 * would fit (86px, about 11–12 Hebrew characters once padding is off) and
 * bought that at the cost of the thing the screen is for: at 86px a focus
 * item broke across three or four lines, a KPI chip's unit truncated, and the
 * whole matrix read as a compressed block of fragments. Twelve-at-once is not
 * actually a goal — nobody plans across a full year in one glance; they read a
 * stretch of it. So the column is sized for *reading* instead, and about eight
 * months land in view on a normal desktop with the rest a sideways scroll
 * away. See `NAME_COL` for the arithmetic.
 *
 * Sideways scrolling is therefore the expected case rather than the failure
 * case, inside the table's own box with the project column frozen — which is
 * also what a phone gets, and is why the month panel remains the reading and
 * editing surface for anything longer than a few words.
 *
 * Items **wrap** rather than truncate, and each one sits in its own small
 * block. A single truncated line turned out to tell you the subject without
 * telling you the step — "לכתוב מסמך…" is not something you can act on — and
 * three of them stacked read as one grey paragraph rather than as three
 * separate things. So the row grows to whatever its tallest cell needs, and
 * the blocks do the counting: one glance says whether a month holds one step
 * or three, before any of the words are read.
 *
 * `line-clamp-4` is a safety valve, not the normal case. A focus item is meant
 * to be a few words; the clamp only exists so one pasted paragraph cannot make
 * a 300px row out of a 78px one. The full text stays reachable either way — it
 * is the cell's `title` for a mouse and its accessible name for a screen
 * reader.
 *
 *
 * WHY A TABLE AND NOT A GRID
 *
 * This was a CSS grid, and the frozen project column did not work. A
 * sticky-positioned *grid item* is offset against the scrollport and then
 * clamped to its containing block — which for a grid item is its own grid
 * area, 176px wide. So it holds for 176px of scrolling and then slides away
 * with everything else. Measured: pinned at x=197 when unscrolled, 217 after a
 * 200px scroll, 617 after 600px. (A single small-offset check made this look
 * like it worked, which is how it survived the first round of verification.)
 *
 * A table has neither problem: sticky on a cell is the one place browsers
 * genuinely support a frozen column, and row heights synchronise across the
 * row for free rather than needing two columns kept in step by hand. It is
 * also simply the more honest element — this is a matrix of values with two
 * headers, which is what `<table>` means.
 *
 * `border-separate` rather than `collapse`: a collapsed border belongs to the
 * table, not the cell, and sticky cells lose theirs while scrolling.
 *
 *
 * PROJECTS WITH GOALS
 *
 * A project with no goals is not in this table at all. Every row here is a
 * goal, and a project earns its header band by having some — an empty project
 * contributed a name, twelve empty cells and a row of hairlines, which is a
 * lot of vertical space spent on "nothing is planned here" on the one screen
 * whose job is showing what *is*. This is a filter and nothing more: the
 * project still exists, still appears on the Projects screen, and still gets
 * its own focus editor in the month panel, which is where its monthly focus
 * items remain visible and editable. Nothing is hidden from the only surface
 * that can reach it.
 *
 * A project with goals renders as a plain, unclickable header row — full accent, no
 * month cells with anything in them — followed by one ordinary row per goal,
 * each carrying the *same* accent at reduced opacity. The colour still says
 * "which project"; the header row is what earns the full-strength version, so
 * five goal rows under one project don't each shout it independently. Every
 * row, header or otherwise, keeps the same 13-cell shape (name + 12 months) —
 * simpler to reason about than a `colSpan`, and it keeps the frozen-column
 * mechanics identical for every row without a special case.
 */
import {
  kpiTargetText,
  type GoalMonthlyFocus,
  type GoalMonthlyKpi,
  type PaletteColor,
  type Project,
  type ProjectGoal,
} from "@/lib/types";
import { PROJECT_DOT } from "@/lib/palette";
import { formatKpiNumber, GoalKpiValueBadge } from "@/components/ui/goal-kpi-badge";
import { goalFocusItems, goalMonthlyKpiValue, goalsForProject } from "@/lib/store/day-store";
import { monthsFrom, shortMonthName, monthName } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

/** A (year, 1-based month) pair — one visible column. */
type MonthCell = { year: number; month: number };

const sameCell = (a: MonthCell, b: MonthCell) => a.year === b.year && a.month === b.month;

/**
 * `176px` is fixed rather than a fraction so a project name is not squeezed by
 * how many months happen to have content — at the old flexible ~104px, ordinary
 * names were being cut off. It holds roughly 20 Hebrew characters, so
 * truncation becomes the exception it should be rather than the norm.
 *
 * The table's `min-w-[2096px]` below is 176 + 12×160, and 160 is chosen from
 * the viewport backwards: the 1520px `matrix` shell minus this 176px column
 * leaves 1344px, which is 8.4 month columns — the "roughly eight months in
 * view" this screen aims for. A 1440px laptop, the narrowest thing that still
 * counts as desktop here, shows about 7.6. Both round to eight, which is why
 * one value covers the range instead of a breakpoint.
 *
 * The month width is expressed *only* through that floor, never as a class on
 * the month columns: `table-fixed` divides the table's width minus this fixed
 * column evenly between the twelve, so declaring both would be two sources of
 * truth that can disagree. Since the shell caps at 1520px — well under the
 * floor — the table sits at exactly 2096px on every desktop, which makes a
 * month column exactly 160px and the horizontal scroll permanent by design.
 */
const NAME_COL = "w-[176px] min-w-[176px]";

/** Shared by the frozen header cell and every frozen row header under it. */
const FROZEN = "sticky start-0 bg-surface";

/**
 * The current month's column, outlined as one continuous shape rather than
 * cell by cell. Every cell in the column — header, goal rows, the grey
 * project-header bands, empty cells, all of them — carries only its two
 * *side* edges; the top is added once by the `<thead>` cell and the bottom
 * once by the table's final row. Twelve separately-boxed cells was the
 * obvious first move and is the wrong shape: it draws eleven horizontal
 * lines nobody asked for and reads as a stack of selected boxes instead of
 * one highlighted month.
 *
 * `blue/40`, not `blue`: it is the same hue as the month's own title, which
 * is the point — the tinted fill, the title, and this line should obviously
 * be one thing — but a full-strength `#3b82f6` hairline running the height of
 * the table competes with the KPI chips and focus cards inside the column it
 * is supposed to be framing. At 40% it registers as structure, not as an
 * element. No shadow and no stronger fill for the same reason: the existing
 * `blue-soft` tint already says "this month," and the border is there to give
 * that tint a definite edge, not to make it louder.
 */
const CURRENT_COL = "border-x border-x-blue/40";

type MatrixRowSpec =
  | {
      kind: "row";
      key: string;
      name: string;
      color: PaletteColor;
      accentOpacity?: string;
      /** Only ever set for a goal's own row with a KPI definition — a plain
       * project row has no KPI at all, and a goal without one has nothing to
       * look up per cell. `kpiTargetLine` is the resolved target sentence
       * (`kpiTargetText`), shown once under the goal's name; `kpiUnit` is
       * needed separately for the monthly chip; `kpiValue` looks up that
       * month's actual measurement, per cell, like `items`. */
      kpiTargetLine?: string;
      kpiUnit?: string | null;
      kpiValue?: (cell: MonthCell) => number | null;
      items: (cell: MonthCell) => string[];
    }
  | { kind: "header"; key: string; name: string; color: PaletteColor };

/**
 * Flattens projects and their goals into one ordered list of rows, computed
 * once so "is this the table's true last row" can be answered by a plain
 * array index — the nested `project → maybe-goals` structure above it has no
 * single place that knows that on its own. It is also the one place the
 * "goal-less projects are not in this table" rule lives, so a project that
 * contributes nothing contributes no header either: skipping happens before
 * the header is pushed, which is what keeps an empty band or a stray
 * separator from ever being possible rather than something to clean up after.
 *
 * Takes no year: each row's `items`/`kpiValue` read whichever (year, month)
 * cell the caller hands them, since the twelve visible columns are no longer
 * one fixed calendar year — see `monthsFrom` in `AnnualMatrix`.
 *
 * Takes no project-level `focus` either, since nothing here reads it any
 * more: the only row that ever showed a project's *own* monthly focus items
 * was the goal-less project row this no longer emits. That data is untouched
 * and still editable in the month panel, which renders a `FocusCard` per
 * goal-less project for exactly that purpose.
 */
function rowsFor(
  projects: Project[],
  goals: ProjectGoal[],
  goalMonthlyFocus: GoalMonthlyFocus[],
  goalMonthlyKpi: GoalMonthlyKpi[],
): MatrixRowSpec[] {
  const rows: MatrixRowSpec[] = [];
  for (const project of projects) {
    const mine = goalsForProject(goals, project.id);
    if (mine.length === 0) continue;
    rows.push({ kind: "header", key: `${project.id}:header`, name: project.name, color: project.color });
    for (const goal of mine) {
      rows.push({
        kind: "row",
        key: goal.id,
        name: goal.title,
        color: project.color,
        accentOpacity: "opacity-50",
        kpiTargetLine: goal.kpi ? kpiTargetText(goal.kpi) : undefined,
        kpiUnit: goal.kpi?.unit,
        kpiValue: goal.kpi
          ? (cell) => goalMonthlyKpiValue(goalMonthlyKpi, goal.id, cell.year, cell.month)
          : undefined,
        items: (cell) => goalFocusItems(goalMonthlyFocus, goal.id, cell.year, cell.month),
      });
    }
  }
  return rows;
}

export function AnnualMatrix({
  projects,
  goals,
  goalMonthlyFocus,
  goalMonthlyKpi,
  windowStart,
  today,
  onOpenMonth,
}: {
  projects: Project[];
  goals: ProjectGoal[];
  goalMonthlyFocus: GoalMonthlyFocus[];
  goalMonthlyKpi: GoalMonthlyKpi[];
  /** The first of the 12 visible columns — see the note on this in `year-view.tsx`. */
  windowStart: MonthCell;
  /** The real current month. Highlighting simply checks each column against
   * it, so a window that has been navigated away from today highlights
   * nothing — no separate "is this even the current year" flag needed. */
  today: MonthCell;
  onOpenMonth: (cell: MonthCell) => void;
}) {
  const months = monthsFrom(windowStart.year, windowStart.month, 12);
  const rows = rowsFor(projects, goals, goalMonthlyFocus, goalMonthlyKpi);

  if (projects.length === 0) {
    return (
      <p className="mt-10 text-center text-[13.5px] text-text-3">
        {copy.year.noProjects}
        <span className="mt-1 block text-[12.5px]">{copy.year.noProjectsHint}</span>
      </p>
    );
  }

  // Projects exist, but none of them has a goal — so every one of them was
  // filtered out and the table would be a header with nothing under it. A
  // different message from the one above, because the two situations need
  // different next steps: "create a project" would be wrong advice to someone
  // who already has several.
  if (rows.length === 0) {
    return (
      <p className="mt-10 text-center text-[13.5px] text-text-3">
        {copy.year.noGoalProjects}
        <span className="mt-1 block text-[12.5px]">{copy.year.noGoalProjectsHint}</span>
      </p>
    );
  }

  return (
    /**
     * `contain: paint` is not decoration, and `overflow-x-auto` alone is not
     * enough. The wrapper does scroll correctly on its own — but in RTL Chrome
     * still propagates the inline-end overflow up to the document, which
     * stretches the `fixed inset-x-0` bottom nav to the full scroll width and
     * gives every page the horizontal scroll the mobile pass existed to remove.
     * Declaring that nothing paints outside this box makes it a containing
     * block and stops the propagation; `overflow-x: clip` and `isolation` were
     * both tried and do not. Measured: 559px → 390px.
     */
    <div className="no-scrollbar mb-10 mt-9 overflow-x-auto rounded-xl border border-line-soft bg-surface [contain:paint] sm:mb-12 sm:mt-11">
      <table className="w-full min-w-[2096px] table-fixed border-separate border-spacing-0">
        <caption className="sr-only">{copy.year.title}</caption>

        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                FROZEN,
                NAME_COL,
                "z-20 border-b border-line-soft px-3.5 py-2.5 text-start",
                "text-[11px] font-semibold tracking-[0.03em] text-text-3",
              )}
            >
              {copy.year.projectsColumn}
            </th>

            {months.map((cell, i) => {
              const isCurrent = sameCell(cell, today);
              // The base year on the first column, and again wherever the
              // window actually crosses into a new one — at most one such
              // crossing exists, since any 12 consecutive months contain
              // every month name exactly once. Both spans always render, one
              // just `invisible`, so every column keeps the same height.
              const showsYear = i === 0 || cell.year !== months[i - 1].year;
              return (
                <th
                  key={`${cell.year}-${cell.month}`}
                  scope="col"
                  className={cn(
                    "border-b border-line-soft p-0 text-[11.5px] font-medium",
                    // The column's outline starts here: sides plus the one
                    // top edge the whole column gets.
                    isCurrent ? cn("bg-blue-soft/60", CURRENT_COL, "border-t border-t-blue/40") : "",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenMonth(cell)}
                    aria-label={copy.year.openMonth(copy.year.monthOf(monthName(cell.month), cell.year))}
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-center gap-0.5 px-2 py-2.5 transition-colors hover:bg-canvas hover:text-text",
                      // Already the only blue label in the header row;
                      // `font-semibold` against the others' `font-medium`
                      // keeps it the stronger one now that the column has a
                      // frame of its own to sit inside.
                      isCurrent ? "font-semibold text-blue" : "text-text-2",
                    )}
                  >
                    <span>{shortMonthName(cell.month)}</span>
                    <span className={cn("ltr-run text-[9.5px] leading-none text-text-3", !showsYear && "invisible")}>
                      {cell.year}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i, all) => {
            const last = i === all.length - 1;
            if (row.kind === "header") {
              return (
                <GroupHeaderRow
                  key={row.key}
                  name={row.name}
                  color={row.color}
                  months={months}
                  today={today}
                  noBorder={last}
                />
              );
            }
            return (
              <MatrixRow
                key={row.key}
                name={row.name}
                color={row.color}
                accentOpacity={row.accentOpacity}
                kpiTargetLine={row.kpiTargetLine}
                kpiUnit={row.kpiUnit}
                kpiValue={row.kpiValue}
                items={row.items}
                months={months}
                today={today}
                onOpenMonth={onOpenMonth}
                noBorder={last}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One project's, or one goal's, name plus twelve month cells. A fragment
 * rather than a wrapper element: the cells have to be direct children of
 * `<tr>`, or the columns stop lining up.
 *
 * `noBorder` is computed once, up front, in `rowsFor` — a plain array index
 * check — and threaded down here, rather than this component trying to know
 * whether it happens to be last among a flattened project/goal structure it
 * never sees. Without it, the table's own final hairline sits flush against
 * the wrapper's border directly beneath it and reads as one thick line.
 */
function MatrixRow({
  name,
  color,
  accentOpacity,
  kpiTargetLine,
  kpiUnit,
  kpiValue,
  items,
  months,
  today,
  onOpenMonth,
  noBorder,
}: {
  name: string;
  color: PaletteColor;
  accentOpacity?: string;
  kpiTargetLine?: string;
  kpiUnit?: string | null;
  kpiValue?: (cell: MonthCell) => number | null;
  items: (cell: MonthCell) => string[];
  months: MonthCell[];
  today: MonthCell;
  onOpenMonth: (cell: MonthCell) => void;
  noBorder?: boolean;
}) {
  const edge = noBorder ? "" : "border-b border-line-soft";
  return (
    <tr>
      <th scope="row" className={cn(FROZEN, NAME_COL, "z-10 px-3.5 py-3 text-start font-normal", edge)}>
        <span className="flex items-center gap-2.5">
          {/* The same 3px accent the task cards carry, so a project is the
              same colour wherever it appears — at full strength for its own
              row, lighter on a goal row (see `accentOpacity`). */}
          <span className={cn("h-4 w-[3px] shrink-0 rounded-full", PROJECT_DOT[color], accentOpacity)} />
          {/* `truncate` stays as the fallback for an unusually long name; at
              176px it should rarely fire. */}
          <span className="truncate text-[13px] text-text" title={name}>
            {name}
          </span>
        </span>
        {/* The goal's KPI *target* only — never the metric name, never a
            percentage, never a bar; those stay out of the annual view
            entirely.

            The gold sits on "יעד:" alone, not on the line. Colouring the
            whole sentence gold was the first attempt and it read as weak and
            slightly off: gold is a *category* marker here — it says "this is
            the KPI family, like the chips in the month cells" — and once it
            carries the words too, the one thing you actually want to read at
            a glance is the thing rendered in the least legible colour on the
            row. Split, the label names the category and the target itself is
            ordinary secondary text, which is also what let it grow from
            10.5px to 11.5px without competing with the 13px goal name above
            it: size separates it from the title, colour no longer has to.

            `gold-deep` rather than `gold` even for two words — the base
            accent is ~2.6:1 on white, fine for a hairline, not for type.

            Wraps rather than truncating: a target is meant to be read in
            full, not hinted at behind an ellipsis. The label and the target
            are plain inline content in one paragraph, so a wrap falls
            wherever the text does and the two halves never split into
            separate lines of their own. Only a goal with a KPI definition
            has this line at all; a plain project row or a KPI-less goal
            renders nothing extra here. */}
        {kpiTargetLine !== undefined && (
          <p className="mt-1 break-words ps-[13px] text-[11.5px] leading-[1.35] text-text-2">
            <span className="font-medium text-gold-deep">{copy.year.kpiGoalLabel}</span>{" "}
            {kpiTargetLine}
          </p>
        )}
      </th>

      {months.map((cell) => {
        const monthItems = items(cell);
        const value = kpiValue?.(cell) ?? null;
        const isCurrent = sameCell(cell, today);
        return (
          <td
            key={`${cell.year}-${cell.month}`}
            // `h-px` is the table trick, not a real height: a cell still grows
            // to its row, but giving it a *definite* height is what lets the
            // button's `h-full` resolve against the row instead of collapsing
            // to its content. Without it, a sparse cell in a tall row leaves
            // dead space below the text that does not open the month.
            className={cn(
              "h-px p-0 align-top",
              edge,
              isCurrent && cn("bg-blue-soft/40", CURRENT_COL),
              // The column's closing edge, drawn once. `noBorder` already
              // marks the table's true final row, so this reuses the same
              // answer rather than working it out again.
              isCurrent && noBorder && "border-b border-b-blue/40",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenMonth(cell)}
              title={
                [value != null ? formatKpiNumber(value) + (kpiUnit ? ` ${kpiUnit}` : "") : null, ...monthItems]
                  .filter(Boolean)
                  .join("\n") || undefined
              }
              className={cn(
                // `items-stretch` + `text-start`: the blocks fill the column
                // and read as a small right-aligned stack in RTL, not as
                // centred labels. `gap-2`: enough air between blocks that
                // 2–3 items read as separate steps, not a stacked column.
                "flex h-full min-h-[66px] w-full cursor-pointer flex-col items-stretch gap-2",
                // `hover:bg-canvas` would make the blocks vanish into the
                // cell, since that is the colour they are. The cell's
                // affordance is the border instead.
                //
                // `px-2.5` rather than the old `px-1.5`: at 86px every pixel
                // of gutter was width a focus item needed more, so the cards
                // ran nearly edge to edge. At 160px they don't, and the
                // tighter gutter just read as crowding against the
                // current-month column's border.
                "px-2.5 py-2 text-start transition-colors hover:bg-blue-soft/30",
              )}
            >
              {/* The KPI value sits first, above any focus steps — the
                  hierarchy this screen keeps is Goal, then its measured
                  month, then the steps taken toward it.

                  On a goal that *has* a KPI definition the slot is reserved
                  in all twelve cells, measured or not, so the first focus
                  card starts on the same line right across the row. Without
                  that, a single measured month shunted its own focus cards
                  ~29px down while its neighbours' stayed put, and the row
                  read as ragged rather than as a series. The empty case is
                  the very same chip with `invisible` — identical padding,
                  border and line-height, so the reserved height can never
                  drift from the real one the way a hard-coded `min-h` would
                  the next time the chip's padding changes. `visibility:
                  hidden` also keeps it out of the accessibility tree, so the
                  placeholder `0` is never announced; the cell's `title` and
                  its `sr-only` label both still describe only real values.

                  A row with no KPI definition at all — a plain project row,
                  or a goal that never had one — reserves nothing. There is
                  no chip anywhere in such a row for the space to align to,
                  so it would be dead margin in all twelve cells.

                  `self-center`: the parent's `items-stretch` would otherwise
                  widen this to match the white focus blocks below it, and
                  the whole point is that it reads as a compact chip, not as
                  another card the same shape as a focus step. */}
              {kpiValue !== undefined &&
                (value != null ? (
                  <GoalKpiValueBadge value={value} unit={kpiUnit ?? null} className="self-center" />
                ) : (
                  <GoalKpiValueBadge value={0} unit={kpiUnit ?? null} className="invisible self-center" />
                ))}

              {monthItems.map((item, i) => (
                <span
                  key={i}
                  /**
                   * A small content card, deliberately not a control: no
                   * hover of its own, no cursor change, no press state. The
                   * whole cell is the button; these are what it contains.
                   *
                   * Plain white plus a real hairline — the same
                   * white-card-on-a-hairline idiom the Medium task card
                   * uses — is what keeps this legible on the tinted
                   * current-month column too: a warm-tinted fill was tried
                   * and read as muddy against the page's cool grey rather
                   * than as warm, so the separation comes from the border and
                   * the flat shadow instead of a colour cast doing double duty.
                   *
                   * `break-words` stops one long unbroken token from pushing
                   * the column wider than its track.
                   */
                  // No `block`: `line-clamp` sets its own
                  // `display: -webkit-box`, and the two would race.
                  className={cn(
                    "shadow-flat rounded-lg border border-line bg-surface px-2 py-2",
                    "text-[11px] leading-[1.45] text-text-2",
                    "line-clamp-4 break-words",
                  )}
                >
                  {item}
                </span>
              ))}

              {/* An empty cell is genuinely empty — no placeholder, no dash.
                  The button still fills it, so the whole table stays clickable. */}

              <span className="sr-only">
                {copy.year.cellLabel(name, copy.year.monthOf(monthName(cell.month), cell.year))}
                {value != null ? ` · ${formatKpiNumber(value)}${kpiUnit ? ` ${kpiUnit}` : ""}` : ""}
                {monthItems.length > 0 ? `: ${monthItems.join(", ")}` : ""}
              </span>
            </button>
          </td>
        );
      })}
    </tr>
  );
}

/**
 * The row a project becomes once it has goals: a label, not a control. No
 * `onClick`, no button — there is nothing to open here any more, since a
 * project with goals has no month cell of its own for the matrix to show.
 */
function GroupHeaderRow({
  name,
  color,
  months,
  today,
  noBorder,
}: {
  name: string;
  color: PaletteColor;
  months: MonthCell[];
  /** Only so the current month's column outline runs through this band
   *  unbroken. The band keeps its own grey fill — it is a divider between
   *  projects, not part of any month — but a column that stops at every
   *  project header and starts again below it is three outlines, not one. */
  today: MonthCell;
  /** Always `false` in practice — a header is only ever emitted immediately
   *  before at least one goal row — kept only so the shared call site in
   *  `AnnualMatrix` doesn't need to know which row kind it's rendering. */
  noBorder?: boolean;
}) {
  const edge = noBorder ? "" : "border-b border-line-soft";
  return (
    <tr>
      <th
        scope="row"
        className={cn(FROZEN, NAME_COL, "z-10 bg-canvas px-3.5 py-2 text-start font-semibold", edge)}
      >
        <span className="flex items-center gap-2.5">
          <span className={cn("h-4 w-[3px] shrink-0 rounded-full", PROJECT_DOT[color])} />
          <span className="truncate text-[12.5px] text-text" title={name}>
            {name}
          </span>
        </span>
      </th>
      {months.map((cell) => (
        <td
          key={`${cell.year}-${cell.month}`}
          className={cn("bg-canvas p-0", edge, sameCell(cell, today) && CURRENT_COL)}
        />
      ))}
    </tr>
  );
}
