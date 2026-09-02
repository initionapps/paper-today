import { AppShell } from "@/components/shell/app-shell";
import { BackupPanel } from "@/components/settings/backup-panel";
import { ImportPanel } from "@/components/settings/import-panel";
import { requireUser } from "@/lib/supabase/auth";
import { copy } from "@/lib/copy";

export default async function SettingsPage() {
  await requireUser();

  return (
    <AppShell>
      <h1 className="font-display text-[2.25rem] font-bold leading-tight tracking-[-0.022em] text-text">
        {copy.settings.title}
      </h1>

      <div className="mt-10">
        <BackupPanel />
        {/* Renders nothing at all unless this browser has data from before the
            move to accounts, so a new account's Settings page is unchanged. */}
        <ImportPanel />
      </div>
    </AppShell>
  );
}
