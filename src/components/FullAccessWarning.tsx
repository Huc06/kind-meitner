import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export const FULL_ACCESS_WARNING =
  "This bot can read, edit, delete files, use the internet, and control its selected computer without asking—even for potentially destructive or sensitive actions. This also applies to scheduled work and tasks delegated by your Chief or other bots. It does not enable Full access on other bots. Some providers may still require approval. Questions and separate kind-meitner confirmations still wait for you. This does not grant operating-system permissions or access to accounts you have not connected.";

export function FullAccessWarning({
  open,
  onCancel,
  onConfirm,
  scope = "bot",
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  scope?: "bot" | "thread";
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05050a]/75 p-6 backdrop-blur-[2px] animate-view-enter"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="full-access-warning-title"
        aria-describedby="full-access-warning-body"
        className="relative w-full max-w-[440px] border border-danger/60 bg-card p-5 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert size={19} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <h2 id="full-access-warning-title" className="text-[15px] font-semibold text-ink">
              Enable Full access?
            </h2>
            <p id="full-access-warning-body" className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
              {scope === "thread"
                ? "Enable Full access for this thread only, including work delegated here. It can read, edit and delete files, use the internet, and control its selected computer without asking—even for destructive or sensitive actions. The bot default and other threads keep their approval levels. Provider safety restrictions, questions and separate kind-meitner confirmations still apply."
                : FULL_ACCESS_WARNING}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
          >
            Enable full access
          </Button>
        </div>
      </div>
    </div>
  );
}
