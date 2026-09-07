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
         * Dana Yad — a genuine handwriting face, ships one weight only, so
         * there is no `font-light`/`font-bold` to ask for; `hand-bold` (see
         * globals.css) thickens the strokes by a fraction of a pixel instead,
         * since the shipped weight read as too thin at this size.
         *
         * Tracking: reversed from "none" to "noticeably more" on request, and
         * actually checked this time rather than assumed — at 0.05em the
         * letters open up clearly without the word falling apart; past roughly
         * 0.08em (tested up to 0.12em) they stop reading as one written word
         * and start looking like separate stamped glyphs. Word-spacing gets
         * its own, larger value on top, so the gap *between* words opens more
         * than the gap within one — spacing that treats every gap alike reads
         * as mechanical, not handwritten. Sized up slightly (21→22, 24→26) to
         * carry the wider spacing without looking sparse.
         *
         * Colour: plain `text-2`, no hover recolour — `text-2` was already
         * what hover switched to, and turned out to be the better resting
         * colour outright.
         */
        className="font-quote hand-bold mx-auto max-w-[46ch] text-center text-[22px] leading-[1.7] tracking-[0.05em] [word-spacing:0.12em] text-text-2 sm:text-[26px]"
      />
    </div>
  );
}
