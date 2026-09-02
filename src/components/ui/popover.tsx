"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

/** Distance from the trigger, and the minimum breathing room at a screen edge. */
const GAP = 8;
const EDGE = 8;

interface Position {
  top: number;
  left: number;
}

/**
 * A small panel anchored to its trigger. Deliberately *not* a dialog: it does
 * not trap focus, dim the page, or block the content behind it.
 *
 * It renders through a portal into `<body>` and positions itself with fixed
 * coordinates. Anchoring it absolutely inside the trigger's own card was the
 * obvious approach and was wrong: several cards use `overflow-hidden` to clip
 * a rounded accent strip, and that clipped the menu too. A portal means no
 * ancestor can ever crop it, whatever those cards do later.
 */
interface PopoverProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Logical, so the panel hangs the right way in both RTL and LTR. */
  align?: "start" | "end";
  className?: string;
  /**
   * While `.current` is true, a pointerdown outside the panel is ignored —
   * Escape still closes it. For content whose own picker renders outside our
   * DOM tree (`<input type="date">`'s calendar): those clicks may report a
   * target this panel doesn't recognise as "inside", or may report none at
   * all, closing the whole menu before a day is ever chosen. A ref, not a
   * prop, so flipping it doesn't re-subscribe the listener on every focus and
   * blur.
   */
  suspendCloseRef?: React.RefObject<boolean>;
}

/** Mounting the panel is what resets its measurement — no state to clear. */
export function Popover({ open, ...props }: PopoverProps & { open: boolean }) {
  if (!open) return null;
  return <PopoverPanel {...props} />;
}

function PopoverPanel({ onClose, children, align = "end", className, suspendCloseRef }: PopoverProps) {
  // stays in the normal tree purely so we can find the trigger's wrapper
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current?.parentElement;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";

    // `align: end` pins the panel's inline-end edge to the trigger's
    const alignStart = align === "start";
    let left = rtl
      ? alignStart
        ? a.right - p.width
        : a.left
      : alignStart
        ? a.left
        : a.right - p.width;
    left = Math.min(Math.max(EDGE, left), window.innerWidth - p.width - EDGE);

    // below by default; above when there is no room and above has some
    let top = a.bottom + GAP;
    if (top + p.height > window.innerHeight - EDGE) {
      const above = a.top - GAP - p.height;
      top = above > EDGE ? above : Math.max(EDGE, window.innerHeight - p.height - EDGE);
    }

    setPosition({ top, left });
  }, [align]);

  // measure before paint so the panel never flashes at the wrong spot
  useLayoutEffect(place, [place]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (suspendCloseRef?.current) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.parentElement?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // capture, so a scrolling container's own scroll is caught too
    const onReflow = () => place();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [onClose, place, suspendCloseRef]);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      {typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              // hidden for the one frame between mounting and measuring
              visibility: position ? "visible" : "hidden",
            }}
            className={cn(
              "pop-in shadow-float z-50 w-56 rounded-xl border border-line-soft bg-surface p-1.5",
              "max-h-[80vh] overflow-y-auto",
              className,
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

export function PopoverItem({
  onClick,
  children,
  tone = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] transition-colors",
        tone === "danger" ? "text-rose hover:bg-rose/8" : "text-text-2 hover:bg-canvas hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function PopoverLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold tracking-[0.04em] text-text-3">
      {children}
    </div>
  );
}
