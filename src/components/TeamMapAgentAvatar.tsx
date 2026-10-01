import { memo } from "react";
import { AgentMark } from "./agent-identity/AgentMark";

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
  interactive: _interactive = false,
  className,
}: TeamMapAgentAvatarProps) {
  const label = name ? `${name}, ${presence}` : `${agentId}, ${presence}`;
  const isOkx =
    agentId.startsWith("okx-") ||
    agentId === "Markets" ||
    agentId === "Spend Scout" ||
    agentId === "Listing Coach";

  const bot = {
    id: agentId,
    name: name ?? agentId,
    okxImport: isOkx ? { externalAgentId: agentId } : undefined,
  };

  return (
    <AgentMark
      bot={bot}
      size={size}
      className={className}
      aria-label={label}
    />
  );
}

export const TeamMapAgentAvatar = memo(TeamMapAgentAvatarComponent);
