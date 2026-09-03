"use client";

import { EditableText } from "@/components/task/editable-text";
import { useDayStore } from "@/lib/store/day-store";
import { copy } from "@/lib/copy";

/**
 * A brief personal pause between the date and the work.
 *
 * One standing line, not a note per day: it carries forward until it is
 * changed. It reuses the same click-to-edit behaviour as every other piece of
 * text in the app — Enter or blur saves, Escape restores — so there is nothing
 * new to learn and no Edit button to add. Its only distinction is typographic.
 */
export function MottoLine() {
  const motto = useDayStore((s) => s.motto);
  const setMotto = useDayStore((s) => s.setMotto);

  return (
    <div className="mb-3 mt-5 px-0 sm:mb-4 sm:mt-10 sm:px-4">
      <EditableText
        value={motto}
        onCommit={setMotto}
        ariaLabel={copy.motto.label}
        placeholder={copy.motto.placeholder}
        /*
         * Gveret Levin ships a single weight and no browser synthesises a
         * lighter one, so the lightness is built from everything else: a
         * smaller size, the paler grey, open leading, a touch of tracking —
         * Hebrew letters don't join, so a little air between them reads as calm
         * rather than broken — and `hand-thin`, which shaves the strokes with a
         * hairline stroke in the page colour.
         */
        // deliberately between --color-text-3 and --color-text-2: the thinned
        // strokes carry the lightness now, so the colour doesn't have to
        className="font-hand hand-thin mx-auto max-w-[44ch] text-center text-[19px] font-normal leading-[1.8] tracking-[0.01em] text-[#848b98] transition-colors hover:text-text-2 sm:text-[21.5px]"
      />
    </div>
  );
}
