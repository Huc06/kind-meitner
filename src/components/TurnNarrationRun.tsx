// A settled turn's intermediate assistant messages. Providers such as Grok
// narrate before tools; the messages stay available without looking like six
// separate final answers after the turn is done.
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Tag } from "@/components/ui/tag";

export function TurnNarrationRun({
  label,
  forceOpen = false,
  children,
}: {
  label: string;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className="flex flex-col gap-1.5 my-1">
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          title={open ? "Hide progress messages" : "Show progress messages"}
          className="cursor-pointer flex items-center gap-2 border border-hairline bg-inset px-2.5 py-1 font-mono text-[11px] text-ink-secondary hover:bg-raised-hover hover:text-ink"
        >
          <span className="text-ink-secondary select-none">&gt;_</span>
          <span className="text-ink">{label}</span>
          <Tag tone="success" variant="outline" size="sm">OK</Tag>
          <ChevronRight size={12} className={open ? "rotate-90 text-ink-secondary" : "text-ink-secondary"} />
        </button>
      </div>
      {open && (
        <div className="border border-hairline bg-inset p-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
