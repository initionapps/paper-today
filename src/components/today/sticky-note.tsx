"use client";

import { useLayoutEffect, useRef, memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";

import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { Note, NoteColor } from "@/lib/types";

export const NOTE_WIDTH = 200;

/** Cool, light tints with a matching hairline. Never post-it yellow. */
const PAPER: Record<NoteColor, string> = {
  blue: "bg-note-blue border-blue/12",
  lavender: "bg-note-lavender border-purple/12",
  mint: "bg-note-mint border-green/14",
  sky: "bg-note-sky border-teal/14",
  grey: "bg-note-grey border-line",
};

/**
 * Not a task: no checkbox, no size, no status. A loose piece of thinking you
 * can put anywhere — free position and a soft tint carry that, without tilting
 * it like a scrap of paper.
 */
function StickyNoteImpl({ note, autoFocus }: { note: Note; autoFocus?: boolean }) {
  const updateNote = useDayStore((s) => s.updateNote);
  const deleteNote = useDayStore((s) => s.deleteNote);
  const liftNote = useDayStore((s) => s.liftNote);
  const ref = useRef<HTMLTextAreaElement>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
    data: { type: "note" },
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 60)}px`;
  }, [note.body]);

  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div
      ref={setNodeRef}
      onPointerDown={() => liftNote(note.id)}
      style={{
        // Measured from the inline start edge, so notes sit the same way in RTL.
        // Clamped at render as well as on drop, so a position stored at a wide
        // viewport can't push the note out of the area on a narrow one.
        insetInlineStart: `max(0px, min(${note.x * 100}%, 100% - ${NOTE_WIDTH}px))`,
        top: `${note.y * 100}%`,
        width: NOTE_WIDTH,
        zIndex: isDragging ? 999 : note.z,
        transform: CSS.Translate.toString(transform) ?? undefined,
      }}
      className={cn(
        "group/note absolute rounded-xl border pb-3 pe-2.5 ps-3 pt-1",
        isDragging ? "shadow-drag" : "shadow-note",
        PAPER[note.color],
      )}
    >
      {/* the strip you pick it up by */}
      <div
        {...attributes}
        {...listeners}
        role="button"
        aria-label={copy.a11y.moveNote}
        className="-mx-3 -mt-1 flex h-5 cursor-grab touch-none items-center justify-center rounded-t-xl active:cursor-grabbing"
      >
        <span className="h-[3px] w-7 rounded-full bg-text/10 opacity-0 transition-opacity group-hover/note:opacity-100 no-hover:opacity-100" />
      </div>

      <button
        type="button"
        aria-label={copy.a11y.removeNote}
        onClick={() => deleteNote(note.id)}
        className="absolute end-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-text-3 opacity-0 transition-all hover:bg-text/8 hover:text-text-2 group-hover/note:opacity-100 no-hover:opacity-100"
      >
        <X size={12} strokeWidth={2.2} />
      </button>

      <textarea
        ref={ref}
        rows={1}
        value={note.body}
        placeholder={copy.notes.placeholder}
        aria-label={copy.a11y.note}
        onChange={(e) => updateNote(note.id, { body: e.target.value })}
        className="bare-input block overflow-hidden text-[13.5px] leading-[1.55] text-text/85 placeholder:text-text-3"
      />
    </div>
  );
}

/**
 * Typing in one note re-rendered every other note on the day.
 *
 * Safe because every prop is stable by construction: `task` keeps its object
 * identity unless that row actually changed, `project` comes from a memoised
 * map, and the rest are primitives. The store actions these components read are
 * stable references, so they never cause a render on their own.
 */
export const StickyNote = memo(StickyNoteImpl);
