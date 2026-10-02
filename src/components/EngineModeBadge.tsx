import { memo } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { Message, Bot, InstanceInfo } from "@/state/store";

export type EngineBadgeState = "simulated" | "unavailable" | "live";

export interface EngineModeBadgeProps {
  mode?: EngineBadgeState;
  message?: Message;
  bot?: Bot | null;
  instance?: InstanceInfo | null;
  instances?: readonly InstanceInfo[] | InstanceInfo[] | null;
  variant?: "tag" | "status";
  className?: string;
}

export function resolveEngineModeState(options: {
  mode?: EngineBadgeState;
  message?: Message | null;
  bot?: Bot | null;
  instance?: InstanceInfo | null;
  instances?: readonly InstanceInfo[] | InstanceInfo[] | null;
}): EngineBadgeState {
  if (options.mode) return options.mode;
  if (options.message) {
    if (options.message.simulated === true || options.message.engine?.simulated === true) {
      return "simulated";
    }
    if (options.message.simulated === false || options.message.engine?.simulated === false) {
      return "live";
    }
  }

  const instances = options.instances ?? [];
  const instanceId = options.instance?.instanceId ?? options.bot?.modelSelection?.instanceId;
  const targetInstance = instanceId
    ? instances.find((i) => i.instanceId === instanceId)
    : (options.instance ?? instances.find((i) => i.snapshot?.state === "available") ?? instances[0]);

  if (!targetInstance || targetInstance.snapshot?.state !== "available") {
    return "unavailable";
  }

  const isSimulated = Boolean(
    targetInstance.simulated ||
    targetInstance.testEngine ||
    targetInstance.snapshot?.simulated ||
    targetInstance.snapshot?.testEngine
  );

  return isSimulated ? "simulated" : "live";
}

export const EngineModeBadge = memo(function EngineModeBadge({
  mode: explicitMode,
  message,
  bot,
  instance,
  instances,
  variant,
  className,
}: EngineModeBadgeProps) {
  const resolvedState = resolveEngineModeState({
    mode: explicitMode,
    message,
    bot,
    instance,
    instances,
  });

  // If a message was supplied without an explicit mode, and the message/engine is live,
  // do not clutter normal transcript messages with a live badge.
  if (message && !explicitMode && resolvedState === "live") {
    return null;
  }

  const isTagVariant = variant === "tag" || Boolean(message && !variant);

  if (resolvedState === "simulated") {
    const label = isTagVariant
      ? t("engine.badge.simulatedResponse")
      : t("engine.badge.testEngine");

    return (
      <span
        data-testid="engine-mode-badge"
        data-state="simulated"
        className={cn(
          "inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-amber-500 select-none",
          className,
        )}
        title={t("engine.badge.simulatedTooltip")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        {label}
      </span>
    );
  }

  if (resolvedState === "unavailable") {
    return (
      <span
        data-testid="engine-mode-badge"
        data-state="unavailable"
        className={cn(
          "inline-flex items-center gap-1 rounded border border-hairline bg-inset/50 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-ink-secondary select-none",
          className,
        )}
        title={t("agent.offlineReason")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" />
        <span>{t("agent.status.offline")}</span>
        <span className="sr-only">: {t("agent.offlineReason")}</span>
      </span>
    );
  }

  // live
  return (
    <span
      data-testid="engine-mode-badge"
      data-state="live"
      className={cn(
        "inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-500 select-none",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      {t("engine.badge.live")}
    </span>
  );
});
