"use client";

/**
 * The one-time import, as a thing the user does rather than a thing that
 * happens to them.
 *
 * The whole panel is absent unless there is local data to import — a
 * brand-new account sees nothing here, because there is nothing to say. When
 * there *is* data, nothing is written until the import button is pressed, and
 * the browser's copy is not touched until every imported row has been read back
 * and matched.
 *
 * State moves one way and never skips:
 *
 *   found → (validate) → blocked            nothing written
 *         → importing → failed              rows may be in, key untouched
 *                     → done                verified, key archived
 *
 * `failed` is a resting state, not a dead end: the same button re-runs, and
 * because every id is derived the second run inserts only what is missing.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, Download, HardDriveDownload, Trash2 } from "lucide-react";

import {
  ARCHIVE_KEY,
  backupBlob,
  discardArchive,
  getLocalSnapshot,
  getServerLocalSnapshot,
  readArchive,
  runImport,
  subscribeLocal,
  validate,
  type ImportProgress,
  type LocalData,
  type Reconciliation,
} from "@/lib/migration/local-import";
import { syncAccount, useAccount } from "@/lib/supabase/account";
import { copy } from "@/lib/copy";

/**
 * What the browser holds (`found`/`none`/`unreadable`) is read from storage,
 * not stored here. Only the states the *user* causes live in React state, and
 * they are only ever set from an event handler.
 */
type Run =
  | { at: "blocked"; data: LocalData; problems: string[] }
  | { at: "importing"; data: LocalData; progress: ImportProgress | null }
  | { at: "failed"; data: LocalData; stage: string; message: string; reconciliation?: Reconciliation }
  | { at: "done"; reconciliation: Reconciliation };

type Phase =
  | Run
  | { at: "none" }
  | { at: "unreadable"; reason: string }
  | { at: "found"; data: LocalData };

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export function ImportPanel() {
  // Subscribed, not copied: localStorage is external state, and reading it
  // through the store keeps the server render ("nothing here") and the client
  // render consistent without a set-state-on-mount cascade.
  const snapshot = useSyncExternalStore(subscribeLocal, getLocalSnapshot, getServerLocalSnapshot);

  const [run, setRun] = useState<Run | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const userId = useAccount((s) => s.userId);
  const status = useAccount((s) => s.status);

  const phase: Phase =
    run ??
    (snapshot.local.state === "none"
      ? { at: "none" }
      : snapshot.local.state === "unreadable"
        ? { at: "unreadable", reason: snapshot.local.reason }
        : { at: "found", data: snapshot.local.data });

  const start = useCallback(
    async (data: LocalData) => {
      if (!userId) return;

      // Validated on every attempt, retries included — the user may have been
      // sent away to fix something and come back.
      const problems = validate(data.slice);
      if (problems.length > 0) {
        setRun({ at: "blocked", data, problems });
        return;
      }

      setRun({ at: "importing", data, progress: null });
      const result = await runImport(userId, data.slice, (progress) =>
        setRun((p) => (p?.at === "importing" ? { ...p, progress } : p)),
      );

      if (!result.ok) {
        setRun({
          at: "failed",
          data,
          stage: result.stage,
          message: result.message,
          reconciliation: result.reconciliation,
        });
        return;
      }

      // The account is the source of truth for this data now, so read it back
      // from there rather than trusting the copy that was just sent.
      await syncAccount(true);
      setRun({ at: "done", reconciliation: result.reconciliation });
    },
    [userId],
  );

  const archived = snapshot.archived;

  // A brand-new account with nothing in this browser has no import story, so
  // the panel does not exist rather than showing an empty version of itself.
  if (phase.at === "none" && !archived) return null;

  return (
    <section className="mt-10">
      <h2 className="text-[12px] font-semibold tracking-[0.05em] text-text-2">
        {copy.importPanel.title}
      </h2>

      <div className="shadow-flat mt-4 rounded-2xl border border-line-soft bg-surface p-6">
        {phase.at === "unreadable" && (
          <p className="flex items-start gap-2 rounded-xl bg-rose/8 px-3.5 py-3 text-[13px] text-rose">
            <AlertTriangle size={15} strokeWidth={1.9} className="mt-px shrink-0" />
            <span>
              {copy.importPanel.unreadable} {phase.reason}
            </span>
          </p>
        )}

        {(phase.at === "found" || phase.at === "blocked" || phase.at === "importing" || phase.at === "failed") && (
          <>
            <p className="text-[13.5px] leading-relaxed text-text-2">{copy.importPanel.intro}</p>
            <Summary data={phase.data} />
          </>
        )}

        {phase.at === "blocked" && (
          <div className="mt-4 rounded-xl bg-amber/10 px-3.5 py-3 text-[13px] text-text-2">
            <p className="flex items-start gap-2 font-medium text-text">
              <AlertTriangle size={15} strokeWidth={1.9} className="mt-px shrink-0 text-amber" />
              {copy.importPanel.blockedTitle}
            </p>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-[12.5px]">
              {phase.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12.5px] text-text-3">{copy.importPanel.blockedHint}</p>
          </div>
        )}

        {phase.at === "failed" && (
          <div className="mt-4 rounded-xl bg-rose/8 px-3.5 py-3 text-[13px]">
            <p className="flex items-start gap-2 font-medium text-rose">
              <AlertTriangle size={15} strokeWidth={1.9} className="mt-px shrink-0" />
              {copy.importPanel.failedTitle} <span className="font-normal">({phase.stage})</span>
            </p>
            <p className="mt-1 text-[12.5px] text-text-2">{phase.message}</p>
            <p className="mt-2 text-[12.5px] text-text-3">{copy.importPanel.failedHint}</p>
            {phase.reconciliation && <ReconcileTable reconciliation={phase.reconciliation} />}
          </div>
        )}

        {phase.at === "importing" && (
          <p className="mt-4 text-[13px] text-text-2">
            {copy.importPanel.importing}
            {phase.progress && (
              <span className="text-text-3">
                {" "}
                {phase.progress.table} {phase.progress.done}/{phase.progress.total}
              </span>
            )}
          </p>
        )}

        {phase.at === "done" && (
          <>
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-green">
              <Check size={16} strokeWidth={2.2} className="shrink-0" />
              {copy.importPanel.doneTitle}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-text-2">{copy.importPanel.doneBody}</p>
            <ReconcileTable reconciliation={phase.reconciliation} />
          </>
        )}

        {/* The two buttons, in the order they should be pressed. */}
        {(phase.at === "found" || phase.at === "blocked" || phase.at === "failed") && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                download(backupBlob(phase.data.slice), `paper-today-pre-import.json`);
                setDownloaded(true);
              }}
              className="shadow-flat flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] font-medium text-text-2 transition-colors hover:border-blue/35 hover:text-blue"
            >
              <Download size={15} strokeWidth={1.9} />
              {copy.importPanel.downloadFirst}
            </button>

            <button
              type="button"
              // Retry reads the browser *again* rather than reusing the slice
              // this attempt captured. `blocked` sends the user off to fix
              // something; when they come back, "try again" has to mean the
              // data as it is now, not the data that failed.
              onClick={() =>
                void start(snapshot.local.state === "found" ? snapshot.local.data : phase.data)
              }
              disabled={status !== "ready"}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-blue px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <HardDriveDownload size={15} strokeWidth={1.9} />
              {phase.at === "failed" ? copy.importPanel.retry : copy.importPanel.runImport}
            </button>

            {downloaded && (
              <span className="text-[12.5px] text-green">{copy.importPanel.downloaded}</span>
            )}
          </div>
        )}
      </div>

      {/* Retirement. Only reachable once the import has actually succeeded —
          there is no path to a delete button from any other state. */}
      {archived && (
        <div className="shadow-flat mt-4 rounded-2xl border border-line-soft bg-surface p-6">
          <h3 className="text-[13.5px] font-medium text-text">{copy.importPanel.archiveTitle}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">
            {copy.importPanel.archiveBody}
          </p>
          <p className="mt-1 font-mono text-[11.5px] text-text-3">{ARCHIVE_KEY}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const raw = readArchive();
                if (raw) download(new Blob([raw], { type: "application/json" }), "paper-today-pre-supabase.json");
              }}
              className="shadow-flat flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] font-medium text-text-2 transition-colors hover:border-blue/35 hover:text-blue"
            >
              <Download size={15} strokeWidth={1.9} />
              {copy.importPanel.downloadArchive}
            </button>

            {confirmingDiscard ? (
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-text-2">{copy.importPanel.discardConfirm}</span>
                <button
                  type="button"
                  onClick={() => {
                    discardArchive();
                    setConfirmingDiscard(false);
                  }}
                  className="cursor-pointer rounded-full bg-rose px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose/90"
                >
                  {copy.importPanel.discardConfirmAction}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDiscard(false)}
                  className="cursor-pointer text-[12.5px] text-text-3 hover:text-text-2"
                >
                  {copy.importPanel.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDiscard(true)}
                className="flex cursor-pointer items-center gap-2 text-[12.5px] text-text-3 transition-colors hover:text-rose"
              >
                <Trash2 size={14} strokeWidth={1.9} />
                {copy.importPanel.discardArchive}
              </button>
            )}
          </div>
        </div>
      )}

    </section>
  );
}

/** Every collection, counted — including the ones that are empty. */
function Summary({ data }: { data: LocalData }) {
  const s = data.summary;
  const rows: [string, string | number][] = [
    [copy.importPanel.motto, s.motto.trim() || copy.importPanel.noMotto],
    [copy.importPanel.projects, s.projects],
    [copy.importPanel.tasks, s.tasks],
    [copy.importPanel.routines, s.routines],
    [copy.importPanel.routineLogs, s.routineLogs],
    [copy.importPanel.timeBlocks, s.timeBlocks],
    [copy.importPanel.workWindows, s.workWindows],
    [copy.importPanel.notes, s.notes],
    [copy.importPanel.dayLogs, s.dayLogs],
  ];

  return (
    <div className="mt-4 rounded-xl bg-canvas px-4 py-3">
      <p className="text-[11.5px] font-semibold tracking-[0.04em] text-text-3">
        {copy.importPanel.found}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-text-3">{label}</dt>
            <dd className="font-medium text-text tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Local against remote, per table, with anything missing called out. */
function ReconcileTable({ reconciliation }: { reconciliation: Reconciliation }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl bg-canvas px-4 py-3">
      <p className="text-[11.5px] font-semibold tracking-[0.04em] text-text-3">
        {copy.importPanel.reconcileTitle}
      </p>
      <table className="mt-2 w-full text-[12.5px]">
        <thead>
          <tr className="text-text-3">
            <th className="text-start font-normal">{copy.importPanel.reconcileTable}</th>
            <th className="text-end font-normal">{copy.importPanel.reconcileLocal}</th>
            <th className="text-end font-normal">{copy.importPanel.reconcileRemote}</th>
            <th className="text-end font-normal">{copy.importPanel.reconcileMissing}</th>
          </tr>
        </thead>
        <tbody>
          {reconciliation.rows.map((r) => (
            <tr key={r.table} className={r.missing > 0 ? "text-rose" : "text-text-2"}>
              <td className="py-0.5 font-mono text-[11.5px]">{r.table}</td>
              <td className="text-end tabular-nums">{r.local}</td>
              <td className="text-end tabular-nums">{r.remote}</td>
              <td className="text-end font-medium tabular-nums">{r.missing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
