"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EditableText } from "@/components/task/editable-text";
import { TaskRow } from "@/components/tasks/task-row";
import { Section, type SectionAccent } from "@/components/ui/section";
import { UndoToast } from "@/components/today/undo-toast";
import { projectTasks, useDayStore } from "@/lib/store/day-store";
import { useAccountReady } from "@/lib/supabase/account";
import { dateBucket, todayKey } from "@/lib/date";
import { copy } from "@/lib/copy";
import type { Task } from "@/lib/types";

import { ProjectDot } from "./project-color";
import { ProjectMenu } from "./project-menu";
import { ProjectNotes } from "./project-notes";
import { ProjectTaskComposer } from "./project-task-composer";

/** Tomorrow and everything after it read as one horizon from inside a project. */
type ProjectGroup = "overdue" | "today" | "later" | "none";

const GROUPS: { key: ProjectGroup; label: string; accent: SectionAccent }[] = [
  { key: "overdue", label: copy.buckets.overdue, accent: "rose" },
  { key: "today", label: copy.buckets.today, accent: "blue" },
  { key: "later", label: copy.projects.groupLater, accent: "teal" },
  { key: "none", label: copy.buckets.none, accent: "grey" },
];

export function ProjectView({ projectId }: { projectId: string }) {
  const [today] = useState(todayKey);
  // Supabase is the source of truth now; this is the account load, not a
  // localStorage read. See lib/supabase/account.ts.
  const hydrated = useAccountReady();

  const projects = useDayStore((s) => s.projects);
  const tasks = useDayStore((s) => s.tasks);
  const updateProject = useDayStore((s) => s.updateProject);

  const project = projects.find((p) => p.id === projectId);
  const mine = useMemo(() => projectTasks(tasks, projectId), [tasks, projectId]);

  const grouped = useMemo(() => {
    const out: Record<ProjectGroup, Task[]> = { overdue: [], today: [], later: [], none: [] };
    for (const task of mine) {
      const bucket = dateBucket(task.plannedDate, today);
      const key: ProjectGroup =
        bucket === "tomorrow" || bucket === "upcoming" ? "later" : (bucket as ProjectGroup);
      out[key].push(task);
    }
    return out;
  }, [mine, today]);

  if (!hydrated) return <div className="min-h-[70vh]" />;

  if (!project) {
    return (
      <>
        <p className="text-[15px] text-text-2">{copy.projects.notFound}</p>
        <BackLink />
      </>
    );
  }

  return (
    <>
      <BackLink />

      <header className="mt-6 flex items-start gap-3">
        <ProjectDot color={project.color} size="lg" className="mt-[15px]" />

        <div className="min-w-0 flex-1">
          <EditableText
            value={project.name}
            onCommit={(name) => updateProject(project.id, { name })}
            ariaLabel={copy.a11y.projectName}
            className="font-display text-[2.1rem] font-bold leading-tight tracking-[-0.022em] text-text"
          />
          <EditableText
            value={project.description}
            onCommit={(description) => updateProject(project.id, { description })}
            ariaLabel={copy.a11y.projectDescription}
            placeholder={copy.projects.descriptionPlaceholder}
            className="mt-2 text-[14.5px] leading-relaxed text-text-2"
          />
        </div>

        <ProjectMenu project={project} alwaysVisible className="mt-2" />
      </header>

      <ProjectNotes projectId={project.id} value={project.notes} className="mt-10" />

      <section className="mt-14">
        {mine.length === 0 && (
          <p className="text-[14.5px] text-text-3">{copy.projects.noTasks}</p>
        )}

        {GROUPS.map(({ key, label, accent }) => {
          const list = grouped[key];
          if (list.length === 0) return null;
          return (
            <Section key={key} title={label} accent={accent} count={list.length} className="mt-8 first:mt-0">
              <div className="shadow-flat mt-4 overflow-hidden rounded-2xl border border-line-soft bg-surface">
                <div className="divide-y divide-line-soft">
                  {list.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      today={today}
                      showDate={key === "later" || key === "overdue"}
                    />
                  ))}
                </div>
              </div>
            </Section>
          );
        })}

        <div className="shadow-flat mt-6 rounded-2xl border border-line-soft bg-surface py-1">
          <ProjectTaskComposer projectId={project.id} />
        </div>
      </section>

      <UndoToast />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/projects"
      className="inline-flex items-center gap-2 rounded-lg text-[13px] text-text-2 transition-colors hover:text-text"
    >
      {/* RTL: "back" points right, so the icon flips with the layout */}
      <ArrowLeft size={14} strokeWidth={1.8} className="rtl:rotate-180" />
      {copy.projects.backToProjects}
    </Link>
  );
}
