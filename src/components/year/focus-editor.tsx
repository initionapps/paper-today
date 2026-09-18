"use client";

/**
 * Up to three lines for one focus cell — a project's own, or a goal's.
 *
 * Every operation — typing, adding, removing, reordering — ends in the same
 * call: "this cell now reads exactly this list". The caller supplies both the
 * current `items` and one `onCommit`, so this component has no idea whether it
 * is editing `monthly_focus` or `goal_monthly_focus` — that decision is made
 * once, by whoever renders it, not duplicated into a near-identical sibling
 * component for each table.
 *
 * The draft is local and the store is the truth. They are reconciled during
 * render rather than in an effect, the pattern this codebase already uses for
 * the nav pill and the date picker: when the cell's identity *or the store's
 * copy of it* changes, the draft is re-seeded. That covers the obvious case
 * (a different month is opened) and the easy-to-miss one (the account finished
 * loading, or a restore replaced everything, while this editor was mounted).
 *
 * Typing does not change the store, so a keystroke never re-seeds the draft
 * from under the cursor.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

import { MAX_FOCUS_ITEMS } from "@/lib/types";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

const SPACE = " ";
/** A space cannot appear inside a focus item, so it is a safe joiner here. */
const signature = (cellKey: string, items: string[]) => `${cellKey}|${items.join(SPACE)}`;

export function FocusEditor({
  cellKey,
  items,
  onCommit,
}: {
  /**
   * Identifies the cell for the draft-reseed check below — e.g.
   * `project:<id>:<year>:<month>` or `goal:<id>:<year>:<month>`. Opaque to
   * this component; only equality between renders matters.
   */
  cellKey: string;
  items: string[];
  onCommit: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(items);
  const [seen, setSeen] = useState(() => signature(cellKey, items));

  const current = signature(cellKey, items);
  if (seen !== current) {
    setSeen(current);
    setDraft(items);
  }

  /** The single exit. Structural edits commit at once; text waits for blur. */
  const commit = (next: string[]) => onCommit(next);

  const replace = (index: number, value: string) =>
    setDraft((d) => d.map((item, i) => (i === index ? value : item)));

  const remove = (index: number) => {
    const next = draft.filter((_, i) => i !== index);
    setDraft(next);
    commit(next);
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= draft.length) return;
    const next = [...draft];
    [next[index], next[to]] = [next[to], next[index]];
    setDraft(next);
    commit(next);
  };

  const add = () => {
    if (draft.length >= MAX_FOCUS_ITEMS) return;
    // Not committed: an empty item is not a focus item, and the store would
    // drop it anyway. It becomes real when something is typed into it.
    setDraft((d) => [...d, ""]);
  };

  return (
    <div className="mt-2.5">
      <ul className="space-y-1.5">
        {draft.map((item, index) => (
          <li key={index} className="group/item flex items-center gap-1">
            <span className="w-3 shrink-0 text-center text-[11px] tabular-nums text-text-3">
              {index + 1}
            </span>

            <input
              value={item}
              onChange={(e) => replace(index, e.target.value)}
              onBlur={() => commit(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft(items);
                }
              }}
              aria-label={copy.year.focusLabel(index + 1)}
              placeholder={copy.year.addFocus}
              autoFocus={item === ""}
              className={cn(
                "bare-input min-h-9 flex-1 rounded-md px-1 text-[13.5px] leading-snug",
                "focus:bg-canvas",
              )}
            />

            <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 no-hover:opacity-100">
              <IconButton
                label={copy.year.moveUp}
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                <ChevronUp size={14} strokeWidth={2} />
              </IconButton>
              <IconButton
                label={copy.year.moveDown}
                onClick={() => move(index, 1)}
                disabled={index === draft.length - 1}
              >
                <ChevronDown size={14} strokeWidth={2} />
              </IconButton>
              <IconButton label={copy.year.remove} onClick={() => remove(index)}>
                <X size={14} strokeWidth={2} />
              </IconButton>
            </span>
          </li>
        ))}
      </ul>

      {draft.length < MAX_FOCUS_ITEMS ? (
        <button
          type="button"
          onClick={add}
          className={cn(
            "mt-1 flex min-h-9 w-full cursor-text items-center gap-1.5 rounded-md px-1",
            "text-[13px] text-text-3 transition-colors hover:text-text-2",
          )}
        >
          <Plus size={13} strokeWidth={2} />
          {copy.year.addFocus}
        </button>
      ) : (
        // Says why there is no add button, rather than leaving its absence to
        // be inferred. The database enforces the same cap.
        <p className="mt-1.5 px-1 text-[11.5px] text-text-3">{copy.year.max}</p>
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-7 items-center justify-center rounded-md transition-colors",
        disabled
          ? "cursor-default text-text-3/30"
          : "cursor-pointer text-text-3 hover:bg-canvas hover:text-text-2",
      )}
    >
      {children}
    </button>
  );
}
