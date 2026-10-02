import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TagTone = "neutral" | "success" | "warning" | "danger" | "accent" | TileTone;
export type TileTone = "red" | "pink" | "green" | "violet" | "yellow" | "cyan" | "orange" | "magenta";
export type TagVariant = "outline" | "solid" | "soft";
export type TagSize = "sm" | "md" | "lg";

const OUTLINE: Record<TagTone, string> = {
  neutral: "border-hairline text-ink-secondary",
  success: "border-success/60 text-success",
  warning: "border-warning/60 text-warning",
  danger: "border-danger/60 text-danger",
  accent: "border-ink text-ink",
  red: "border-tile-red/70 text-tile-red",
  pink: "border-tile-pink/70 text-tile-pink",
  green: "border-tile-green/70 text-tile-green",
  violet: "border-tile-violet/70 text-tile-violet",
  yellow: "border-tile-yellow/70 text-tile-yellow",
  cyan: "border-tile-cyan/70 text-tile-cyan",
  orange: "border-tile-orange/70 text-tile-orange",
  magenta: "border-tile-magenta/70 text-tile-magenta",
};

// Solid tags are tiles: a flat fill with the tile's own lettering. The
// semantic tones go through .bg-success/.bg-danger so each skin's ink token
// decides the lettering.
const SOLID: Record<TagTone, string> = {
  neutral: "border-control bg-control text-ink",
  success: "border-success bg-success",
  warning: "border-warning bg-warning text-[#0a0a0a]",
  danger: "border-danger bg-danger",
  accent: "border-accent bg-accent",
  red: "border-tile-red bg-tile-red text-tile-ink",
  pink: "border-tile-pink bg-tile-pink text-tile-ink",
  green: "border-tile-green bg-tile-green text-tile-ink",
  violet: "border-tile-violet bg-tile-violet text-white",
  yellow: "border-tile-yellow bg-tile-yellow text-tile-ink",
  cyan: "border-tile-cyan bg-tile-cyan text-tile-ink",
  orange: "border-tile-orange bg-tile-orange text-tile-ink",
  magenta: "border-tile-magenta bg-tile-magenta text-tile-ink",
};

const SOFT: Record<TagTone, string> = {
  neutral: "border-transparent bg-raised text-ink-secondary",
  success: "border-transparent bg-success/12 text-success",
  warning: "border-transparent bg-warning/12 text-warning",
  danger: "border-transparent bg-danger/12 text-danger",
  accent: "border-transparent bg-raised text-ink",
  red: "border-transparent bg-tile-red/15 text-tile-red",
  pink: "border-transparent bg-tile-pink/15 text-tile-pink",
  green: "border-transparent bg-tile-green/15 text-tile-green",
  violet: "border-transparent bg-tile-violet/20 text-tile-violet",
  yellow: "border-transparent bg-tile-yellow/15 text-tile-yellow",
  cyan: "border-transparent bg-tile-cyan/15 text-tile-cyan",
  orange: "border-transparent bg-tile-orange/15 text-tile-orange",
  magenta: "border-transparent bg-tile-magenta/15 text-tile-magenta",
};

const SIZE: Record<TagSize, string> = {
  sm: "h-[18px] px-1.5 text-[9.5px]",
  md: "h-5 px-2 text-[10.5px]",
  // The verdict size: the largest type on a result card.
  lg: "h-8 px-3 text-[15px] tracking-[0.1em]",
};

export function tagClass({
  tone = "neutral",
  variant = "outline",
  size = "md",
  className,
}: { tone?: TagTone; variant?: TagVariant; size?: TagSize; className?: string } = {}): string {
  const palette = variant === "solid" ? SOLID : variant === "soft" ? SOFT : OUTLINE;
  return cn(
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap border font-mono font-medium uppercase leading-none tracking-[0.08em]",
    palette[tone],
    SIZE[size],
    className,
  );
}

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
  variant?: TagVariant;
  size?: TagSize;
  children?: ReactNode;
}

/** Mono, uppercase status label. `solid` renders a word tile. */
export function Tag({ tone, variant, size, className, ...props }: TagProps) {
  return <span className={tagClass({ tone, variant, size, className })} {...props} />;
}
