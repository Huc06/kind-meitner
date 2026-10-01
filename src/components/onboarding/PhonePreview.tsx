// A drawn phone showing what pairing gives you: the same chat on a small
// screen, with an approval card you can answer from the sofa. Used by the
// welcome tour's phone beat in place of three identical value cards. Purely
// illustrative: nothing here is interactive.
import { Check, X } from "lucide-react";
import { MausAvatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { brand } from "@/lib/brand";

export function PhonePreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden="true">
      <div className="relative mx-auto w-[168px] border border-hairline bg-panel p-[6px]">
        <div className="overflow-hidden border border-hairline bg-app">
          {/* status bar and notch */}
          <div className="relative flex h-7 items-center justify-between px-3 text-[8px] font-mono tabular-nums text-ink">
            <span>09:41</span>
            <span className="h-1.5 w-8 bg-hairline" />
            <span className="flex items-center gap-0.5">
              <span className="h-1.5 w-2.5 border border-ink/70" />
            </span>
          </div>
          {/* chat header */}
          <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-1.5">
            <MausAvatar color="green" state="happy" size={16} animated={false} />
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink">Maus</span>
            <span className="ml-auto size-1.5 rounded-full bg-success" />
          </div>
          {/* transcript */}
          <div className="flex flex-col gap-1.5 px-2.5 py-2.5">
            <div className="max-w-[112px] self-end border border-hairline bg-raised px-2 py-1.5 text-[8.5px] leading-snug text-ink">
              Book the 3 pm slot
            </div>
            <div className="max-w-[124px] border border-hairline bg-card px-2 py-1.5 text-[8.5px] leading-snug text-ink">
              Found it. Confirm the booking?
            </div>
            <div className="border border-hairline bg-card p-2">
              <div className="font-mono text-[8px] font-medium uppercase tracking-wider text-ink">Run: book-slot</div>
              <div className="mt-0.5 font-mono text-[7px] text-ink-secondary">clinic.example · 15:00</div>
              <div className="mt-1.5 flex gap-1">
                <span className="flex flex-1 items-center justify-center gap-0.5 border border-accent bg-accent py-1 font-mono text-[7.5px] font-medium uppercase tracking-wider text-accent">
                  <Check size={8} strokeWidth={3} /> Allow
                </span>
                <span className="flex flex-1 items-center justify-center gap-0.5 border border-hairline bg-raised py-1 font-mono text-[7.5px] font-medium uppercase tracking-wider text-ink">
                  <X size={8} strokeWidth={3} /> Deny
                </span>
              </div>
            </div>
          </div>
          {/* composer */}
          <div className="mx-2.5 mb-2.5 border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[7.5px] text-ink-secondary">
            Message {brand().name === "kind-meitner" ? "Maus" : brand().name}
          </div>
        </div>
      </div>
    </div>
  );
}
