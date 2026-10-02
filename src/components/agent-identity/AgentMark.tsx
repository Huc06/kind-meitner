import { memo, useEffect, useState } from "react";
import { Compass, LineChart, Network, Radar, ShieldCheck } from "lucide-react";
import { tileFor } from "@/components/ui/tile";
import type { TileTone } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { agentSource, type BotIdentityLike } from "@/lib/agent-identity";

const TILE_BAR_BG: Record<TileTone, string> = {
  red: "bg-tile-red",
  pink: "bg-tile-pink",
  green: "bg-tile-green",
  violet: "bg-tile-violet",
  yellow: "bg-tile-yellow",
  cyan: "bg-tile-cyan",
  orange: "bg-tile-orange",
  magenta: "bg-tile-magenta",
};

export interface AgentMarkProps {
  bot?: BotIdentityLike | null;
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  label?: string;
}

function resolveOkxIcon(bot?: BotIdentityLike | null) {
  const okx = bot?.okxImport as
    | { catalogAvatar?: string; avatar?: string; externalAgentId?: string }
    | undefined;
  const avatar = okx?.catalogAvatar ?? okx?.avatar;
  if (avatar === "chart") return LineChart;

  const id = (okx?.externalAgentId ?? bot?.id ?? "").toLowerCase();
  if (id === "okx-spend-scout" || id.includes("spend") || id.includes("shield")) {
    return ShieldCheck;
  }
  if (id === "okx-market-scout-v1" || id.includes("market") || id.includes("radar")) {
    return Radar;
  }
  if (id === "okx-listing-coach" || id.includes("listing") || id.includes("coach") || id.includes("compass")) {
    return Compass;
  }
  return Network;
}

export const AgentMark = memo(function AgentMark({
  bot,
  size = 28,
  className,
  "aria-hidden": explicitAriaHidden,
  "aria-label": explicitAriaLabel,
  label,
}: AgentMarkProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [bot?.avatarUrl]);

  const accessibleLabel = explicitAriaLabel ?? label;
  const isAriaHidden = accessibleLabel ? undefined : (explicitAriaHidden ?? true);

  const hasUploadedImage =
    Boolean(bot?.avatarUrl) &&
    bot?.avatarCrop !== "mascot" &&
    !imageFailed;

  if (hasUploadedImage && bot?.avatarUrl) {
    return (
      <img
        src={bot.avatarUrl}
        alt={accessibleLabel ?? (bot?.name ? `${bot.name} avatar` : "Agent avatar")}
        width={size}
        height={size}
        draggable={false}
        onError={() => setImageFailed(true)}
        className={cn(
          "block shrink-0 bg-raised object-cover border border-hairline",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  const isOkx = agentSource(bot) === "okx-catalog";
  if (isOkx) {
    const Icon = resolveOkxIcon(bot);
    const iconSize = Math.max(12, Math.round(size * 0.58));

    return (
      <span
        role={accessibleLabel ? "img" : undefined}
        aria-label={accessibleLabel}
        aria-hidden={isAriaHidden}
        data-agent-mark="okx"
        data-testid="agent-mark-okx"
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center border border-tile-cyan/60 bg-tile-cyan/12 text-tile-cyan select-none",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      </span>
    );
  }

  const botKey = bot?.id || bot?.name || "local";
  const tone = tileFor(botKey);
  const leftBarColor = TILE_BAR_BG[tone] ?? "bg-tile-green";
  const initial = (bot?.name?.trim()?.[0] || bot?.id?.trim()?.[0] || "?").toUpperCase();
  const fontSize = Math.max(10, Math.round(size * 0.44));

  return (
    <span
      role={accessibleLabel ? "img" : undefined}
      aria-label={accessibleLabel}
      aria-hidden={isAriaHidden}
      data-agent-mark="local"
      data-testid="agent-mark-local"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-hairline bg-card text-ink font-mono font-semibold select-none",
        className,
      )}
      style={{ width: size, height: size, fontSize }}
    >
      <span
        className={cn("absolute left-0 top-0 bottom-0 w-[2px]", leftBarColor)}
        aria-hidden="true"
      />
      <span className="leading-none pl-[2px]">{initial}</span>
    </span>
  );
});
