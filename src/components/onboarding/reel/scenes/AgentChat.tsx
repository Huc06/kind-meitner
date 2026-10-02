// The "every chat is a real agent" scene, after Recall's "Chat With Your
// Knowledge" bento: a message goes out, the bot thinks with bouncing dots,
// then a reply streams in and the whole exchange lifts to make room. What
// makes it kind-meitner is the tool chip in the reply: the bot ran a real
// command on this machine before answering, which is the promise the
// guided first conversation then keeps.
import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { reducedMotion } from "@/lib/onboarding";
import type { SceneProps } from "./types";
const AGENT_CHAT_MS = 5400;



/** Phases, in ms from play: the ask lands, dots think, the reply streams. */
const THINK_AT = 700;
const REPLY_AT = 2000;
const CHARS_PER_S = 48;

export function AgentChat({ playing, onCue, onEnded, label }: SceneProps) {
  const ask = t("onboarding.reel.chat.ask");
  const replyText = t("onboarding.reel.chat.reply");
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<"ask" | "think" | "reply">(still ? "reply" : "ask");
  const [shown, setShown] = useState(still ? replyText.length : 0);
  useEffect(() => {
    if (still) return;
    setPhase("ask");
    setShown(0);
    onCue?.("listening");
    const think = setTimeout(() => {
      setPhase("think");
      onCue?.("working");
    }, THINK_AT);
    const reply = setTimeout(() => {
      setPhase("reply");
      onCue?.("proud");
    }, REPLY_AT);
    const end = setTimeout(() => onEnded?.(), AGENT_CHAT_MS);
    return () => {
      clearTimeout(think);
      clearTimeout(reply);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);

  // stream the reply a few characters at a time; a plain interval keeps it
  // off the animation thread and trivially cancellable
  useEffect(() => {
    if (phase !== "reply" || still) return;
    const step = Math.max(1, Math.round(CHARS_PER_S / 20));
    const timer = setInterval(() => {
      setShown((n) => {
        if (n >= replyText.length) {
          clearInterval(timer);
          return n;
        }
        return Math.min(replyText.length, n + step);
      });
    }, 50);
    return () => clearInterval(timer);
  }, [phase, still]);

  const replied = phase === "reply";
  const done = shown >= replyText.length;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-inset px-6" role="img" aria-label={label}>
      <div
        className={cn(
          "flex w-full max-w-[420px] flex-col gap-3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          replied ? "-translate-y-6" : "translate-y-4",
        )}
      >
        {/* the ask, from the right */}
        <div className="flex items-end justify-end gap-2.5">
          <div className="animate-rise max-w-[300px] border border-hairline bg-raised px-3.5 py-2.5 text-[13px] leading-snug text-ink">
            {ask}
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-ink">
            You
          </div>
        </div>

        {/* the bot: dots while it works, then the reply grows out of it */}
        <div className="flex items-start gap-2.5">
          <div className="shrink-0">
            <AgentMark
              bot={{
                id: "market-scout",
                name: "Market Scout",
                okxImport: { kind: "okx-catalog", catalogAvatar: "chart" },
              }}
              size={34}
            />
          </div>
          <div className="relative min-h-[44px] flex-1">
            {phase === "think" && (
              <div className="animate-spot-in inline-flex items-center gap-1.5 border border-hairline bg-card px-3.5 py-2.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-ink-secondary"
                    style={{ animation: `dot-bob 0.9s ease-in-out ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>
            )}
            {replied && (
              <div className="animate-spot-in origin-top-left border border-hairline bg-card p-3.5">
                <div className="mb-2 flex items-center justify-between border-b border-hairline pb-1.5 font-mono text-[10.5px]">
                  <div className="inline-flex items-center gap-1.5 text-ink-secondary">
                    <Cpu size={12} className="text-accent" />
                    <span>{t("onboarding.reel.chat.tool")}</span>
                  </div>
                  <span className="border border-hairline bg-inset px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-secondary font-semibold">
                    {t("onboarding.reel.example")}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-ink">
                  {replyText.slice(0, shown)}
                  {!done && <span className="animate-caret ml-0.5 inline-block h-[13px] w-[2px] translate-y-[2px] bg-ink" />}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
