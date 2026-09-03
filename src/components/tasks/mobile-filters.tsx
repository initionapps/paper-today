"use client";

/**
 * All Tasks' filtering, on a phone.
 *
 * The desktop version is three rows of pills — date, size, project — always on
 * screen. At 360px that is a wall of chips above the list: with five projects
 * it runs to six wrapped lines and pushes the first task below the fold, which
 * is the wrong trade for controls most people touch occasionally.
 *
 * So on phones the same filters move behind one `סינון` button, with a search
 * field beside it for the thing people actually reach for most. What is *on*
 * shows as chips underneath — but only while something is on, so an unfiltered
 * list costs no vertical space at all.
 *
 * Desktop renders `FilterBar` exactly as before; this component is `sm:hidden`.
 */
import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  NO_FILTERS,
  isFiltering,
  type Filters,
  type ProjectFilter,
} from "./filter-bar";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { DATE_BUCKETS, TASK_SIZES, type Project } from "@/lib/types";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const countActive = (f: Filters) => f.sizes.length + f.projects.length + f.buckets.length;

export function MobileFilters({
  filters,
  onChange,
  projects,
  query,
  onQueryChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  projects: Project[];
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = countActive(filters);
  const projectName = (id: ProjectFilter) =>
    id === null ? copy.actions.noProject : (projects.find((p) => p.id === id)?.name ?? "");

  return (
    <div className="mt-4 sm:hidden">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {/* RTL: the icon sits at the inline start, so padding is `ps` */}
          <Search
            size={16}
            strokeWidth={1.9}
            className="pointer-events-none absolute inset-y-0 start-3 my-auto text-text-3"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={copy.allTasks.search}
            aria-label={copy.allTasks.search}
            className={cn(
              "h-11 w-full rounded-full border border-line bg-surface ps-9 pe-3",
              "text-[14px] text-text outline-none placeholder:text-text-3",
              "focus:border-blue/35",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label={copy.allTasks.searchClear}
              className="absolute inset-y-0 end-1 my-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-text-3"
            >
              <X size={15} strokeWidth={1.9} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={cn(
            "flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5",
            "text-[13.5px] font-medium transition-colors",
            active > 0
              ? "border-blue/35 bg-blue-soft text-blue"
              : "border-line bg-surface text-text-2",
          )}
        >
          <SlidersHorizontal size={15} strokeWidth={1.9} />
          {copy.allTasks.filterAction}
          {active > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue px-1 text-[11px] font-semibold text-white tabular-nums">
              {active}
            </span>
          )}
        </button>
      </div>

      {/* Only present while something is on — an unfiltered list pays nothing. */}
      {active > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="sr-only">{copy.allTasks.activeFilters}</span>
          {filters.buckets.map((b) => (
            <Chip key={`b-${b}`} onRemove={() => onChange({ ...filters, buckets: toggle(filters.buckets, b) })}>
              {copy.buckets[b]}
            </Chip>
          ))}
          {filters.sizes.map((s) => (
            <Chip key={`s-${s}`} onRemove={() => onChange({ ...filters, sizes: toggle(filters.sizes, s) })}>
              {copy.sizes[s]}
            </Chip>
          ))}
          {filters.projects.map((p) => (
            <Chip key={`p-${p ?? "none"}`} onRemove={() => onChange({ ...filters, projects: toggle(filters.projects, p) })}>
              {projectName(p)}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="rounded-lg px-1.5 py-1 text-[12.5px] font-medium text-blue"
          >
            {copy.allTasks.clearFilters}
          </button>
        </div>
      )}

      {sheetOpen && (
        <FilterSheet
          filters={filters}
          onChange={onChange}
          projects={projects}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-blue/35 bg-blue-soft py-1 pe-1 ps-2.5 text-[12.5px] text-blue">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${copy.allTasks.clearFilters}: ${typeof children === "string" ? children : ""}`}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
      >
        <X size={12} strokeWidth={2.2} />
      </button>
    </span>
  );
}

/** The three groups, full width, with targets you can hit with a thumb. */
function FilterSheet({
  filters,
  onChange,
  projects,
  onClose,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  projects: Project[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-text/25 backdrop-blur-[2px] sm:hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={copy.allTasks.filterSheetTitle}
    >
      <div
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-line-soft bg-surface"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" />

        <div className="sticky top-0 flex items-center justify-between bg-surface px-4 pb-2 pt-3">
          <h2 className="text-[15px] font-semibold text-text">{copy.allTasks.filterSheetTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.mobileNav.close}
            className="-me-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-text-3"
          >
            <X size={19} strokeWidth={1.9} />
          </button>
        </div>

        <div className="space-y-5 px-4 pb-4">
          <Group label={copy.allTasks.filterDate}>
            {DATE_BUCKETS.map((b) => (
              <SheetPill
                key={b}
                active={filters.buckets.includes(b)}
                onClick={() => onChange({ ...filters, buckets: toggle(filters.buckets, b) })}
              >
                {copy.buckets[b]}
              </SheetPill>
            ))}
          </Group>

          <Group label={copy.allTasks.filterSize}>
            {TASK_SIZES.map((s) => (
              <SheetPill
                key={s}
                active={filters.sizes.includes(s)}
                onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, s) })}
              >
                {copy.sizes[s]}
              </SheetPill>
            ))}
          </Group>

          {projects.length > 0 && (
            <Group label={copy.allTasks.filterProject}>
              {projects.map((p) => (
                <SheetPill
                  key={p.id}
                  active={filters.projects.includes(p.id)}
                  onClick={() => onChange({ ...filters, projects: toggle(filters.projects, p.id) })}
                >
                  {p.name}
                </SheetPill>
              ))}
              <SheetPill
                active={filters.projects.includes(null)}
                onClick={() => onChange({ ...filters, projects: toggle(filters.projects, null) })}
              >
                {copy.actions.noProject}
              </SheetPill>
            </Group>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-line-soft bg-surface px-4 py-3">
          {isFiltering(filters) && (
            <button
              type="button"
              onClick={() => onChange(NO_FILTERS)}
              className="h-11 cursor-pointer rounded-full px-3 text-[13.5px] font-medium text-text-3"
            >
              {copy.allTasks.clearFilters}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ms-auto h-11 flex-1 cursor-pointer rounded-full bg-blue px-5 text-[14px] font-semibold text-white"
          >
            {copy.allTasks.filterApply}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-[0.03em] text-text-3">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SheetPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-[40px] cursor-pointer rounded-full border px-3.5 text-[13.5px] transition-colors",
        active
          ? "border-blue/35 bg-blue-soft text-blue"
          : "border-line bg-surface text-text-2",
      )}
    >
      {children}
    </button>
  );
}
