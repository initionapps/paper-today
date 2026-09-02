"use client";

/**
 * The only place an unsaved change becomes visible.
 *
 * A write that failed leaves the screen showing something the database does not
 * have. That divergence is silent by nature — the optimistic update already
 * happened, everything looks fine — so it has to be *said*, and said in a way
 * that does not clear itself. Four separate auth failures earlier in this
 * project were invisible for exactly this reason: the error existed and nothing
 * ever surfaced it.
 *
 * There is no auto-retry behind this. The queue already used its one retry; a
 * banner that quietly kept trying would be the background sync engine this
 * design deliberately does not have. The honest options are to reload the
 * server's version, or to carry on knowing the difference — so those are the
 * two the banner offers.
 */
import { useAccount, syncAccount } from "@/lib/supabase/account";
import { useWriteStatus } from "@/lib/supabase/write-queue";
import { copy } from "@/lib/copy";

export function SyncBanner() {
  const failures = useWriteStatus((s) => s.failures);
  const clearFailures = useWriteStatus((s) => s.clearFailures);
  const status = useAccount((s) => s.status);

  // Nothing to say, or nobody to say it to.
  if (failures.length === 0 || status === "signed-out") return null;

  const cancelled = failures.filter((f) => f.kind === "cancelled");
  const failed = failures.filter((f) => f.kind === "failed");

  // An account switch cancelling writes is its own story, and not a retryable
  // one — the account those writes belonged to is no longer signed in.
  const headline = failed.length > 0 ? copy.sync.failed(failed.length) : copy.sync.cancelled;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <div className="shadow-flat flex max-w-xl flex-col gap-2 rounded-xl border border-amber/40 bg-surface px-4 py-3">
        <p className="text-[13.5px] font-medium text-text">{headline}</p>
        <p className="text-[12.5px] leading-[1.5] text-text-2">{copy.sync.explain}</p>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              clearFailures();
              // `force` because the store already holds this account's data —
              // without it the loader would consider itself up to date and the
              // stale optimistic values would stay on screen.
              void syncAccount(true);
            }}
            className="cursor-pointer rounded-lg bg-blue px-3 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {copy.sync.reload}
          </button>
          <button
            type="button"
            onClick={clearFailures}
            className="cursor-pointer text-[12.5px] text-text-3 transition-colors hover:text-text-2"
          >
            {copy.sync.dismiss}
          </button>
        </div>

        {cancelled.length > 0 && failed.length > 0 && (
          <p className="pt-1 text-[11.5px] text-text-3">{copy.sync.cancelled}</p>
        )}
      </div>
    </div>
  );
}
