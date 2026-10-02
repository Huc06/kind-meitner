import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatIndex } from "./frame";

/** Section label in the console voice: `01 — TITLE`, mono, uppercase. */
export function Eyebrow({
  index,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { index?: string | number; children: ReactNode }) {
  return (
    <div className={cn("label-mono flex items-center gap-2 text-ink-secondary", className)} {...props}>
      {index !== undefined && <span className="text-ink">{formatIndex(index)}</span>}
      {index !== undefined && <span aria-hidden className="h-px w-4 bg-hairline" />}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

/** Keyboard key cap. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center border border-hairline bg-inset px-1 font-mono text-[10px] font-medium text-ink-secondary",
        className,
      )}
      {...props}
    />
  );
}
