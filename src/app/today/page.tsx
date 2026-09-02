import { AppShell } from "@/components/shell/app-shell";
import { TodayView } from "@/components/today/today-view";
import { requireUser } from "@/lib/supabase/auth";

export default async function TodayPage() {
  // The app-level authorization gate. The proxy already turns anonymous
  // visitors away, but that is a convenience that runs before the route; this
  // runs inside it. RLS sits underneath both.
  await requireUser();

  return (
    <AppShell>
      <TodayView />
    </AppShell>
  );
}
