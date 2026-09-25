import { ChevronRight, Sparkles, Brain } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ThoughtDisclosureProps {
  thinking?: boolean;
  durationSeconds?: number;
  summary?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

/** React Bits Pro inspired Reasoning / Thought Disclosure accordion. */
export function ThoughtDisclosure({
  thinking = false,
  durationSeconds,
  summary,
  children,
  defaultOpen = false,
}: ThoughtDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-xl border transition-all duration-200",
        thinking
          ? "border-accent/30 bg-accent/[0.04] shadow-xs"
          : "border-hairline/50 bg-raised/30 hover:border-hairline/80"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded",
            thinking ? "text-accent animate-pulse" : "text-ink-secondary"
          )}
        >
          {thinking ? <Sparkles size={13} /> : <Brain size={13} />}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {thinking
            ? "Thinking through solution..."
            : summary
              ? summary
              : durationSeconds !== undefined
                ? `Thought for ${durationSeconds.toFixed(1)}s`
                : "Reasoning process"}
        </span>
        <ChevronRight
          size={13}
          className={cn(
            "shrink-0 text-ink-secondary/70 transition-transform duration-150 ease-out",
            open && "rotate-90"
          )}
        />
      </button>
      {open && children && (
        <div className="border-t border-hairline/40 px-3 py-2.5 text-xs leading-relaxed text-ink-secondary/90 space-y-2 bg-panel/40">
          {children}
        </div>
      )}
    </div>
  );
}
