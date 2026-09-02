import { AppShell } from "@/components/shell/app-shell";
import { BackupPanel } from "@/components/settings/backup-panel";
import { copy } from "@/lib/copy";

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="font-display text-[2.25rem] font-bold leading-tight tracking-[-0.022em] text-text">
        {copy.settings.title}
      </h1>

      <div className="mt-10">
        <BackupPanel />
      </div>
    </AppShell>
  );
}
