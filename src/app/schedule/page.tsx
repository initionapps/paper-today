import { AppShell } from "@/components/shell/app-shell";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { requireUser } from "@/lib/supabase/auth";

export default async function SchedulePage() {
  await requireUser();

  return (
    <AppShell wide>
      <ScheduleView />
    </AppShell>
  );
}
