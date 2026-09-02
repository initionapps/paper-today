"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";

type Variant = "big" | "medium" | "small";

const TYPE: Record<Variant, { text: string; idle: string; gap: string; gapPx: number; ring: number }> = {
  big: {
    text: "font-display text-[1.75rem] font-semibold leading-[1.35] tracking-[-0.015em]",
    idle: "text-[15px]",
    gap: "gap-4",
    gapPx: 16,
    ring: 22,
  },
  medium: {
    text: "text-[16px] font-medium leading-[1.45]",
    idle: "text-[14px]",
    gap: "gap-3",
    gapPx: 12,
    ring: 19,
  },
  small: {
    text: "text-[14px] leading-[1.5]",
    idle: "text-[13.5px]",
    gap: "gap-2.5",
    gapPx: 10,
    ring: 17,
  },
};

type ComposerProps = {
  variant: Variant;
  prompt: string;
  /** Routines use a circle, matching their checkbox. */
  shape?: "square" | "circle";
  className?: string;
} & (
  | { onAdd: (title: string) => void; notice?: undefined }
  /** A section that looks writable but isn't yet: clicking explains why. */
  | { onAdd?: undefined; notice: string }
);

/**
 * Writing straight into the layout, at the place the thing will live. No
 * dialog, no form, no Save button. Enter adds it and leaves the line open.
 */
export function InlineComposer({ variant, prompt, onAdd, notice, shape = "square", className }: ComposerProps) {
  const [active, setActive] = useState(false);
  const [noticeShown, setNoticeShown] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const type = TYPE[variant];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, active]);

  // focus after the commit that mounts the textarea, not before it
  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!noticeShown) return;
    const timer = setTimeout(() => setNoticeShown(false), 4500);
    return () => clearTimeout(timer);
  }, [noticeShown]);

  const submit = () => {
    const title = value.trim();
    if (!title) return;
    onAdd?.(title);
    setValue("");
    // stay open: you usually have more than one thing to write down
    ref.current?.focus();
  };

  if (!active) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => (notice ? setNoticeShown(true) : setActive(true))}
          className={cn(
            "group/add flex w-full cursor-text items-center py-2 text-start text-text-3 transition-colors duration-200 hover:text-text-2",
            type.gap,
          )}
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center border border-line text-[13px] leading-none transition-colors duration-200",
              "group-hover/add:border-blue/45 group-hover/add:text-blue",
              shape === "circle" ? "rounded-full" : "rounded-lg",
            )}
            style={{ width: type.ring, height: type.ring }}
          >
            +
          </span>
          <span className={type.idle}>{prompt}</span>
        </button>

        {noticeShown && notice && (
          <p
            role="status"
            className="fade-up text-[12.5px] leading-relaxed text-text-3"
            style={{ paddingInlineStart: type.ring + type.gapPx }}
          >
            {notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-start py-2", type.gap, className)}>
      <span
        className={cn(
          "mt-px shrink-0 border border-blue/45",
          shape === "circle" ? "rounded-full" : "rounded-lg",
        )}
        style={{ width: type.ring, height: type.ring }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder={prompt}
          aria-label={prompt}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setValue("");
              setActive(false);
            }
          }}
          onBlur={() => {
            if (value.trim()) submit();
            setActive(false);
          }}
          className={cn("bare-input block overflow-hidden", type.text)}
        />
        <span className="mt-1.5 block text-[11px] text-text-3">{copy.compose.hint}</span>
      </div>
    </div>
  );
}
