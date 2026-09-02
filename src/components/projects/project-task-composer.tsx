"use client";

import { useState } from "react";

import { InlineComposer } from "@/components/today/inline-composer";
import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { TASK_SIZES, type TaskSize } from "@/lib/types";

/**
 * Adding from inside a project: the project is implied, so the only thing
 * worth asking is how big it is. New tasks start with no planned date — this
 * is project capture, not day planning; a date is one click away in the menu.
 */
export function ProjectTaskComposer({ projectId }: { projectId: string }) {
  const addTask = useDayStore((s) => s.addTask);
  const [size, setSize] = useState<TaskSize>("medium");

  return (
    <div className="flex flex-wrap items-center gap-3 px-4">
      <div className="min-w-0 flex-1">
        <InlineComposer
          variant="small"
          prompt={copy.projects.addTask}
          onAdd={(title) => addTask(null, size, title, projectId)}
        />
      </div>

      <div className="flex shrink-0 gap-1" role="group" aria-label={copy.a11y.newTaskSize}>
        {TASK_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={size === option}
            onClick={() => setSize(option)}
            className={cn(
              "cursor-pointer rounded-lg border px-2 py-1 text-[11.5px] transition-colors",
              size === option
                ? "border-blue/35 bg-blue-soft text-blue"
                : "border-line text-text-3 hover:bg-canvas hover:text-text-2",
            )}
          >
            {copy.sizes[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
