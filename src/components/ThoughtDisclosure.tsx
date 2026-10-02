import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ThoughtDisclosureProps {
  thinking?: boolean;
  durationSeconds?: number;
  summary?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

/** Cybernetic console reasoning disclosure. */
export function ThoughtDisclosure({
  thinking = false,
  durationSeconds,
  summary,
  children,
  defaultOpen = false,
}: ThoughtDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  const label = thinking
    ? "[ THINKING ]"
    : summary
      ? `[ THOUGHT · ${summary} ]`
      : durationSeconds !== undefined
        ? `[ THOUGHT · ${durationSeconds.toFixed(1)}s ]`
        : "[ REASONING ]";

  return (
    <div className="my-2 border border-hairline bg-inset">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-pointer flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left font-mono text-[11px] text-ink-secondary transition-colors hover:bg-raised-hover hover:text-ink"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <span className={cn(thinking ? "text-ink font-semibold" : "text-ink-secondary")}>
            {label}
          </span>
          {thinking && (
            <span className="size-1.5 shrink-0 rounded-full bg-accent animate-status-pulse" />
          )}
        </span>
        <ChevronRight
          size={12}
          className={cn(
            "shrink-0 text-ink-secondary transition-transform duration-150 ease-out",
            open && "rotate-90"
          )}
        />
      </button>
      {open && children && (
        <div className="border-t border-hairline bg-card/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-secondary whitespace-pre-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
