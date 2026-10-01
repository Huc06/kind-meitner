// The "put bots in a room" scene. One authored moment: an @mention picks who
// answers. Setup is the room header with its member stack, exactly as
// GroupView draws it; the action is typing "@Res", the mention menu opening
// and Researcher being chosen; the resolution is Researcher lighting up in
// the header and answering while the other two stay quiet.
import { useEffect, useState } from "react";
import { Hash, Send } from "lucide-react";
import { MausAvatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import type { MausColor } from "@/lib/mascot";
import { reducedMotion } from "@/lib/onboarding";
import type { SceneProps } from "./OrbitingApps";

const CHANNELS_MS = 6000;

const MEMBERS: Array<{ name: string; title: string; color: MausColor }> = [
  { name: "Maus", title: "Chief of staff", color: "green" },
  { name: "Researcher", title: "Finds and checks facts", color: "blue" },
  { name: "Writer", title: "Drafts and edits", color: "orange" },
];
const RESEARCHER = 1;

const TYPED = "@Res";
const REST = " pull last week's numbers";
const REPLY = "Found them. Revenue up 12% week over week, churn flat. Full table in the folder.";

/** Beats, in ms from play. */
const TYPE_AT = 600;
const MENU_AT = 1150;
const PICK_AT = 1900;
const REST_AT = 2100;
const SEND_AT = 3000;
const THINK_AT = 3300;
const REPLY_AT = 4200;

type Phase = "room" | "typing" | "menu" | "picked" | "rest" | "sent" | "thinking" | "reply";
const ORDER: Phase[] = ["room", "typing", "menu", "picked", "rest", "sent", "thinking", "reply"];
const reached = (phase: Phase, target: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(target);

function useTypewriter(text: string, active: boolean, still: boolean, charsPerTick = 2, tickMs = 45) {
  const [n, setN] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) {
      setN(text.length);
      return;
    }
    if (!active) return;
    setN(0);
    const timer = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(timer);
          return v;
        }
        return Math.min(text.length, v + charsPerTick);
      });
    }, tickMs);
    return () => clearInterval(timer);
  }, [active, still, text, charsPerTick, tickMs]);
  return text.slice(0, n);
}

export function Channels({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [phase, setPhase] = useState<Phase>(still ? "reply" : "room");

  useEffect(() => {
    if (still) return;
    setPhase("room");
    onCue?.("listening");
    const timers = [
      setTimeout(() => setPhase("typing"), TYPE_AT),
      setTimeout(() => {
        setPhase("menu");
        onCue?.("curious");
      }, MENU_AT),
      setTimeout(() => setPhase("picked"), PICK_AT),
      setTimeout(() => setPhase("rest"), REST_AT),
      setTimeout(() => setPhase("sent"), SEND_AT),
      setTimeout(() => {
        setPhase("thinking");
        onCue?.("working");
      }, THINK_AT),
      setTimeout(() => {
        setPhase("reply");
        onCue?.("proud");
      }, REPLY_AT),
      setTimeout(() => onEnded?.(), CHANNELS_MS),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, still]);

  const typed = useTypewriter(TYPED, phase === "typing" || phase === "menu", still, 1, 110);
  const rest = useTypewriter(REST, reached(phase, "rest") && !reached(phase, "sent"), still, 2, 40);
  const reply = useTypewriter(REPLY, phase === "reply", still, 3, 45);

  const menuOpen = phase === "menu";
  const picked = reached(phase, "picked");
  const sent = reached(phase, "sent");
  const thinking = phase === "thinking";
  const replied = phase === "reply";
  const busy = thinking || (replied && reply.length < REPLY.length);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-inset" role="img" aria-label={label}>
      {/* the room, as GroupView draws it */}
      <div className="animate-rise relative m-4 mb-0 flex flex-1 flex-col overflow-hidden border border-hairline bg-app">
        <header className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-ink-secondary" />
            <span className="text-[13px] font-semibold text-ink">Work</span>
          </div>
          <div className="flex -space-x-2">
            {MEMBERS.map((m, i) => {
              const active = busy && i === RESEARCHER;
              return (
                <span
                  key={m.name}
                  className={cn(
                    "relative inline-flex rounded-full transition-opacity duration-300",
                    active && "z-10 ring-2 ring-accent ring-offset-1 ring-offset-app",
                    busy && i !== RESEARCHER && "opacity-45",
                  )}
                >
                  <MausAvatar color={m.color} state={active ? "working" : "happy"} size={24} animated={!still && active} />
                  {active && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-app bg-accent" />}
                </span>
              );
            })}
          </div>
        </header>

        {/* transcript */}
        <div className="relative flex flex-1 flex-col justify-end gap-2.5 px-3.5 pb-2.5">
          {sent && (
            <div className="animate-rise flex justify-end">
              <div className="max-w-[260px] border border-hairline bg-raised px-3 py-2 text-[12px] leading-snug text-ink">
                <span className="border border-hairline bg-card px-1 font-mono text-[10.5px] text-ink">@Researcher</span>
                {REST}
              </div>
            </div>
          )}
          {(thinking || replied) && (
            <div className="animate-rise flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <MausAvatar color="blue" state={replied ? "writing" : "working"} size={26} animated={!still} />
              </div>
              <div className="min-w-0">
                <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary">Researcher</div>
                {thinking ? (
                  <div className="inline-flex items-center gap-1.5 border border-hairline bg-card px-3 py-2">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="size-1.5 rounded-full bg-ink-secondary" style={{ animation: `dot-bob 0.9s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                ) : (
                  <div className="animate-spot-in max-w-[300px] border border-hairline bg-card px-3 py-2 text-[12px] leading-relaxed text-ink">
                    {reply}
                    {reply.length < REPLY.length && <span className="animate-caret ml-0.5 inline-block h-[12px] w-[2px] translate-y-[2px] bg-ink" />}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* the mention menu, above the composer */}
          {menuOpen && (
            <div className="animate-spot-in absolute bottom-[48px] left-3.5 z-20 w-[210px] origin-bottom-left border border-hairline bg-menu p-1 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]">
              {[MEMBERS[RESEARCHER]!, MEMBERS[2]!].map((m, i) => (
                <div key={m.name} className={cn("flex h-8 items-center gap-2 px-2.5 text-[12px] transition-colors hover:bg-raised-hover", i === 0 ? "bg-raised" : "")}>
                  <MausAvatar color={m.color} state="happy" size={20} animated={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{m.name}</span>
                    <span className="block truncate font-mono text-[9px] text-ink-secondary">{m.title}</span>
                  </span>
                </div>
              ))}
              <div className="flex h-8 items-center gap-2 px-2.5 font-mono text-[11px] text-ink-secondary hover:bg-raised-hover">
                <span className="flex size-4 items-center justify-center border border-hairline bg-raised text-[10px]">@</span> everyone
              </div>
            </div>
          )}
        </div>

        {/* composer */}
        <div className="m-2.5 mt-0 flex items-center gap-2 border border-hairline bg-inset px-3 py-2">
          <div className="flex min-h-[16px] flex-1 items-center text-[12px] text-ink">
            {sent ? (
              <span className="text-ink-secondary">Message #Work</span>
            ) : (
              <>
                {picked ? <span className="border border-hairline bg-card px-1 font-mono text-[10.5px] text-ink">@Researcher</span> : <span>{typed}</span>}
                <span>{rest}</span>
                {phase !== "room" && <span className="animate-caret ml-0.5 inline-block h-[12px] w-[2px] bg-ink" />}
              </>
            )}
          </div>
          <Send size={13} className={cn("transition-colors duration-200", picked && !sent ? "text-accent" : "text-ink-secondary")} />
        </div>
      </div>

      {/* the guide keeps its distance: this room belongs to the members */}
      <div className="flex h-11 shrink-0 items-center justify-center">
        <div className="relative">
          <MausAvatar color="green" state={replied ? "proud" : busy ? "listening" : "idle"} size={28} animated={!still} />
        </div>
      </div>
    </div>
  );
}
