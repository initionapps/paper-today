"use client";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { DATE_BUCKETS, TASK_SIZES, type DateBucket, type Project, type TaskSize } from "@/lib/types";

/** `null` stands for "no project", so it can be filtered like any other. */
export type ProjectFilter = string | null;

export interface Filters {
  sizes: TaskSize[];
  projects: ProjectFilter[];
  buckets: DateBucket[];
}

export const NO_FILTERS: Filters = { sizes: [], projects: [], buckets: [] };

export function isFiltering(f: Filters): boolean {
  return f.sizes.length > 0 || f.projects.length > 0 || f.buckets.length > 0;
}

/** Empty selection means "everything" — filters narrow, they never hide by default. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Three rows of small toggles. Not a filter panel, not a toolbar — the same
 * pill language as the nav, so it reads as part of the page.
 */
export function FilterBar({
  filters,
  onChange,
  projects,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  projects: Project[];
}) {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <Row label={copy.allTasks.filterDate}>
        {DATE_BUCKETS.map((bucket) => (
          <Pill
            key={bucket}
            active={filters.buckets.includes(bucket)}
            onClick={() => onChange({ ...filters, buckets: toggle(filters.buckets, bucket) })}
          >
            {copy.buckets[bucket]}
          </Pill>
        ))}
      </Row>

      <Row label={copy.allTasks.filterSize}>
        {TASK_SIZES.map((size) => (
          <Pill
            key={size}
            active={filters.sizes.includes(size)}
            onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, size) })}
          >
            {copy.sizes[size]}
          </Pill>
        ))}
      </Row>

      {projects.length > 0 && (
        <Row label={copy.allTasks.filterProject}>
          {projects.map((project) => (
            <Pill
              key={project.id}
              active={filters.projects.includes(project.id)}
              onClick={() => onChange({ ...filters, projects: toggle(filters.projects, project.id) })}
            >
              {project.name}
            </Pill>
          ))}
          <Pill
            active={filters.projects.includes(null)}
            onClick={() => onChange({ ...filters, projects: toggle(filters.projects, null) })}
          >
            {copy.actions.noProject}
          </Pill>
        </Row>
      )}

      {isFiltering(filters) && (
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          className="self-start rounded-lg px-1 py-0.5 text-[12.5px] font-medium text-blue transition-colors hover:bg-blue-soft"
        >
          {copy.allTasks.clearFilters}
        </button>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 shrink-0 text-[11.5px] text-text-3">{label}</span>
      {children}
    </div>
  );
}

function Pill({
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
        "cursor-pointer rounded-full border px-2.5 py-1 text-[12.5px] transition-colors",
        active
          ? "border-blue/35 bg-blue-soft text-blue"
          : "border-line bg-surface text-text-2 hover:border-blue/25 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
