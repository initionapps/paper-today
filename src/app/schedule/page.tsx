import { AppShell } from "@/components/shell/app-shell";
import { ScheduleView } from "@/components/schedule/schedule-view";

export default function SchedulePage() {
  return (
    <AppShell wide>
      <ScheduleView />
    </AppShell>
  );
}
