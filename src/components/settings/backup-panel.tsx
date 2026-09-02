"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Upload } from "lucide-react";

import {
  backupFilename,
  buildBackup,
  parseBackup,
  type BackupError,
  type BackupSummary,
} from "@/lib/backup";
import { persistedSlice, useDayStore, type PersistedSlice } from "@/lib/store/day-store";
import { longDate, toDayKey } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

interface Pending {
  data: PersistedSlice;
  summary: BackupSummary;
}

/**
 * Manual local backup. Nothing leaves the machine and nothing is automatic —
 * this exists so there is a copy of the data somewhere other than one
 * browser's localStorage.
 */
export function BackupPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<BackupError | null>(null);
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.resolve(useDayStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);

  const replaceAll = useDayStore((s) => s.replaceAll);
  const tasks = useDayStore((s) => s.tasks);
  const projects = useDayStore((s) => s.projects);
  const notes = useDayStore((s) => s.notes);

  const download = () => {
    const at = new Date();
    const backup = buildBackup(persistedSlice(useDayStore.getState()), at);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename(at);
    link.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    setError(null);
    setRestored(false);
    setPending(null);
    if (!file) return;

    const result = parseBackup(await file.text());
    // nothing is touched until the user confirms what the file contains
    if (!result.ok) setError(result.error);
    else setPending({ data: result.data, summary: result.summary });
  };

  const confirmRestore = () => {
    if (!pending) return;
    replaceAll(pending.data);
    setPending(null);
    setRestored(true);
  };

  return (
    <section>
      <h2 className="text-[12px] font-semibold tracking-[0.05em] text-text-2">
        {copy.settings.backupTitle}
      </h2>

      <div className="shadow-flat mt-4 rounded-2xl border border-line-soft bg-surface p-6">
        <p className="max-w-lg text-[14px] leading-relaxed text-text-2">{copy.settings.backupIntro}</p>

        {hydrated && (
          <p className="mt-3 text-[12.5px] text-text-3">
            {copy.settings.currentData} — {copy.settings.contains(tasks.length, projects.length, notes.length)}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!hydrated}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-blue px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-blue/90 disabled:opacity-50"
          >
            <Download size={15} strokeWidth={1.9} />
            {copy.settings.download}
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!hydrated}
            className="shadow-flat flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[13.5px] font-medium text-text-2 transition-colors hover:border-blue/35 hover:text-blue disabled:opacity-50"
          >
            <Upload size={15} strokeWidth={1.9} />
            {copy.settings.restore}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              // let the same file be chosen again after an error
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose/8 px-3.5 py-3 text-[13px] text-rose">
            <AlertTriangle size={15} strokeWidth={1.9} className="mt-px shrink-0" />
            {copy.settings.errors[error]}
          </p>
        )}

        {restored && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-green/10 px-3.5 py-3 text-[13px] text-green">
            <Check size={15} strokeWidth={2.2} className="shrink-0" />
            {copy.settings.restored}
          </p>
        )}

        {pending && (
          <ConfirmRestore
            summary={pending.summary}
            onCancel={() => setPending(null)}
            onConfirm={confirmRestore}
          />
        )}
      </div>
    </section>
  );
}

/** Destructive and irreversible, so it gets a real confirmation step. */
function ConfirmRestore({
  summary,
  onCancel,
  onConfirm,
}: {
  summary: BackupSummary;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-text/20 p-5 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="pop-in shadow-float w-full max-w-[460px] rounded-2xl border border-line-soft bg-surface p-7">
        <h3 className="font-display text-[1.4rem] font-bold tracking-[-0.02em] text-text">
          {copy.settings.confirmTitle}
        </h3>

        <p className="mt-2 text-[14px] leading-relaxed text-text-2">{copy.settings.confirmBody}</p>

        <div className="mt-4 rounded-xl bg-canvas px-4 py-3 text-[12.5px] text-text-2">
          {summary.createdAt && (
            <p>{copy.settings.confirmFrom(longDate(toDayKey(new Date(summary.createdAt))))}</p>
          )}
          <p className={cn(summary.createdAt && "mt-1", "text-text-3")}>
            {copy.settings.contains(summary.tasks, summary.projects, summary.notes)}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg px-2 py-1.5 text-[13.5px] text-text-3 transition-colors hover:text-text-2"
          >
            {copy.settings.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-full bg-rose px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-rose/90"
          >
            {copy.settings.confirmRestore}
          </button>
        </div>
      </div>
    </div>
  );
}
