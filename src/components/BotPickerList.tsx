// The checkbox roster shared by "New Room" and "Manage Members": one row per
// bot, a tick on the ones picked. Both callers own their own selection state —
// this only draws it, so the two lists can never drift apart visually.
import { Check } from "lucide-react";
import type { Bot } from "@/state/store";
import { BotAvatar } from "./Avatar";
import { cn } from "@/lib/cn";

export function BotPickerList({
  bots,
  picked,
  onToggle,
  emptyHint,
}: {
  bots: Bot[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  /** shown in place of the list when there is nothing to pick from */
  emptyHint: string;
}) {
  return (
    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
      {bots.length === 0 && <div className="px-2 py-4 text-center text-[13px] text-ink-secondary">{emptyHint}</div>}
      {bots.map((b) => (
        <button
          key={b.id}
          onClick={() => onToggle(b.id)}
          role="checkbox"
          aria-label={b.name}
          aria-checked={picked.has(b.id)}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
            picked.has(b.id) ? "bg-raised hover:bg-raised-hover" : "hover:bg-raised-hover",
          )}
        >
          <BotAvatar bot={b} state="happy" size={26} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{b.name}</span>
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center border transition-colors",
              picked.has(b.id) ? "border-accent bg-accent text-accent-ink" : "border-hairline bg-inset",
            )}
          >
            {picked.has(b.id) && <Check size={11} />}
          </span>
        </button>
      ))}
    </div>
  );
}
