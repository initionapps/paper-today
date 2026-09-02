"use client";

import { useState } from "react";
import { Archive, MoreHorizontal, RotateCcw } from "lucide-react";

import { Popover, PopoverItem, PopoverLabel } from "@/components/ui/popover";
import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/types";

import { ColorPicker } from "./project-color";

/** Colour and archiving. Name, description and notes are edited in place. */
export function ProjectMenu({
  project,
  className,
  alwaysVisible,
}: {
  project: Project;
  className?: string;
  /** On the project page there is no row to hover, so it just stays put. */
  alwaysVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const updateProject = useDayStore((s) => s.updateProject);
  const archiveProject = useDayStore((s) => s.archiveProject);
  const restoreProject = useDayStore((s) => s.restoreProject);

  const act = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={copy.a11y.projectActions(project.name)}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-3 transition-all duration-200",
          "hover:bg-canvas hover:text-text-2",
          open || alwaysVisible
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 no-hover:opacity-100",
        )}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} className="w-60">
        <PopoverLabel>{copy.projects.color}</PopoverLabel>
        <div className="px-2.5 pb-2.5 pt-1">
          <ColorPicker
            value={project.color}
            onChange={(color) => updateProject(project.id, { color })}
          />
        </div>

        <div className="my-1 h-px bg-line-soft" />

        {project.archivedAt === null ? (
          <PopoverItem onClick={act(() => archiveProject(project.id))}>
            <Archive size={15} strokeWidth={1.7} />
            {copy.projects.archive}
          </PopoverItem>
        ) : (
          <PopoverItem onClick={act(() => restoreProject(project.id))}>
            <RotateCcw size={15} strokeWidth={1.7} />
            {copy.projects.restore}
          </PopoverItem>
        )}
      </Popover>
    </div>
  );
}
