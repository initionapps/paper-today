import { AppShell } from "@/components/shell/app-shell";
import { AllTasksView } from "@/components/tasks/all-tasks-view";
import { requireUser } from "@/lib/supabase/auth";

export default async function AllTasksPage() {
  await requireUser();

  return (
    <AppShell>
      <AllTasksView />
    </AppShell>
  );
}
