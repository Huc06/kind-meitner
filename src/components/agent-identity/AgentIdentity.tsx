import { memo } from "react";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import {
  agentCapabilities,
  agentOfflineReason,
  agentOfflineTitle,
  agentSource,
  agentSourceLabel,
  agentStatus,
  agentStatusLabel,
  type BotIdentityLike,
  type EngineInstanceStateLike,
} from "@/lib/agent-identity";
import { AgentMark } from "./AgentMark";

export interface AgentIdentityProps {
  bot: BotIdentityLike;
  variant?: "row" | "card" | "compact";
  state?: EngineInstanceStateLike | null;
  className?: string;
  showCapabilities?: boolean;
}

export const AgentIdentity = memo(function AgentIdentity({
  bot,
  variant = "row",
  state,
  className,
  showCapabilities = true,
}: AgentIdentityProps) {
  const isOkx = agentSource(bot) === "okx-catalog";
  const sourceLabel = agentSourceLabel(bot);
  const status = agentStatus(bot, state);
  const statusLabel = agentStatusLabel(status);
  const capabilities = agentCapabilities(bot);
  const name = bot?.name || bot?.title || "Agent";
  const isOffline = status === "offline";

  const statusTone =
    status === "available" ? "success" : status === "working" ? "accent" : "neutral";

  // Full accessible sentence for screen readers
  const typeText = isOkx ? `${t("agent.type.imported")}. ` : "";
  const capText = capabilities.length > 0 ? ` Capabilities: ${capabilities.join(", ")}.` : "";
  const offlineText = isOffline
    ? ` ${agentOfflineTitle(bot)} ${agentOfflineReason()}`
    : "";
  const srSentence = `${name}, ${sourceLabel}. ${typeText}Status: ${statusLabel}.${capText}${offlineText}`;

  if (variant === "compact") {
    return (
      <div
        className={cn("inline-flex items-center gap-2 text-[12px] font-mono", className)}
        data-agent-identity="compact"
      >
        <span className="sr-only">{srSentence}</span>
        <AgentMark bot={bot} size={20} />
        <span className="font-semibold text-ink truncate max-w-[140px]">{name}</span>
        <span className="text-[10.5px] text-ink-secondary">({sourceLabel})</span>
        {isOkx && (
          <Tag tone="cyan" variant="soft" size="sm">
            {t("agent.type.imported")}
          </Tag>
        )}
        <Tag tone={statusTone} variant="soft" size="sm">
          {statusLabel}
        </Tag>
        {isOffline && (
          <span className="text-[10.5px] text-ink-secondary truncate">{agentOfflineReason()}</span>
        )}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col gap-2.5 border border-hairline bg-card p-3 font-sans",
          className,
        )}
        data-agent-identity="card"
      >
        <span className="sr-only">{srSentence}</span>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AgentMark bot={bot} size={36} />
            <div className="min-w-0">
              <div className="font-semibold text-ink text-[14px] truncate">{name}</div>
              <div className="text-[11px] font-mono text-ink-secondary truncate">
                {sourceLabel}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOkx && (
              <Tag tone="cyan" variant="soft" size="sm">
                {t("agent.type.imported")}
              </Tag>
            )}
            <Tag tone={statusTone} variant="solid" size="sm">
              {statusLabel}
            </Tag>
          </div>
        </div>

        {showCapabilities && capabilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="label-mono text-[10px] text-ink-secondary mr-1">
              Capabilities:
            </span>
            {capabilities.map((cap) => (
              <Tag key={cap} tone="neutral" variant="outline" size="sm">
                {cap}
              </Tag>
            ))}
          </div>
        )}

        {isOffline && (
          <div className="mt-1 border-t border-hairline pt-2 text-[11px] font-mono text-ink-secondary">
            <div className="font-semibold text-ink mb-0.5">{agentOfflineTitle(bot)}</div>
            <div>{agentOfflineReason()}</div>
          </div>
        )}
      </div>
    );
  }

  // variant === "row" (default)
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 border border-hairline bg-card font-sans",
        className,
      )}
      data-agent-identity="row"
    >
      <span className="sr-only">{srSentence}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <AgentMark bot={bot} size={28} />
        <span className="font-medium text-ink text-[13px] truncate">{name}</span>
        <span className="text-[11px] font-mono text-ink-secondary">· {sourceLabel}</span>
        {isOkx && (
          <Tag tone="cyan" variant="soft" size="sm">
            {t("agent.type.imported")}
          </Tag>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showCapabilities && capabilities.length > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            {capabilities.map((cap) => (
              <Tag key={cap} tone="neutral" variant="outline" size="sm">
                {cap}
              </Tag>
            ))}
          </div>
        )}
        <Tag tone={statusTone} variant="soft" size="sm">
          {statusLabel}
        </Tag>
        {isOffline && (
          <span className="hidden md:inline text-[11px] font-mono text-ink-secondary">
            {agentOfflineReason()}
          </span>
        )}
      </div>
    </div>
  );
});
