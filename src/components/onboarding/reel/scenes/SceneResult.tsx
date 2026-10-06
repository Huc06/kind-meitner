import { useEffect, useState } from "react";
import { FileText, ListOrdered, ShieldCheck } from "lucide-react";
import { reducedMotion } from "@/lib/onboarding";
import { t } from "@/lib/i18n";
import type { SceneProps } from "./types";

const SCENE_MS = 5400;

export function SceneResult({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [showLog, setShowLog] = useState<boolean>(still ? true : false);

  useEffect(() => {
    if (still) return;
    setShowLog(false);
    onCue?.("searching");

    const tLog = setTimeout(() => {
      setShowLog(true);
      onCue?.("celebrate");
    }, 1400);

    const tEnd = setTimeout(() => onEnded?.(), SCENE_MS);

    return () => {
      clearTimeout(tLog);
      clearTimeout(tEnd);
    };
  }, [playing, still, onCue, onEnded]);

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-inset p-3 sm:p-4 font-sans select-none"
      role="img"
      aria-label={label}
    >
      <div className="flex items-center justify-between border-b border-hairline pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-ink-secondary" />
          <span className="text-[13px] font-semibold text-ink">Deliverable & Context</span>
        </div>
        <span className="border border-hairline bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary">
          {t("onboarding.illustrativePreview")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-auto">
        {/* Deliverable Card */}
        <div className="border border-hairline bg-card p-2.5 text-[12px] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="font-semibold text-ink text-[12px] truncate">Best Run Window Deliverable</span>
              <span className="bg-success/10 text-success border border-success/30 px-1 py-0.5 font-mono text-[9px] uppercase">
                READY
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-secondary mb-2">
              Optimal 45-min run window identified: Thursday 6:30 AM – 7:15 AM.
            </p>
            <div className="flex flex-col gap-1 font-mono text-[10px]">
              <div className="flex justify-between border-t border-hairline/60 pt-0.5">
                <span className="text-ink-secondary">OutdoorWindow #6706</span>
                <span className="text-success">26°C · AQI 32 · Rain 5%</span>
              </div>
              <div className="flex justify-between border-t border-hairline/60 pt-0.5">
                <span className="text-ink-secondary">Plate #6708</span>
                <span className="text-success">Calendar slot confirmed</span>
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-ink-secondary border-t border-hairline pt-1">
            Deliverable stored in conversation
          </div>
        </div>

        {/* Activity Drawer Preview */}
        <div className={`border border-hairline bg-panel p-2.5 text-[11px] shadow-sm flex flex-col justify-between transition-opacity duration-300 ${showLog ? "opacity-100" : "opacity-40"}`}>
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1.5">
              <ListOrdered size={12} className="text-accent" />
              <span>Activity Log Context</span>
            </div>
            <div className="flex flex-col gap-1 font-mono text-[9.5px] text-ink-secondary">
              <div className="flex items-center gap-1">
                <span className="text-accent">12:00:01</span>
                <span className="truncate">Dispatched query to OutdoorWindow</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-accent">12:00:02</span>
                <span className="truncate">OutdoorWindow retrieved Singapore forecast</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-accent">12:00:03</span>
                <span className="truncate">Plate formatted schedule card</span>
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-accent flex items-center gap-1 border-t border-hairline pt-1">
            <ShieldCheck size={11} />
            <span>Full provenance audit trail</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-secondary font-mono shrink-0">
        <span>Result in chat</span>
        <span>Context in activity log</span>
      </div>
    </div>
  );
}
