// The agent hub connectors scene, built in code rather than recorded:
// OKX agents and the Free MCP service orbit the guide on concentric rings.
// Rings and badges spring in on a stagger, then turn in alternating directions;
// the guide watches, then looks proud once Markets gains its check. Under
// reduced motion the rings hold still.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Cpu, ShieldCheck, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import { MausAvatar } from "@/components/Avatar";
import { tileFor, TILE_TEXT } from "@/components/ui/tile";
import { cn } from "@/lib/cn";
import type { MausState } from "@/lib/mascot";
import { reducedMotion } from "@/lib/onboarding";

export interface SceneProps {
  playing: boolean;
  onCue?: (state: MausState) => void;
  onEnded?: () => void;
  label: string;
}

const ORBITING_APPS_MS = 5200;

interface HubItem {
  slug: string;
  label: string;
  icon: LucideIcon;
}

/** Agents and Free MCP on the rings, inner to outer. No external logos. */
const RINGS: Array<Array<HubItem>> = [
  [
    { slug: "okx-market-scout-v1", label: "Markets", icon: TrendingUp },
    { slug: "okx-listing-coach", label: "Listing Coach", icon: Sparkles },
  ],
  [
    { slug: "okx-spend-scout", label: "Spend Scout", icon: ShieldCheck },
    { slug: "okx-free-mcp", label: "Free MCP", icon: Cpu },
  ],
];

function Badge({ item, connected }: { item: HubItem; connected?: boolean }) {
  const Icon = item.icon;
  const tone = tileFor(item.slug);
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <div className={cn("flex size-9 items-center justify-center border border-hairline bg-card shadow-xs", TILE_TEXT[tone])}>
        <Icon size={18} />
      </div>
      <span className="label-mono max-w-[72px] truncate text-[9px] text-ink-secondary">{item.label}</span>
      {connected && (
        <span className="animate-spot-in absolute -right-1 -top-1.5 flex size-4 items-center justify-center rounded-full bg-success text-accent ring-2 ring-inset">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

function Ring({
  radius,
  duration,
  reverse,
  index,
  still,
  children,
}: {
  radius: number;
  duration: number;
  reverse?: boolean;
  index: number;
  still: boolean;
  children: ReactNode[];
}) {
  const count = children.length;
  return (
    <>
      <div
        className="animate-spot-in pointer-events-none absolute rounded-full border border-dashed border-hairline"
        style={{ width: radius * 2, height: radius * 2, left: `calc(50% - ${radius}px)`, top: `calc(50% - ${radius}px)`, animationDelay: `${index * 160}ms` }}
      />
      {children.map((child, i) => (
        <div
          key={i}
          className={cn("absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center", still ? "" : "animate-orbit")}
          style={
            {
              "--angle": (360 / count) * i,
              "--radius": radius,
              "--duration": `${duration}s`,
              animationDirection: reverse ? "reverse" : undefined,
              // still: place each badge at its starting angle by hand
              transform: still
                ? `translate(-50%, -50%) rotate(${(360 / count) * i}deg) translateY(${radius}px) rotate(${-(360 / count) * i}deg)`
                : undefined,
            } as CSSProperties
          }
        >
          <div className="animate-spot-in" style={{ animationDelay: `${420 + index * 160 + i * 120}ms` }}>
            {child}
          </div>
        </div>
      ))}
    </>
  );
}

export function OrbitingApps({ playing, onCue, onEnded, label }: SceneProps) {
  const still = reducedMotion() || !playing;
  const [connected, setConnected] = useState(still);

  useEffect(() => {
    if (still) return;
    onCue?.("curious");
    const check = setTimeout(() => {
      setConnected(true);
      onCue?.("proud");
    }, 2600);
    const end = setTimeout(() => onEnded?.(), ORBITING_APPS_MS);
    return () => {
      clearTimeout(check);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-inset" role="img" aria-label={label}>
      {/* the guide in the centre */}
      <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <MausAvatar color="green" state={connected ? "proud" : "curious"} size={76} animated={!still} />
        </div>
      </div>
      <div className="relative flex h-full w-full items-center justify-center">
        {RINGS.map((apps, ring) => (
          <Ring key={ring} radius={[104, 164][ring]!} duration={[24, 36][ring]!} reverse={ring !== 1} index={ring} still={still}>
            {apps.map((app, i) => (
              <Badge key={app.slug} item={app} connected={connected && ring === 0 && i === 0} />
            ))}
          </Ring>
        ))}
      </div>
    </div>
  );
}
