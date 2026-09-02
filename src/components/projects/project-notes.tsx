"use client";

import { useLayoutEffect, useRef } from "react";

import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

/**
 * The long-form room for a project: decisions, links, half-thoughts. No editor
 * chrome and no Save — you type, it's kept. Grows with what you write.
 */
export function ProjectNotes({
  projectId,
  value,
  className,
}: {
  projectId: string;
  value: string;
  className?: string;
}) {
  const updateProject = useDayStore((s) => s.updateProject);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className={className}>
      <label
        htmlFor={`notes-${projectId}`}
        className="text-[12px] font-semibold tracking-[0.05em] text-text-2"
      >
        {copy.projects.notesLabel}
      </label>
      <div
        className={cn(
          "shadow-flat mt-3 rounded-2xl border border-line-soft bg-surface px-5 py-4",
          "transition-colors focus-within:border-blue/30",
        )}
      >
        <textarea
          id={`notes-${projectId}`}
          ref={ref}
          value={value}
          placeholder={copy.projects.notesPlaceholder}
          aria-label={copy.a11y.projectNotes}
          onChange={(e) => updateProject(projectId, { notes: e.target.value })}
          className="bare-input block overflow-hidden text-[14px] leading-[1.7] text-text"
        />
      </div>
    </div>
  );
}
