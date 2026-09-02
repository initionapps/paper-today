import { cn } from "@/lib/cn";

export type SectionAccent = "blue" | "purple" | "teal" | "grey" | "lavender" | "rose";

const DOT: Record<SectionAccent, string> = {
  blue: "bg-blue",
  purple: "bg-purple",
  teal: "bg-teal",
  grey: "bg-text-3",
  lavender: "bg-purple/55",
  rose: "bg-rose",
};

/**
 * A quiet label with a coloured dot. No rule across the width — a long line is
 * the single strongest cue that you are looking at a printed document.
 * Hebrew has no uppercase, so the label leans on size, weight and colour instead.
 */
export function Section({
  title,
  accent,
  count,
  children,
  className,
}: {
  title: string;
  accent: SectionAccent;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="flex items-center gap-2.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[accent])} />
        <h2 className="text-[12px] font-semibold tracking-[0.05em] text-text-2">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="ms-auto text-[12px] tabular-nums text-text-3">{count}</span>
        )}
      </header>
      {children}
    </section>
  );
}
