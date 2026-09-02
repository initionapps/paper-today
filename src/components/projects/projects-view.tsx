"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EditableText } from "@/components/task/editable-text";
import { InlineComposer } from "@/components/today/inline-composer";
import { UndoToast } from "@/components/today/undo-toast";
import { activeProjects, archivedProjects, projectTasks, useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { Project, Task } from "@/lib/types";

import { ProjectDot } from "./project-color";
import { ProjectMenu } from "./project-menu";

export function ProjectsView() {
  const [hydrated, setHydrated] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    Promise.resolve(useDayStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);

  const projects = useDayStore((s) => s.projects);
  const tasks = useDayStore((s) => s.tasks);
  const addProject = useDayStore((s) => s.addProject);

  const active = useMemo(() => activeProjects(projects), [projects]);
  const archived = useMemo(() => archivedProjects(projects), [projects]);

  if (!hydrated) return <div className="min-h-[70vh]" />;

  return (
    <>
      <header>
        <h1 className="font-display text-[2.25rem] font-bold leading-tight tracking-[-0.022em] text-text">
          {copy.projects.title}
        </h1>
        <p className="mt-1.5 text-[14px] text-text-2">{copy.projects.subtitle(active.length)}</p>
      </header>

      {active.length === 0 && <p className="mt-10 text-[15px] text-text-3">{copy.projects.empty}</p>}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {active.map((project) => (
          <ProjectCard key={project.id} project={project} tasks={tasks} />
        ))}
      </div>

      <div className="mt-4">
        <InlineComposer
          variant="medium"
          prompt={copy.projects.add}
          onAdd={(name) => addProject(name)}
        />
      </div>

      {archived.length > 0 && (
        <section className="mt-16">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="cursor-pointer text-[12.5px] text-text-3 transition-colors hover:text-text-2"
          >
            {showArchived ? copy.projects.hideArchived : copy.projects.showArchived(archived.length)}
          </button>

          {showArchived && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {archived.map((project) => (
                <ProjectCard key={project.id} project={project} tasks={tasks} />
              ))}
            </div>
          )}
        </section>
      )}

      <UndoToast />
    </>
  );
}

/**
 * Name and description are edited in place; the colour and archiving live in
 * the menu. The card is not itself a link — an editable field inside a link is
 * a trap — so opening the project is its own explicit affordance.
 */
function ProjectCard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const updateProject = useDayStore((s) => s.updateProject);
  const openCount = projectTasks(tasks, project.id).length;
  const isArchived = project.archivedAt !== null;

  return (
    <article
      className={cn(
        "shadow-flat group relative rounded-2xl border border-line-soft bg-surface px-5 py-4 transition-all duration-300",
        isArchived ? "opacity-60" : "hover:border-blue/25",
      )}
    >
      <div className="flex items-start gap-3">
        <ProjectDot color={project.color} size="md" className="mt-[7px]" />

        <div className="min-w-0 flex-1">
          <EditableText
            value={project.name}
            onCommit={(name) => updateProject(project.id, { name })}
            ariaLabel={copy.a11y.projectName}
            className="text-[17px] font-semibold leading-snug text-text"
          />
          <EditableText
            value={project.description}
            onCommit={(description) => updateProject(project.id, { description })}
            ariaLabel={copy.a11y.projectDescription}
            placeholder={copy.projects.descriptionPlaceholder}
            className="mt-1 text-[13.5px] leading-relaxed text-text-2"
          />
        </div>

        <ProjectMenu project={project} className="-mt-0.5" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[12px] text-text-3">
          {isArchived ? copy.projects.archivedLabel : copy.projects.taskCount(openCount)}
        </span>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-medium text-blue transition-colors hover:bg-blue-soft"
        >
          {copy.projects.open}
          {/* RTL: "forward" points left, so the icon needs no flip here */}
          <ArrowLeft size={13} strokeWidth={2} />
        </Link>
      </div>
    </article>
  );
}
