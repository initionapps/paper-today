import { AppShell } from "@/components/shell/app-shell";
import { AllTasksView } from "@/components/tasks/all-tasks-view";

export default function AllTasksPage() {
  return (
    <AppShell>
      <AllTasksView />
    </AppShell>
  );
}
