import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Clock, GitCompare } from "lucide-react";
import { reducedMotion } from "@/lib/onboarding";
import { t } from "@/lib/i18n";
import type { SceneProps } from "./types";

const SCENE_MS = 5400;

export function SceneRepeat({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<"scheduled" | "ran">(still ? "ran" : "scheduled");

  useEffect(() => {
    if (still) return;
    setPhase("scheduled");
    onCue?.("curious");

    const tRun = setTimeout(() => {
      setPhase("ran");
      onCue?.("celebrate");
    }, 1500);

    const tEnd = setTimeout(() => onEnded?.(), SCENE_MS);

    return () => {
      clearTimeout(tRun);
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
          <Calendar size={14} className="text-ink-secondary" />
          <span className="text-[13px] font-semibold text-ink">Scheduled Routines</span>
        </div>
        <span className="border border-hairline bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary">
          {t("onboarding.illustrativePreview")}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 my-auto">
        {/* Schedule Bar */}
        <div className="flex items-center justify-between border border-hairline bg-card px-3 py-2 text-[12px] shadow-sm">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-accent" />
            <span className="font-semibold text-ink">Repeat Task</span>
            <span className="font-mono text-[10px] text-ink-secondary">Every 1 hour</span>
          </div>
          <span className="bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 font-mono text-[9.5px] uppercase">
            Active
          </span>
        </div>

        {/* Change Comparison / Diff Card */}
        <div className="border border-hairline bg-card p-2.5 text-[12px] shadow-sm">
          <div className="flex items-center justify-between font-mono text-[10.5px] text-ink-secondary mb-1.5 border-b border-hairline pb-1">
            <span className="flex items-center gap-1 font-semibold text-ink">
              <GitCompare size={12} className="text-accent" /> Run Comparison
            </span>
            <span>{phase === "ran" ? "Latest run: Just now" : "Waiting for next trigger"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-1.5">
            <div className="border border-hairline bg-panel p-1.5 font-mono">
              <div className="text-[10px] text-ink-secondary">Previous (1h ago)</div>
              <div className="text-ink font-semibold">2 services online</div>
              <div className="text-[9.5px] text-ink-secondary">Latency: 46ms</div>
            </div>
            <div className="border border-hairline bg-panel p-1.5 font-mono">
              <div className="text-[10px] text-ink-secondary">Current (Automated)</div>
              <div className="text-ink font-semibold">2 services online</div>
              <div className="text-[9.5px] text-success">Latency: 42ms (-4ms)</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-success pt-0.5">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={11} /> Δ No regression detected
            </span>
            <span className="text-ink-secondary">Scheduler: workspace timer (not an agent)</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-secondary font-mono shrink-0">
        <span>Automated re-execution</span>
        <span>Audit diffs over time</span>
      </div>
    </div>
  );
}
