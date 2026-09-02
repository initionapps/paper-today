"use client";

import { useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";

import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";
import type { DayKey, Note } from "@/lib/types";

import { Section } from "@/components/ui/section";
import { NOTE_WIDTH, StickyNote } from "./sticky-note";

const AREA_HEIGHT = 300;
const NOTE_HEIGHT_GUESS = 118;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Freeform corner of the day. Notes live at arbitrary x/y and have their own
 * DndContext, so they never take part in task sorting.
 *
 * x is stored as a fraction from the *inline start* edge, so the same number
 * means "just inside the margin" in both RTL and LTR.
 */
export function NotesArea({ day, notes }: { day: DayKey; notes: Note[] }) {
  const addNote = useDayStore((s) => s.addNote);
  const updateNote = useDayStore((s) => s.updateNote);
  const areaRef = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const isRtl = () =>
    !!areaRef.current && getComputedStyle(areaRef.current).direction === "rtl";

  const maxX = () => {
    const width = areaRef.current?.clientWidth ?? 1;
    return Math.max(0, 1 - NOTE_WIDTH / width);
  };
  const maxY = () => Math.max(0, 1 - NOTE_HEIGHT_GUESS / AREA_HEIGHT);

  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    const area = areaRef.current;
    const note = notes.find((n) => n.id === active.id);
    if (!area || !note) return;
    // dragging right *decreases* the inline-start offset in RTL
    const dx = (isRtl() ? -delta.x : delta.x) / area.clientWidth;
    updateNote(note.id, {
      x: clamp(note.x + dx, 0, maxX()),
      y: clamp(note.y + delta.y / AREA_HEIGHT, 0, maxY()),
    });
  };

  // clicking empty space starts a note there — the same gesture as the task
  // composers, but without a line to write on
  const onAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fromStart = isRtl() ? rect.right - e.clientX : e.clientX - rect.left;
    const x = clamp((fromStart - NOTE_WIDTH / 2) / rect.width, 0, maxX());
    const y = clamp((e.clientY - rect.top - 12) / AREA_HEIGHT, 0, maxY());
    setFocusId(addNote(day, x, y));
  };

  return (
    <Section title={copy.sections.notes} accent="lavender" className="mt-16">
      <DndContext sensors={sensors} modifiers={[restrictToParentElement]} onDragEnd={onDragEnd}>
        <div
          ref={areaRef}
          onClick={onAreaClick}
          style={{ height: AREA_HEIGHT }}
          className="relative mt-5 cursor-copy rounded-2xl"
        >
          {notes.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-12 text-center text-[14px] text-text-3">
              {copy.notes.empty}
            </p>
          )}
          {notes.map((note) => (
            <StickyNote key={note.id} note={note} autoFocus={note.id === focusId} />
          ))}
        </div>
      </DndContext>
    </Section>
  );
}
