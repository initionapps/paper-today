"use client";

import { useEffect, useState } from "react";

import { useDayStore } from "@/lib/store/day-store";
import { weekdayName } from "@/lib/date";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { DayKey, Task } from "@/lib/types";

interface WrapUpProps {
  day: DayKey;
  onClose: () => void;
  unfinished: Task[];
  doneCount: number;
}

/** Mounting the panel is what resets the flow — no state to clear on open. */
export function WrapUpDay({ open, ...props }: WrapUpProps & { open: boolean }) {
  if (!open) return null;
  return <WrapUpPanel {...props} />;
}

/**
 * The end-of-day flow, and the only place work moves between days in bulk.
 * Every row needs a decision from the user — nothing rolls over on its own.
 */
function WrapUpPanel({ day, onClose, unfinished, doneCount }: WrapUpProps) {
  const moveToTomorrow = useDayStore((s) => s.moveTaskToTomorrow);
  const setPlannedDate = useDayStore((s) => s.setPlannedDate);
  const archiveTask = useDayStore((s) => s.archiveTask);
  const wrapUpDay = useDayStore((s) => s.wrapUpDay);
  const [left, setLeft] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pending = unfinished.filter((t) => !left.includes(t.id));

  const close = () => {
    wrapUpDay(day);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-90 flex items-start justify-center overflow-y-auto bg-text/20 p-5 backdrop-blur-[2px] sm:p-10"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pop-in shadow-float my-auto w-full max-w-[560px] rounded-2xl border border-line-soft bg-surface p-7 sm:p-9">
        <h2 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-text">
          {copy.wrapUp.title(weekdayName(day))}
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-text-2">
          {doneCount > 0 && <>{copy.wrapUp.finished(doneCount)} </>}
          {pending.length === 0 ? copy.wrapUp.nothingOpen : copy.wrapUp.remaining(pending.length)}
        </p>

        <ul className="mt-6 divide-y divide-line-soft">
          {pending.map((task) => (
            <li key={task.id} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] text-text">{task.title}</p>
                <span className="text-[11.5px] text-text-3">{copy.sizes[task.size]}</span>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <WrapAction onClick={() => moveToTomorrow(task.id)}>{copy.wrapUp.tomorrow}</WrapAction>
                {/* a backlog now exists, so deferring indefinitely no longer
                    means pushing the task one day at a time */}
                <WrapAction onClick={() => setPlannedDate(task.id, null)}>
                  {copy.wrapUp.toBacklog}
                </WrapAction>
                <WrapAction onClick={() => archiveTask(task.id)}>{copy.wrapUp.archive}</WrapAction>
                <WrapAction onClick={() => setLeft((ids) => [...ids, task.id])} quiet>
                  {copy.wrapUp.leave}
                </WrapAction>
              </div>
            </li>
          ))}
        </ul>

        {pending.length === 0 && (
          <p className="py-6 text-[15px] text-text-3">{copy.wrapUp.allDone}</p>
        )}

        <div className="mt-7 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-2 py-1.5 text-[13.5px] text-text-3 transition-colors hover:text-text-2"
          >
            {copy.wrapUp.notNow}
          </button>
          <button
            type="button"
            onClick={close}
            className="cursor-pointer rounded-full bg-blue px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:bg-blue/90"
          >
            {copy.wrapUp.close}
          </button>
        </div>
      </div>
    </div>
  );
}

function WrapAction({
  children,
  onClick,
  quiet,
}: {
  children: React.ReactNode;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
        quiet
          ? "text-text-3 hover:bg-canvas hover:text-text-2"
          : "border border-line text-text-2 hover:border-blue/35 hover:bg-blue-soft hover:text-blue",
      )}
    >
      {children}
    </button>
  );
}
