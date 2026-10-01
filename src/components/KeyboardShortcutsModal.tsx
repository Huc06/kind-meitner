import { useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import {
  filterShortcutGroups,
  isMacPlatform,
  SHORTCUT_GROUPS,
  shortcutKeysForPlatform,
  type ShortcutItem,
} from "@/lib/keyboard-shortcuts";
import { Kbd } from "@/components/ui/eyebrow";
import { Button } from "@/components/ui/button";
/** Props for the KeyboardShortcutsModal component. */
export interface KeyboardShortcutsModalProps {
  /** Whether the dialog is currently visible. */
  open: boolean;
  /** Callback fired when the user requests closing the dialog. */
  onClose: () => void;
}

/**
 * Single shortcut row displaying its description and styled keycaps.
 */
function ShortcutRow({ item, isMac }: { item: ShortcutItem; isMac: boolean }) {
  const keys = shortcutKeysForPlatform(item, isMac);

  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="text-[13px] text-ink">{item.description}</span>
      <div className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <Kbd key={index}>
            {key}
          </Kbd>
        ))}
      </div>
    </div>
  );
}

/**
 * A modal cheat sheet displaying all available keyboard shortcuts categorized
 * into Navigation, Chat & Composer, and Workspace Management.
 */
export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = isMacPlatform();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    setQuery("");
    dialog.showModal();
    inputRef.current?.focus();
    // Close before unmount so the browser restores focus to the opener.
    return () => dialog.close();
  }, [open]);

  if (!open) return null;

  const groups = filterShortcutGroups(SHORTCUT_GROUPS, query, isMac);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="shortcuts-dialog-title"
      className="relative m-auto w-[min(540px,calc(100%-32px))] max-h-[85vh] overflow-hidden border border-hairline bg-card p-0 text-ink shadow-[0_24px_64px_-24px_rgb(0_0_0/0.6)] backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
      style={{ ["--frame-surface" as string]: "var(--color-card)" }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <span aria-hidden className="frame-corner" data-corner="tl" />
      <span aria-hidden className="frame-corner" data-corner="tr" />
      <span aria-hidden className="frame-corner" data-corner="bl" />
      <span aria-hidden className="frame-corner" data-corner="br" />
      <div className="flex max-h-[85vh] flex-col">
        {/* Modal Header */}
        <div className="frame-rule-below flex items-start justify-between gap-3 px-5 pb-3.5 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id="shortcuts-dialog-title" className="label-mono text-ink">
              <span className="text-ink-secondary">[ </span>
              Keyboard Shortcuts
              <span className="text-ink-secondary"> ]</span>
            </h2>
            <p className="mt-1 text-[12px] text-ink-secondary">
              Quick commands and navigation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="-mr-1.5 -mt-1 inline-flex size-7 shrink-0 items-center justify-center text-ink-secondary transition-colors hover:bg-raised-hover hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search Input */}
        <div className="frame-rule-below px-5 py-2.5">
          <div className="flex items-center gap-2 border border-hairline bg-inset px-3 py-1.5 focus-within:border-ink">
            <Search size={14} className="shrink-0 text-ink-secondary" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts…"
              aria-label="Search shortcuts"
              className="w-full bg-transparent font-mono text-[12px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {groups.length === 0 ? (
            <div className="py-8 text-center font-mono text-[12px] text-ink-secondary">
              No shortcuts found for “{query}”
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="space-y-1.5">
                <div className="label-mono text-ink-secondary">
                  {group.category}
                </div>
                <div className="divide-y divide-hairline border border-hairline bg-panel">
                  {group.items.map((item) => (
                    <ShortcutRow key={item.id} item={item} isMac={isMac} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="frame-rule-above flex items-center justify-between px-5 py-3 text-[11px] font-mono text-ink-secondary">
          <span className="flex items-center gap-1.5">
            Press <Kbd>?</Kbd> when not typing to open
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
