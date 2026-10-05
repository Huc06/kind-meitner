import { memo, useEffect, useState } from "react";
import { MausAvatar, defaultMascotBodyForBot } from "@/components/Avatar";
import type { MausColor } from "@/lib/mascot";
import { cn } from "@/lib/cn";
import { agentSource, type BotIdentityLike } from "@/lib/agent-identity";

export interface AgentMarkProps {
  bot?: BotIdentityLike | null;
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  label?: string;
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

  // Every agent without an uploaded photo wears its blob logo: the body picked
  // from its role (OKX catalog agents get their own distinct bodies).
  return (
    <span
      role={accessibleLabel ? "img" : undefined}
      aria-label={accessibleLabel}
      aria-hidden={isAriaHidden}
      data-agent-mark={agentSource(bot) === "okx-catalog" ? "okx" : "local"}
      className={cn("relative inline-flex shrink-0 items-center justify-center select-none", className)}
      style={{ width: size, height: size }}
    >
      <MausAvatar
        bodyId={defaultMascotBodyForBot(bot ?? {})}
        color={((bot as { color?: MausColor } | null | undefined)?.color) ?? "green"}
        state="happy"
        size={size}
        animated={false}
      />
    </span>
  );
});
