"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/** Static class names, so Tailwind's scanner can see every one of them. */
const CLAMP = { 2: "line-clamp-2", 3: "line-clamp-3" } as const;

/**
 * Click the words, change the words. On paper you don't open a dialog to fix a
 * typo. Enter commits, Escape reverts, blur commits.
 *
 * `multiline` is for a free-text body (a task's notes) rather than a name, and
 * changes exactly two things. Shift+Enter breaks a line, while plain Enter
 * still commits, so the app keeps one rule for "I'm done" everywhere. And an
 * empty commit goes through as `""` instead of being dropped: a title can
 * never be empty, so ignoring an emptied title is right, but ignoring an
 * emptied note would make a note impossible to delete.
 */
export function EditableText({
  value,
  onCommit,
  className,
  placeholder,
  ariaLabel,
  disabled,
  multiline,
  clampLines,
  autoEdit,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  multiline?: boolean;
  /**
   * Clamps the *resting* text only. Editing always shows the whole thing,
   * which is how a clamped note is read in full: click it.
   */
  clampLines?: keyof typeof CLAMP;
  /** Mount already editing — for a field that was just opened in order to type. */
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(Boolean(autoEdit));
  // only meaningful while editing — the committed value is what gets rendered
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  // grow to fit, so a long title wraps instead of scrolling
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !editing) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next === value) return;
    if (next || multiline) onCommit(next);
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Shift+Enter in a multiline field falls through to the textarea's
          // own newline; everything else that is Enter means "done".
          if (e.key === "Enter" && !(multiline && e.shiftKey)) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className={cn("bare-input block overflow-hidden", className)}
      />
    );
  }

  return (
    <span
      role="textbox"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      onClick={() => !disabled && startEditing()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          startEditing();
        }
      }}
      className={cn(
        // No `block` alongside a clamp: `line-clamp-*` sets its own
        // `display: -webkit-box`, and the two would race.
        clampLines ? CLAMP[clampLines] : "block",
        "cursor-text whitespace-pre-wrap break-words text-start outline-none",
        "rounded-sm focus-visible:ring-2 focus-visible:ring-blue/35",
        !value && "text-text-3",
        className,
      )}
    >
      {value || placeholder}
    </span>
  );
}
