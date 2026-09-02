import { AppShell } from "@/components/shell/app-shell";
import { ProjectView } from "@/components/projects/project-view";
import { requireUser } from "@/lib/supabase/auth";

// Next 16: params is a Promise and must be awaited.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  return (
    <AppShell>
      <ProjectView projectId={id} />
    </AppShell>
  );
}
