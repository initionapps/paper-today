"use client";

import { useMemo, useState } from "react";

import { InlineComposer } from "@/components/today/inline-composer";
import { Section, type SectionAccent } from "@/components/ui/section";
import { UndoToast } from "@/components/today/undo-toast";
import { activeProjects, activeTasks, groupByBucket, useDayStore } from "@/lib/store/day-store";
import { useAccountReady } from "@/lib/supabase/account";
import { MobileFilters } from "./mobile-filters";
import { dateBucket, shiftDay, todayKey, tomorrowOf } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { DATE_BUCKETS, type DateBucket, type DayKey, type Task } from "@/lib/types";

import { FilterBar, NO_FILTERS, isFiltering, type Filters } from "./filter-bar";
import { TaskRow } from "./task-row";

const ACCENT: Record<DateBucket, SectionAccent> = {
  overdue: "rose",
  today: "blue",
  tomorrow: "purple",
  upcoming: "teal",
  none: "grey",
};

/** Overdue is a consequence, not a destination — you can't file a task into it. */
const COMPOSABLE: DateBucket[] = ["today", "tomorrow", "upcoming", "none"];

/** Anything added from here starts medium; size is one click away in the menu. */
const DEFAULT_SIZE = "medium" as const;

function matches(task: Task, f: Filters, today: DayKey): boolean {
  if (f.sizes.length && !f.sizes.includes(task.size)) return false;
  if (f.projects.length && !f.projects.includes(task.projectId)) return false;
  if (f.buckets.length && !f.buckets.includes(dateBucket(task.plannedDate, today))) return false;
  return true;
}

/**
 * The backlog. Every open task, wherever it is planned — including the ones
 * with no date at all, which is the whole reason this screen exists.
 */
export function AllTasksView() {
  const [today] = useState(todayKey);
  // Supabase is the source of truth now; this is the account load, not a
  // localStorage read. See lib/supabase/account.ts.
  const hydrated = useAccountReady();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [upcomingDate, setUpcomingDate] = useState<DayKey>(() => shiftDay(todayKey(), 2));
  /**
   * Mobile-only text search. It narrows the same list the filters narrow, so
   * the two compose; it is not a separate mode. Desktop has no search field, so
   * this stays empty there and the filter below is a no-op.
   */
  const [query, setQuery] = useState("");

  const tasks = useDayStore((s) => s.tasks);
  const projects = useDayStore((s) => s.projects);
  const addTask = useDayStore((s) => s.addTask);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const open = useMemo(() => activeTasks(tasks), [tasks]);
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      open
        .filter((t) => matches(t, filters, today))
        .filter(
          (t) =>
            needle === "" ||
            t.title.toLowerCase().includes(needle) ||
            (t.detail ?? "").toLowerCase().includes(needle),
        ),
    [open, filters, today, needle],
  );
  const groups = useMemo(() => groupByBucket(visible, today), [visible, today]);

  const filtering = isFiltering(filters);
  const dateFor = (bucket: DateBucket): DayKey | null =>
    bucket === "today"
      ? today
      : bucket === "tomorrow"
        ? tomorrowOf(today)
        : bucket === "upcoming"
          ? upcomingDate
          : null;

  if (!hydrated) return <div className="min-h-[70vh]" />;

  return (
    <>
      <header>
        <h1 className="font-display text-[1.6rem] sm:text-[2.25rem] font-bold leading-tight tracking-[-0.022em] text-text">
          {copy.allTasks.title}
        </h1>
        <p className="mt-1.5 text-[14px] text-text-2">{copy.allTasks.subtitle(open.length)}</p>
      </header>

      {/* filter by projects you're still working on; archived ones stay out */}
      {/* Desktop keeps the three always-visible rows, unchanged. */}
      <div className="hidden sm:block">
        <FilterBar filters={filters} onChange={setFilters} projects={activeProjects(projects)} />
      </div>

      <MobileFilters
        filters={filters}
        onChange={setFilters}
        projects={activeProjects(projects)}
        query={query}
        onQueryChange={setQuery}
      />

      {visible.length === 0 && (
        <p className="mt-14 text-[15px] text-text-3">
          {needle !== ""
            ? copy.allTasks.noSearchResults
            : filtering
              ? copy.allTasks.emptyFiltered
              : copy.allTasks.empty}
        </p>
      )}

      {DATE_BUCKETS.map((bucket) => {
        const list = groups[bucket];
        const composable = COMPOSABLE.includes(bucket) && !filtering;
        // an empty group earns its heading only if you can write into it
        if (list.length === 0 && !composable) return null;

        return (
          <Section
            key={bucket}
            title={copy.buckets[bucket]}
            accent={ACCENT[bucket]}
            count={list.length}
            className="mt-10"
          >
            <div className="shadow-flat mt-4 overflow-hidden rounded-2xl border border-line-soft bg-surface">
              <div className="divide-y divide-line-soft">
                {list.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={projectById.get(task.projectId ?? "")}
                    today={today}
                    showDate={bucket === "upcoming" || bucket === "overdue"}
                  />
                ))}
              </div>

              {composable && (
                <div
                  className={cn(
                    "flex items-center gap-3 px-4",
                    list.length > 0 && "border-t border-line-soft",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <InlineComposer
                      variant="small"
                      prompt={copy.allTasks.addTo[bucket as keyof typeof copy.allTasks.addTo]}
                      onAdd={(title) => addTask(dateFor(bucket), DEFAULT_SIZE, title)}
                    />
                  </div>
                  {bucket === "upcoming" && (
                    <input
                      type="date"
                      dir="ltr"
                      value={upcomingDate}
                      min={shiftDay(today, 2)}
                      aria-label={copy.a11y.newTaskDate}
                      onChange={(e) => e.target.value && setUpcomingDate(e.target.value)}
                      className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-text-2 outline-none transition-colors focus:border-blue/45 focus:ring-2 focus:ring-blue/20"
                    />
                  )}
                </div>
              )}
            </div>
          </Section>
        );
      })}

      <UndoToast />
    </>
  );
}
