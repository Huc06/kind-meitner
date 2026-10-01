// A folded stretch of tool chips: one row saying what ran, click to open.
//
// Collapsed by default. A search hit inside a run opens it, and a run stays
// open once the user has opened it. Failed steps never enter a folded run.
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Message } from "@/state/store";
import { describeRun } from "@/lib/activity-runs";
import { t } from "@/lib/i18n";

export function ActivityRun({
  messages,
  forceOpen = false,
  children,
}: {
  messages: Message[];
  /** landing on a step inside this run — a search hit cannot scroll to a
   * row that a fold has kept out of the DOM */
  forceOpen?: boolean;
  /** the individual chips, rendered by whichever transcript owns them */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const summary = describeRun(messages);

  return (
    <div className="flex flex-col gap-1.5 my-1">
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={open ? undefined : t("chat.run.showSteps")}
          className="cursor-pointer flex items-center gap-2 border border-hairline bg-inset px-2.5 py-1 font-mono text-[11px] text-ink-secondary hover:bg-raised-hover hover:text-ink"
        >
          <span className="text-ink-secondary select-none">&gt;_</span>
          <span className="max-w-[480px] truncate text-ink">{summary}</span>
          <ChevronRight size={12} className={open ? "rotate-90 text-ink-secondary" : "text-ink-secondary"} />
        </button>
      </div>
      {open && (
        <div className="border border-hairline bg-inset p-2.5 flex flex-col gap-1">
          {children}
        </div>
      )}
    </div>
  );
}
