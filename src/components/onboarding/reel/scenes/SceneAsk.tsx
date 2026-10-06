import { useEffect, useState } from "react";
import { Hash, Send } from "lucide-react";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { reducedMotion } from "@/lib/onboarding";
import { t } from "@/lib/i18n";
import type { SceneProps } from "./types";

const SCENE_MS = 5200;

export function SceneAsk({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<"ask" | "thinking" | "reply">(still ? "reply" : "ask");

  useEffect(() => {
    if (still) return;
    setPhase("ask");
    onCue?.("listening");

    const tThink = setTimeout(() => {
      setPhase("thinking");
      onCue?.("working");
    }, 900);

    const tReply = setTimeout(() => {
      setPhase("reply");
      onCue?.("happy");
    }, 2200);

    const tEnd = setTimeout(() => onEnded?.(), SCENE_MS);

    return () => {
      clearTimeout(tThink);
      clearTimeout(tReply);
      clearTimeout(tEnd);
    };
  }, [playing, still, onCue, onEnded]);

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-inset p-3 sm:p-4 font-sans select-none"
      role="img"
      aria-label={label}
    >
      {/* Room Header bar */}
      <div className="flex items-center justify-between border-b border-hairline pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Hash size={14} className="text-ink-secondary" />
          <span className="text-[13px] font-semibold text-ink">tasks</span>
          <span className="font-mono text-[10px] text-ink-secondary">· 3 agents</span>
        </div>
        <span className="border border-hairline bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary">
          {t("onboarding.illustrativePreview")}
        </span>
      </div>

      {/* Messages stream */}
      <div className="flex flex-col gap-2.5 my-auto overflow-hidden py-1">
        {/* User Turn */}
        <div className="flex justify-end">
          <div className="max-w-[85%] border border-hairline bg-card px-3 py-2 text-[12px] sm:text-[12.5px] leading-relaxed text-ink shadow-sm">
            Check market readiness for our connected agents and summarize changes.
          </div>
        </div>

        {/* Agent Turn */}
        {phase === "thinking" && (
          <div className="flex items-center gap-2 text-ink-secondary text-[12px]">
            <AgentMark bot={{ id: "coordinator", name: "Coordinator" }} size={20} />
            <span className="animate-pulse">Thinking · coordinating agents…</span>
          </div>
        )}

        {phase === "reply" && (
          <div className="flex items-start gap-2 max-w-[90%]">
            <AgentMark bot={{ id: "coordinator", name: "Coordinator" }} size={24} className="mt-0.5 shrink-0" />
            <div className="border border-hairline bg-card px-3 py-2 text-[12px] sm:text-[12.5px] leading-relaxed text-ink shadow-sm">
              <div className="font-medium text-[11px] sm:text-[11.5px] text-accent mb-0.5">Coordinator</div>
              Starting inspection across OutdoorWindow (#6706) and Plate (#6708). I will verify endpoints and deliver the report.
            </div>
          </div>
        )}
      </div>

      {/* Illustrative Composer */}
      <div className="flex items-center gap-2 border border-hairline bg-card px-3 py-1.5 shadow-inner shrink-0">
        <span className="text-[12px] text-ink-secondary/70 flex-1 truncate">
          What would you like to get done?
        </span>
        <div className="size-6 border border-hairline bg-inset flex items-center justify-center text-ink-secondary shrink-0">
          <Send size={11} />
        </div>
      </div>
    </div>
  );
}
