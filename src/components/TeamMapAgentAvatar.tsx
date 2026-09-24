import { memo, useEffect, useState } from "react";
import { BotAvatar } from "bot-avatars";
import { cn } from "@/lib/cn";
import {
  presenceToBotAvatarState,
  resolveDemoAgentAvatar,
} from "@/lib/team-map-avatars";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export type TeamMapAgentAvatarProps = {
  agentId: string;
  name?: string;
  presence: string;
  size?: number;
  /** Pointer follow / click-to-hop. Off on dense lists; on in the drawer. */
  interactive?: boolean;
  className?: string;
};

function TeamMapAgentAvatarComponent({
  agentId,
  name,
  presence,
  size = 40,
  interactive = false,
  className,
}: TeamMapAgentAvatarProps) {
  const reducedMotion = usePrefersReducedMotion();
  const spec = resolveDemoAgentAvatar(agentId);
  const state = presenceToBotAvatarState(presence);
  const paused = reducedMotion || presence === "offline";
  const label = name ? `${name}, ${presence}` : `${agentId}, ${presence}`;

  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      title={label}
    >
      <BotAvatar
        type={spec.type}
        face={spec.face}
        state={state}
        size={size}
        seed={spec.seed}
        shading={spec.shading}
        {...(spec.color ? { color: spec.color } : {})}
        interactive={interactive && !reducedMotion}
        paused={paused}
        jumpEvery={presence === "working" ? 5 : 10}
        whirl={presence === "working" ? 1 : 0}
        aria-label={label}
      />
    </span>
  );
}

export const TeamMapAgentAvatar = memo(TeamMapAgentAvatarComponent);
