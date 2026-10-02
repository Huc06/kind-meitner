import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border font-mono font-medium uppercase tracking-[0.06em] transition-[background-color,border-color,color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-45";

const VARIANT: Record<ButtonVariant, string> = {
  // An inverted tile: the ink itself as the fill. `.bg-accent` supplies the
  // lettering colour from --color-accent-ink.
  primary: "border-accent bg-accent enabled:hover:opacity-85 enabled:active:opacity-75",
  secondary:
    "border-hairline bg-transparent text-ink enabled:hover:border-ink-secondary enabled:hover:bg-raised-hover enabled:active:bg-raised",
  ghost:
    "border-transparent bg-transparent text-ink-secondary enabled:hover:bg-raised-hover enabled:hover:text-ink enabled:active:bg-raised",
  danger: "border-danger bg-danger enabled:hover:opacity-85 enabled:active:opacity-75",
  success: "border-success bg-success enabled:hover:opacity-85 enabled:active:opacity-75",
};

const SIZE: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[10px]",
  sm: "h-7 px-2.5 text-[10.5px]",
  md: "h-8 px-3 text-[11.5px]",
  lg: "h-10 px-4 text-[12.5px]",
};

const ICON_SIZE: Record<ButtonSize, string> = {
  xs: "size-6",
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square, label-less button sized to its icon. */
  icon?: boolean;
  className?: string;
}

/** The class string alone, for anchors and other elements that should look
 * like a button without being one. */
export function buttonClass({ variant = "secondary", size = "md", icon = false, className }: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANT[variant], icon ? cn(ICON_SIZE[size], "px-0") : SIZE[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, "className"> {
  ref?: Ref<HTMLButtonElement>;
}

/** Console button: square, mono, uppercase. Text in the DOM is left as
 * written — the case is CSS — so labels stay readable to assistive tech and
 * to tests that match on copy. */
export function Button({ variant, size, icon, className, type = "button", ref, ...props }: ButtonProps) {
  return <button ref={ref} type={type} className={buttonClass({ variant, size, icon, className })} {...props} />;
}
