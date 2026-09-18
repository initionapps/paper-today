import { AppShell } from "@/components/shell/app-shell";
import { YearView } from "@/components/year/year-view";
import { requireUser } from "@/lib/supabase/auth";

/**
 * `matrix` — the widest of the three, and the only page that uses it. The
 * matrix scrolls sideways by design (its columns are sized for readable focus
 * text, not to fit twelve at once — see `AnnualMatrix`), so this width is
 * about how much of the year is in view before that scroll starts: roughly
 * eight months. See the note in `AppShell`.
 */
export default async function YearPage() {
  await requireUser();

  return (
    <AppShell width="matrix">
      <YearView />
    </AppShell>
  );
}
