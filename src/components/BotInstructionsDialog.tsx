import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar } from "./Avatar";
import { normalizeState } from "@/lib/mascot";
import type { Bot } from "@/state/store";
export function BotInstructionsDialog({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [close]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-instructions-title"
        tabIndex={-1}
        className="animate-pop-in flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-[720px] flex-col border border-hairline bg-panel shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 frame-rule-below bg-panel px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BotAvatar
              bot={bot}
              state={normalizeState(bot.mascotExpression) ?? "idle"}
              size={36}
              motion="none"
              motionKey={0}
              animated={false}
            />
            <div className="min-w-0">
              <div className="label-mono flex items-center gap-1.5 text-ink-secondary">
                <BookOpen size={13} />
                <span>Bot instructions</span>
              </div>
              <h2 id="bot-instructions-title" className="mt-0.5 truncate text-[16px] font-semibold text-ink">
                {bot.name}
              </h2>
              {bot.title && <p className="mt-0.5 truncate text-[12px] text-ink-secondary">{bot.title}</p>}
            </div>
          </div>
          <Button
            variant="ghost"
            icon
            size="sm"
            onClick={close}
            aria-label="Close bot instructions"
          >
            <X size={16} />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {bot.description.trim() ? (
            <div className="whitespace-pre-wrap break-words border border-hairline bg-inset p-4 font-mono text-[12.5px] leading-relaxed text-ink">
              {bot.description}
            </div>
          ) : (
            <div className="border border-dashed border-hairline bg-inset px-5 py-12 text-center">
              <BookOpen size={20} className="mx-auto text-ink-secondary" />
              <p className="mt-3 text-[13px] font-medium text-ink">No instructions yet</p>
              <p className="mt-1 font-mono text-[11px] text-ink-secondary">Add them from this bot’s profile.</p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 frame-rule-above px-6 py-3 font-mono text-[11px] text-ink-secondary">
          <span>Included in this bot’s context on every turn.</span>
          <Button variant="primary" size="sm" onClick={close}>
            Done
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
