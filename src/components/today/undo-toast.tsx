"use client";

import { useEffect } from "react";

import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";

/**
 * Moving and archiving are the two actions that make work disappear, so both
 * are reversible for a few seconds.
 */
export function UndoToast() {
  const undo = useDayStore((s) => s.undo);
  const runUndo = useDayStore((s) => s.runUndo);
  const clearUndo = useDayStore((s) => s.clearUndo);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(clearUndo, 6000);
    return () => clearTimeout(timer);
  }, [undo, clearUndo]);

  if (!undo) return null;

  return (
    <div
      role="status"
      className="fade-up shadow-float fixed bottom-8 left-1/2 z-80 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-line-soft bg-surface px-4 py-2.5"
    >
      <span className="max-w-[46ch] truncate text-[13.5px] text-text-2">{undo.label}</span>
      <button
        type="button"
        onClick={runUndo}
        className="cursor-pointer rounded-lg px-2 py-1 text-[13px] font-semibold text-blue transition-colors hover:bg-blue-soft"
      >
        {copy.actions.undo}
      </button>
    </div>
  );
}
