"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Click the words, change the words. On paper you don't open a dialog to fix a
 * typo. Enter commits, Escape reverts, blur commits.
 */
export function EditableText({
  value,
  onCommit,
  className,
  placeholder,
  ariaLabel,
  disabled,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
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
    if (next && next !== value) onCommit(next);
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
          if (e.key === "Enter") {
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
        "block cursor-text whitespace-pre-wrap break-words text-start outline-none",
        "rounded-sm focus-visible:ring-2 focus-visible:ring-blue/35",
        !value && "text-text-3",
        className,
      )}
    >
      {value || placeholder}
    </span>
  );
}
