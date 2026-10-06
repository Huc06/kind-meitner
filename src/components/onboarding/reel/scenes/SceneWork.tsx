import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Users } from "lucide-react";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { reducedMotion } from "@/lib/onboarding";
import { t } from "@/lib/i18n";
import type { SceneProps } from "./types";

const SCENE_MS = 5500;

export function SceneWork({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [step, setStep] = useState<number>(still ? 3 : 1);

  useEffect(() => {
    if (still) return;
    setStep(1);
    onCue?.("curious");

    const t2 = setTimeout(() => {
      setStep(2);
      onCue?.("working");
    }, 1200);

    const t3 = setTimeout(() => {
      setStep(3);
      onCue?.("proud");
    }, 2800);

    const tEnd = setTimeout(() => onEnded?.(), SCENE_MS);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
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
          <Users size={14} className="text-ink-secondary" />
          <span className="text-[13px] font-semibold text-ink">Agent Team Handoffs</span>
        </div>
        <span className="border border-hairline bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary">
          {t("onboarding.illustrativePreview")}
        </span>
      </div>

      <div className="flex flex-col gap-2 my-auto">
        {/* Step 1: Coordinator */}
        <div className="flex items-center gap-2 border border-hairline bg-card p-2 text-[12px] shadow-sm">
          <AgentMark bot={{ id: "coordinator", name: "Coordinator" }} size={22} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink truncate">Coordinator</span>
              <span className="font-mono text-[10px] text-accent">Dispatched</span>
            </div>
            <div className="text-[11px] text-ink-secondary truncate">Delegated endpoint scan to OutdoorWindow</div>
          </div>
          <CheckCircle2 size={13} className="text-success shrink-0" />
        </div>

        {/* Step 2: OutdoorWindow */}
        <div className={`flex items-center gap-2 border border-hairline bg-card p-2 text-[12px] shadow-sm transition-opacity duration-300 ${step >= 2 ? "opacity-100" : "opacity-30"}`}>
          <AgentMark bot={{ id: "outdoor-window", name: "OutdoorWindow" }} size={22} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink truncate">OutdoorWindow #6706</span>
              <span className="font-mono text-[10px] text-accent flex items-center gap-1">
                Handoff <ArrowRight size={10} />
              </span>
            </div>
            <div className="text-[11px] text-ink-secondary truncate">Endpoint verified 200 OK (42ms) · Passed payload to Plate</div>
          </div>
          {step >= 2 ? <CheckCircle2 size={13} className="text-success shrink-0" /> : <Clock size={13} className="text-ink-secondary shrink-0" />}
        </div>

        {/* Step 3: Plate */}
        <div className={`flex items-center gap-2 border border-hairline bg-card p-2 text-[12px] shadow-sm transition-opacity duration-300 ${step >= 3 ? "opacity-100" : "opacity-30"}`}>
          <AgentMark bot={{ id: "plate", name: "Plate" }} size={22} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink truncate">Plate #6708</span>
              <span className="font-mono text-[10px] text-success">Verified</span>
            </div>
            <div className="text-[11px] text-ink-secondary truncate">Validated schema & service capabilities · 0 issues</div>
          </div>
          {step >= 3 ? <CheckCircle2 size={13} className="text-success shrink-0" /> : <Clock size={13} className="text-ink-secondary shrink-0" />}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-secondary font-mono shrink-0">
        <span>3 distinct agents</span>
        <span>Handoffs tracked in room</span>
      </div>
    </div>
  );
}
