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
  isImported?: boolean;
  inRoom?: boolean;
}

export const AgentIdentity = memo(function AgentIdentity({
  bot,
  variant = "row",
  state,
  className,
  showCapabilities = true,
  isImported,
  inRoom,
}: AgentIdentityProps) {
  const sourceLabel = agentSourceLabel(bot);
  const isOkxCatalog = agentSource(bot) === "okx-catalog";
  const isInRoom = inRoom ?? Boolean(bot && "inRoom" in bot && bot.inRoom);
  const isImportedMember = isOkxCatalog && (
    isImported !== undefined
      ? isImported
      : bot && "isImported" in bot && bot.isImported !== undefined
        ? Boolean(bot.isImported)
        : Boolean(
            bot?.okxImport?.externalAgentId &&
            bot.id &&
            bot.id !== bot.okxImport.externalAgentId,
          )
  );
  const status = agentStatus(bot, state, { isImported: isImportedMember, inRoom: isInRoom });
  const statusLabel = agentStatusLabel(status);
  const capabilities = agentCapabilities(bot);
  const name = bot?.name || bot?.title || "Agent";
  const isOffline = status === "offline";
  const statusTone =
    status === "available"
      ? "success"
      : status === "working"
        ? "accent"
        : status === "testEngine"
          ? "warning"
          : "neutral";

  // Full accessible sentence for screen readers
  const typeText = isInRoom
    ? `${t("agent.type.inRoom")}. `
    : isImportedMember
      ? `${t("agent.type.imported")}. `
      : "";
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
        <AgentMark bot={bot} size={20} className="shrink-0" />
        <span className="font-semibold text-ink truncate max-w-[140px]" title={name} aria-label={name}>{name}</span>
        <span className="text-[10.5px] text-ink-secondary">({sourceLabel})</span>
        {isInRoom ? (
          <Tag tone="cyan" variant="soft" size="sm">
            {t("agent.type.inRoom")}
          </Tag>
        ) : isImportedMember ? (
          <Tag tone="cyan" variant="soft" size="sm">
            {t("agent.type.imported")}
          </Tag>
        ) : null}
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
        <div className="flex items-start gap-2.5 min-w-0">
          <AgentMark bot={bot} size={36} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink text-[14px] truncate" title={name} aria-label={name}>
              {name}
            </div>
            <div className="text-[11px] font-mono text-ink-secondary truncate" title={sourceLabel}>
              {sourceLabel}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {isInRoom ? (
                <Tag tone="cyan" variant="soft" size="sm">
                  {t("agent.type.inRoom")}
                </Tag>
              ) : isImportedMember ? (
                <Tag tone="cyan" variant="soft" size="sm">
                  {t("agent.type.imported")}
                </Tag>
              ) : null}
              <Tag tone={statusTone} variant="solid" size="sm">
                {statusLabel}
              </Tag>
            </div>
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
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <AgentMark bot={bot} size={28} className="shrink-0" />
        <span className="font-medium text-ink text-[13px] truncate" title={name} aria-label={name}>{name}</span>
        <span className="text-[11px] font-mono text-ink-secondary shrink-0">· {sourceLabel}</span>
        {isInRoom ? (
          <Tag tone="cyan" variant="soft" size="sm">
            {t("agent.type.inRoom")}
          </Tag>
        ) : isImportedMember ? (
          <Tag tone="cyan" variant="soft" size="sm">
            {t("agent.type.imported")}
          </Tag>
        ) : null}
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
