import { useEffect, type HTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIndex } from "./frame";

let activeModalCount = 0;
let previousActiveElement: HTMLElement | null = null;

export function useModalA11y(active = true, onDismiss?: () => void) {
  useEffect(() => {
    if (!active) return;

    if (activeModalCount === 0) {
      previousActiveElement = (document.activeElement as HTMLElement) ?? null;
      const elements = Array.from(document.querySelectorAll<HTMLElement>("main, aside, [data-app-shell]"));
      elements.forEach((el) => el.setAttribute("inert", ""));
    }
    activeModalCount++;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onDismiss) {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      activeModalCount--;
      if (activeModalCount <= 0) {
        activeModalCount = 0;
        const elements = Array.from(document.querySelectorAll<HTMLElement>("main, aside, [data-app-shell]"));
        elements.forEach((el) => el.removeAttribute("inert"));
        if (previousActiveElement && typeof previousActiveElement.focus === "function") {
          try {
            previousActiveElement.focus();
          } catch {}
        }
      }
    };
  }, [active, onDismiss]);
}

/** Full-viewport scrim. Presentational only: each dialog keeps its own focus
 * trap, Escape handling and portal, which differ per surface and are tested
 * there. `onDismiss` fires only for a press on the scrim itself. */
export function DialogBackdrop({
  className,
  onDismiss,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { onDismiss?: () => void }) {
  useModalA11y(true, onDismiss);
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[#05050a]/70 p-4 backdrop-blur-[2px] animate-view-enter",
        className,
      )}
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        if (onDismiss && event.target === event.currentTarget) onDismiss();
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DialogPanelProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/** The dialog body: a card-ground box with a solid hairline and corner marks.
 * Square; one low shadow lifts it off the scrim. */
export function DialogPanel({ className, children, ref, ...props }: DialogPanelProps) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      className={cn(
        "relative flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] w-full sm:max-w-lg flex-col border border-hairline bg-card text-ink shadow-[0_24px_64px_-24px_rgb(0_0_0/0.6)]",
        className,
      )}
      style={{ ["--frame-surface" as string]: "var(--color-card)" }}
      {...props}
    >
      <span aria-hidden className="frame-corner" data-corner="tl" />
      <span aria-hidden className="frame-corner" data-corner="tr" />
      <span aria-hidden className="frame-corner" data-corner="bl" />
      <span aria-hidden className="frame-corner" data-corner="br" />
      {children}
    </div>
  );
}

/** Title bar: `[ 01 · TITLE ]` in the label voice, optional subtitle below,
 * close button at the end. Pass `titleId` and point the panel's
 * `aria-labelledby` at it. */
export function DialogHeader({
  title,
  titleId,
  index,
  subtitle,
  onClose,
  closeLabel = "Close",
  actions,
  className,
}: {
  title: ReactNode;
  titleId?: string;
  index?: string | number;
  subtitle?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("frame-rule-below flex shrink-0 items-start gap-3 px-5 pb-3.5 pt-4", className)}>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="label-mono text-ink">
          <span className="text-ink-secondary">[ </span>
          {index !== undefined && <span className="text-ink-secondary">{formatIndex(index)} · </span>}
          {title}
          <span className="text-ink-secondary"> ]</span>
        </h2>
        {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{subtitle}</p>}
      </div>
      {actions}
      {onClose && (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="-mr-1.5 -mt-1 inline-flex size-7 shrink-0 items-center justify-center text-ink-secondary transition-colors hover:bg-raised-hover hover:text-ink"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("frame-rule-above flex shrink-0 items-center justify-end gap-2 px-5 py-3", className)} {...props} />;
}
