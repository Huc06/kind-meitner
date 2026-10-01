// The "every chat is a real agent" scene, after Recall's "Chat With Your
// Knowledge" bento: a message goes out, the bot thinks with bouncing dots,
// then a reply streams in and the whole exchange lifts to make room. What
// makes it kind-meitner is the tool chip in the reply: the bot ran a real
// command on this machine before answering, which is the promise the
// guided first conversation then keeps.
import { useEffect, useState } from "react";
import { Check, TerminalSquare } from "lucide-react";
import { MausAvatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { reducedMotion } from "@/lib/onboarding";
import type { SceneProps } from "./OrbitingApps";

const AGENT_CHAT_MS = 5400;

const ASK = "Can you check whether the deploy script still passes its tests?";
const REPLY = "Ran the suite on this machine: 42 tests, all green. One warning about a deprecated flag in deploy.sh, want me to fix it?";

/** Phases, in ms from play: the ask lands, dots think, the reply streams. */
const THINK_AT = 700;
const REPLY_AT = 2000;
const CHARS_PER_S = 48;

export function AgentChat({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<"ask" | "think" | "reply">(still ? "reply" : "ask");
  const [shown, setShown] = useState(still ? REPLY.length : 0);

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
        if (n >= REPLY.length) {
          clearInterval(timer);
          return n;
        }
        return Math.min(REPLY.length, n + step);
      });
    }, 50);
    return () => clearInterval(timer);
  }, [phase, still]);

  const replied = phase === "reply";
  const done = shown >= REPLY.length;

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
            {ASK}
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-ink">
            You
          </div>
        </div>

        {/* the bot: dots while it works, then the reply grows out of it */}
        <div className="flex items-start gap-2.5">
          <div className="shrink-0">
            <MausAvatar
              color="green"
              state={replied ? (done ? "proud" : "writing") : phase === "think" ? "working" : "listening"}
              size={34}
              animated={!still}
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
                <div
                  className={cn(
                    "mb-2 inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider transition-colors duration-300",
                    done ? "border-success/60 bg-success/12 text-success" : "border-hairline bg-raised text-ink-secondary",
                  )}
                >
                  {done ? <Check size={11} strokeWidth={3} /> : <TerminalSquare size={11} />}
                  <code>pnpm test</code>
                  <span>{done ? "passed" : "running…"}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-ink">
                  {REPLY.slice(0, shown)}
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
