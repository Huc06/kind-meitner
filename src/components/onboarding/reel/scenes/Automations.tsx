// The "set it and forget it" scene. One authored moment: the clock line
// reaches 9:00 and the routine fires. Everything before it is setup (the
// calendar surfaces, a pointer drops the routine onto Monday), everything
// after is resolution (the receipt lands in chat, then an outside app calls
// the webhook and the same bot wakes). Three layers throughout: the primary
// action, a secondary reaction (the tile's shadow tightening as it lands,
// the ripple when it fires), and ambient life (the guide's glow, the vignette).
//
// Drawn to match the real Automations page and the real run receipt card,
// so a user recognises both when they meet them for real.
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MousePointer2, Zap } from "lucide-react";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { cn } from "@/lib/cn";
import { reducedMotion } from "@/lib/onboarding";
import type { SceneProps } from "./types";

const AUTOMATIONS_MS = 6200;

/** Beats, in ms from play. Setup → action → resolution → second story. */
const POINTER_AT = 500;
const DROP_AT = 1100;
const FIRE_AT = 2200;
const DONE_AT = 3300;
const HOOK_AT = 4000;
const HOOK_DONE_AT = 5200;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [8, 9, 10, 11];
const ROW = 38;

type Phase = "grid" | "pointer" | "dropped" | "firing" | "done" | "hook" | "hookDone";
const ORDER: Phase[] = ["grid", "pointer", "dropped", "firing", "done", "hook", "hookDone"];
const reached = (phase: Phase, target: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(target);

function Receipt({ name, running, tone }: { name: string; running: boolean; tone: "accent" | "warning" }) {
  return (
    <div
      className={cn(
        "animate-rise flex w-[232px] items-center gap-2.5 border bg-card px-3 py-2.5 transition-colors duration-500",
        running ? "border-hairline" : "border-success",
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center border border-hairline bg-inset">
        {running ? (
          <Loader2 size={14} className={cn("animate-spin", tone === "accent" ? "text-accent" : "text-warning")} />
        ) : (
          <CheckCircle2 size={14} className="animate-spot-in text-success" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-ink">{name}</div>
        <div className={cn("font-mono text-[10px] uppercase tracking-wider transition-colors duration-300", running ? "text-ink-secondary" : "text-success")}>
          {running ? "Running…" : "Ran · result in chat"}
        </div>
      </div>
    </div>
  );
}

export function Automations({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<Phase>(still ? "hookDone" : "grid");

  useEffect(() => {
    if (still) return;
    setPhase("grid");
    onCue?.("drowsy");
    const timers = [
      setTimeout(() => setPhase("pointer"), POINTER_AT),
      setTimeout(() => setPhase("dropped"), DROP_AT),
      setTimeout(() => {
        setPhase("firing");
        onCue?.("working");
      }, FIRE_AT),
      setTimeout(() => {
        setPhase("done");
        onCue?.("proud");
      }, DONE_AT),
      setTimeout(() => {
        setPhase("hook");
        onCue?.("alerting");
      }, HOOK_AT),
      setTimeout(() => {
        setPhase("hookDone");
        onCue?.("happy");
      }, HOOK_DONE_AT),
      setTimeout(() => onEnded?.(), AUTOMATIONS_MS),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);

  const pointer = phase === "pointer";
  const dropped = reached(phase, "dropped");
  const firing = reached(phase, "firing");
  const done = reached(phase, "done");
  const hook = reached(phase, "hook");
  const hookDone = reached(phase, "hookDone");
  const busy = (firing && !done) || (hook && !hookDone);

  return (
    <div className="relative h-full w-full overflow-hidden bg-inset" role="img" aria-label={label}>
      {/* the calendar, as the Automations page draws it */}
      <div className="animate-rise absolute inset-x-5 top-4 overflow-hidden border border-hairline bg-app">
        <div className="stagger grid grid-cols-[34px_repeat(5,1fr)] border-b border-hairline">
          <div />
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={cn("animate-rise border-l border-hairline py-1.5 text-center", i === 0 && "bg-raised")}
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              <div className={cn("label-mono text-[8.5px]", i === 0 ? "text-ink" : "text-ink-secondary")}>{day}</div>
              <div className={cn("mx-auto mt-0.5 flex size-5 items-center justify-center font-mono text-[10.5px] font-medium tabular-nums", i === 0 ? "bg-accent text-accent" : "text-ink")}>
                {14 + i}
              </div>
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[34px_repeat(5,1fr)]" style={{ height: HOURS.length * ROW }}>
          <div className="relative">
            {HOURS.map((hour, i) => (
              <div key={hour} className="absolute right-1.5 -translate-y-1/2 font-mono text-[8.5px] tabular-nums text-ink-secondary" style={{ top: i * ROW }}>
                {hour} AM
              </div>
            ))}
          </div>
          {DAYS.map((day, i) => (
            <div key={day} className={cn("relative border-l border-hairline", i === 0 && "bg-raised/40")}>
              {HOURS.map((hour, h) => (
                <div key={hour} className="absolute inset-x-0 border-t border-hairline" style={{ top: h * ROW }} />
              ))}
              {i === 0 && (
                <>
                  {/* the drop target glows while the pointer hovers it */}
                  <div
                    className={cn("absolute inset-x-0.5 border border-dashed border-accent bg-raised transition-opacity duration-300", pointer ? "opacity-100" : "opacity-0")}
                    style={{ top: ROW + 1, height: ROW - 2 }}
                  />
                  <div
                    className={cn(
                      "absolute inset-x-1 flex items-center gap-1.5 overflow-hidden border-l-2 border-accent bg-raised px-1.5 py-1",
                      "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      dropped ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-[0.98] opacity-0",
                      busy && firing && !done && "animate-ripple",
                      hook && !hookDone && "animate-ripple",
                    )}
                    style={{ top: ROW + 2, height: ROW - 8 }}
                  >
                    <AgentMark bot={{ id: "routine", name: "Routine" }} size={16} />
                    <div className="min-w-0">
                      <div className="truncate text-[9.5px] font-semibold leading-tight text-ink">Weekly report</div>
                      <div className="font-mono text-[8px] leading-tight tabular-nums text-ink-secondary">09:00 · weekly</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          {/* the clock line: eases to 9:00 */}
          <div
            className="pointer-events-none absolute left-[34px] right-0 z-10 h-px bg-danger transition-transform duration-[1100ms] ease-[cubic-bezier(0.77,0,0.175,1)]"
            style={{ top: 6, transform: `translateY(${firing ? ROW - 6 : 0}px)` }}
          >
            <span className="absolute -left-1 -top-[2px] size-1.5 bg-danger" />
          </div>
        </div>
      </div>

      {/* the pointer that drops the routine in */}
      {(pointer || (dropped && !firing)) && (
        <MousePointer2
          size={16}
          className={cn(
            "absolute z-30 text-ink transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            pointer ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-6 -translate-y-8 opacity-0",
          )}
          style={{ left: 92, top: 96, fill: "var(--color-ink)" }}
        />
      )}

      {/* receipts land in the bot's chat */}
      <div className="absolute bottom-4 right-5 z-20 flex flex-col items-end gap-2">
        {firing && <Receipt name="Weekly report" running={!done} tone="accent" />}
        {hook && <Receipt name="Webhook task" running={!hookDone} tone="warning" />}
      </div>

      {/* an outside app calls the address; the bolt travels to the bot */}
      {hook && (
        <div className="absolute bottom-4 left-5 z-20 flex items-center gap-3">
          <div className="animate-rise flex items-center gap-1.5 border border-hairline bg-panel px-2.5 py-1.5 font-mono text-[9.5px] text-ink-secondary">
            <span className="font-semibold text-ink">POST</span> …/hooks/wh_7f3a
          </div>
          <Zap
            size={15}
            fill="currentColor"
            className={cn("text-warning", hookDone ? "opacity-0 transition-opacity duration-300" : "animate-bolt")}
          />
        </div>
      )}

      {/* the guide, asleep until something needs it */}
      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <div className="relative">
          <AgentMark bot={{ id: "guide", name: "Guide" }} size={40} />
        </div>
      </div>
    </div>
  );
}
