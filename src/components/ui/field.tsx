import type { InputHTMLAttributes, LabelHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A console field: square, inset ground, solid hairline that turns to ink
 * on focus. Exported as a string for native elements styled in place. */
export const fieldClass =
  "w-full min-w-0 border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary/70 outline-none transition-colors duration-150 hover:border-ink-secondary/60 focus:border-ink disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(fieldClass, "h-9", className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(fieldClass, "min-h-20 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={cn(fieldClass, "h-9 cursor-pointer py-0 pr-8 [color-scheme:inherit]", className)} {...props} />;
}

/** Field label in the console's label voice. */
export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("label-mono mb-1.5 block text-ink-secondary", className)} {...props} />;
}
