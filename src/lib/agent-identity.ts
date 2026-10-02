import { t } from "@/lib/i18n";
import type { Bot, InstanceInfo } from "@/state/store";

export type AgentSource = "okx-catalog" | "local";
export type AgentStatus = "available" | "offline" | "working" | "testEngine";

export type BotIdentityLike =
  | Bot
  | {
      id?: string;
      name?: string;
      title?: string;
      description?: string;
      busy?: boolean;
      activity?: "working" | "waiting-on-you" | "idle" | "no-signal" | "dead" | string;
      avatarUrl?: string | null;
      avatarCrop?: "mascot" | "circle" | "rounded" | "square";
      modelSelection?: {
        instanceId?: string;
        model?: string;
      };
      instanceId?: string;
      engineId?: string;
      okxImport?: {
        kind?: string;
        externalAgentId?: string;
        provider?: string;
        capabilities?: readonly string[] | string[];
        avatar?: string;
        catalogAvatar?: string;
      };
      isImported?: boolean;
      inRoom?: boolean;
    };

export interface EngineInstanceStateLike {
  instances?:
    | readonly InstanceInfo[]
    | InstanceInfo[]
    | ReadonlyArray<{
        instanceId: string;
        simulated?: boolean;
        testEngine?: boolean;
        snapshot?: {
          state?: string;
          reason?: string;
          simulated?: boolean;
        };
      }>
    | Array<{
        instanceId: string;
        simulated?: boolean;
        testEngine?: boolean;
        snapshot?: {
          state?: string;
          reason?: string;
          simulated?: boolean;
        };
      }>;
}

/**
 * Returns whether the agent originates from the local OKX catalog or is a local workspace bot.
 */
export function agentSource(bot?: BotIdentityLike | null): AgentSource {
  if (!bot) return "local";
  if (bot.okxImport?.kind === "okx-catalog" || Boolean(bot.okxImport)) {
    return "okx-catalog";
  }
  return "local";
}

/**
 * Returns the declared capabilities for an agent (from okxImport metadata if available).
 */
export function agentCapabilities(bot?: BotIdentityLike | null): string[] {
  if (!bot?.okxImport?.capabilities) return [];
  if (Array.isArray(bot.okxImport.capabilities)) {
    return [...bot.okxImport.capabilities];
  }
  return [];
}

/**
 * Detects agent status against current engine instances.
 * Offline = no available engine instance for the bot.
 */
export function agentStatus(
  bot?: BotIdentityLike | null,
  state?: EngineInstanceStateLike | null,
  options?: { isImported?: boolean; inRoom?: boolean },
): AgentStatus {
  if (!state?.instances || state.instances.length === 0) {
    return "offline";
  }

  const botObj = bot as {
    modelSelection?: { instanceId?: string };
    instanceId?: string;
    engineId?: string;
    activity?: string;
    busy?: boolean;
    isImported?: boolean;
    inRoom?: boolean;
    okxImport?: { externalAgentId?: string; kind?: string };
    id?: string;
  } | null | undefined;

  const instanceId =
    botObj?.modelSelection?.instanceId ??
    botObj?.instanceId ??
    botObj?.engineId;

  const matchingInstance = instanceId
    ? state.instances.find((i) => i.instanceId === instanceId)
    : state.instances.find((i) => i.snapshot?.state === "available") ?? state.instances[0];

  const isAvailable = instanceId
    ? matchingInstance?.snapshot?.state === "available"
    : state.instances.some((i) => i.snapshot?.state === "available");

  if (!isAvailable) {
    return "offline";
  }

  const isOkx = agentSource(bot) === "okx-catalog";
  // Catalog availability must not imply runtime connectivity:
  // show engine mode only for actual workspace bots (members/imported), never for catalog-only entries.
  const isActualWorkspaceBot =
    !isOkx ||
    Boolean(
      options?.inRoom ||
        options?.isImported ||
        botObj?.inRoom ||
        botObj?.isImported ||
        (botObj?.okxImport?.externalAgentId && botObj?.id && botObj.id !== botObj.okxImport.externalAgentId),
    );

  const instAny = matchingInstance as
    | { simulated?: boolean; testEngine?: boolean; snapshot?: { simulated?: boolean; testEngine?: boolean } }
    | undefined;
  if (
    isActualWorkspaceBot &&
    (instAny?.simulated === true ||
      instAny?.testEngine === true ||
      instAny?.snapshot?.simulated === true ||
      instAny?.snapshot?.testEngine === true)
  ) {
    return "testEngine";
  }

  if (isActualWorkspaceBot && (botObj?.activity === "working" || botObj?.busy === true)) {
    return "working";
  }

  return "available";
}
/**
 * Localized source label ("OKX.AI catalog" vs "Local workspace agent").
 */
export function agentSourceLabel(bot?: BotIdentityLike | null): string {
  return agentSource(bot) === "okx-catalog"
    ? t("agent.source.okxCatalog")
    : t("agent.source.local");
}

/**
 * Localized status label ("Available", "Working", or "Offline").
 */
export function agentStatusLabel(status: AgentStatus): string {
  switch (status) {
    case "available":
      return t("agent.status.available");
    case "testEngine":
      return t("agent.status.testEngine");
    case "working":
      return t("agent.status.working");
    case "offline":
    default:
      return t("agent.status.offline");
  }
}

/**
 * Localized offline title for an agent.
 */
export function agentOfflineTitle(bot?: BotIdentityLike | null): string {
  const name = bot?.name || bot?.title || "Agent";
  return t("agent.offlineTitle", { name });
}

/**
 * Localized reason explaining why an agent is offline.
 */
export function agentOfflineReason(): string {
  return t("agent.offlineReason");
}
