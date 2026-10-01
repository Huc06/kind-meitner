// Small pieces every beat of the welcome flow shares, so the beats read as
// one surface: the same input, the same primary button.
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { MausMotion, MausState } from "@/lib/mascot";

/** What a beat can do to the flow around it. Every beat can move on or be
 * skipped; the guide mascot is shared, so a beat borrows it rather than
 * owning one. */
export interface BeatProps {
  onNext: () => void;
  /** Same destination as onNext; separate so analytics can tell them apart. */
  onSkip: () => void;
  setMascot: (state: MausState) => void;
  /** Fire a one-shot motion on the guide (`success`, `celebrate`, …). */
  bump: (motion: Exclude<MausMotion, "none">) => void;
}

export const inputClass = fieldClass;

/** Index for the `.stagger` utility; each sibling arrives 40ms after the last. */
export function staggerIndex(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

export function PrimaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="primary"
      size="md"
      data-primary=""
      className={cn("w-full", className)}
      {...rest}
    >
      {children}
    </Button>
  );
}

export function QuietButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-ink-secondary", className)}
      {...rest}
    >
      {children}
    </Button>
  );
}

