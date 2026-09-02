import { AppShell } from "@/components/shell/app-shell";
import { ProjectsView } from "@/components/projects/projects-view";
import { requireUser } from "@/lib/supabase/auth";

export default async function ProjectsPage() {
  await requireUser();

  return (
    <AppShell>
      <ProjectsView />
    </AppShell>
  );
}
