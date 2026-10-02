import { useEffect, useState } from "react";
import type { HubAgent, ImportHubAgentResult } from "@/lib/agent-hub";
import { importHubAgent } from "@/lib/agent-hub";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { ChannelPicker, formatChannelName } from "./ChannelPicker";
import { AgentIdentity } from "@/components/agent-identity/AgentIdentity";
import type { BotIdentityLike } from "@/lib/agent-identity";
import { getDraft, setComposerDraft } from "@/lib/drafts";
import { Check, Loader2, ArrowRight, MessageSquare, AlertCircle } from "lucide-react";

export interface AgentCardProps {
  agent: HubAgent;
  bot?: BotIdentityLike;
  currentRoomId?: string | null;
  viewMode?: "discover" | "workspace";
  onSelect?: (agent: HubAgent) => void;
  resultMessage?: { kind: ImportHubAgentResult["kind"]; message: string; subtext?: string } | null;
}

export function AgentCard({
  agent,
  bot,
  currentRoomId: _currentRoomId,
  viewMode: _viewMode = "discover",
  onSelect,
  resultMessage,
}: AgentCardProps) {
  const { state, dispatch } = useStore();
  const remoteClient = typeof window !== "undefined" && window.ogb?.remoteClient?.active === true;
  const nonDmGroups = (state.groups ?? []).filter((g) => !g.dm);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    const currentIsNonDm = nonDmGroups.find((g) => g.id === state.selectedId);
    return currentIsNonDm ? currentIsNonDm.id : nonDmGroups[0]?.id ?? null;
  });

  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{
    kind: ImportHubAgentResult["kind"] | "failed";
    message: string;
    subtext?: string;
  } | null>(resultMessage ?? null);

  useEffect(() => {
    if (resultMessage !== undefined) {
      setResult(resultMessage);
    }
  }, [resultMessage]);

  const isOkx = agent.provider.toLowerCase().includes("okx") || Boolean(bot?.okxImport);
  const isAgentInRoom = Boolean(
    _currentRoomId &&
      (agent.rooms.some((r) => r.id === _currentRoomId) ||
        Boolean(bot?.id && state.groups?.find((g) => g.id === _currentRoomId)?.memberIds?.includes(bot.id))),
  );
  const inSelectedRoom = Boolean(
    selectedRoomId &&
      (agent.rooms.some((r) => r.id === selectedRoomId) ||
        Boolean(bot?.id && state.groups?.find((g) => g.id === selectedRoomId)?.memberIds?.includes(bot.id))),
  );
  const isAgentImported = isOkx && Boolean(
    agent.importedBotId ||
      agent.rooms.length > 0 ||
      (bot && Boolean(bot.okxImport)),
  );

  const botForIdentity: BotIdentityLike = bot ?? {
    id: agent.importedBotId ?? agent.id,
    name: agent.name,
    description: agent.summary,
    isImported: isAgentImported,
    inRoom: isAgentInRoom,
    okxImport: isOkx
      ? {
          kind: "okx-catalog",
          externalAgentId: agent.id,
          provider: "OKX.ai",
          capabilities: agent.capabilities,
        }
      : undefined,
  };

  const handleImport = async () => {
    if (!selectedRoomId || remoteClient || isPending) return;
    setIsPending(true);
    setResult(null);

    const targetRoom = (state.groups ?? []).find((g) => g.id === selectedRoomId);
    const roomName = formatChannelName(targetRoom?.name ?? selectedRoomId);

    if (!isOkx) {
      // Local workspace bot
      const botId = agent.importedBotId ?? agent.id;
      if (targetRoom?.memberIds?.includes(botId)) {
        setResult({
          kind: "already",
          message: t("okxHub.result.already", { room: roomName }),
        });
      } else if (targetRoom) {
        dispatch({
          type: "patchGroup",
          groupId: targetRoom.id,
          patch: { memberIds: [...(targetRoom.memberIds ?? []), botId] },
        });
        setResult({
          kind: "added",
          message: t("okxHub.result.added", { room: roomName }),
        });
      } else {
        setResult({
          kind: "invalid",
          message: "Could not invite this agent.",
          subtext: "Check that the room is active and try again.",
        });
      }
      setIsPending(false);
      return;
    }

    try {
      const res = await importHubAgent(agent.id, selectedRoomId);
      if (res.kind === "added") {
        setResult({
          kind: "added",
          message: t("okxHub.result.added", { room: roomName }),
        });
      } else if (res.kind === "already") {
        setResult({
          kind: "already",
          message: t("okxHub.result.already", { room: roomName }),
        });
      } else {
        setResult({
          kind: res.kind,
          message: "Could not invite this agent.",
          subtext: "Check that the room is active and try again.",
        });
      }
    } catch {
      setResult({
        kind: "network",
        message: "Could not invite this agent.",
        subtext: "Check that the room is active and try again.",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleOpenRoom = (roomId: string) => {
    dispatch({ type: "togglePlugins", open: false });
    dispatch({ type: "select", id: roomId });
  };

  const handleUseInChannel = (roomId: string) => {
    const targetRoom = (state.groups ?? []).find((g) => g.id === roomId);
    if (!targetRoom) return;
    const draftId = `group:${targetRoom.id}:${targetRoom.threadId}`;
    const store = typeof localStorage !== "undefined" ? localStorage : undefined;
    const existingDraft = getDraft(store, draftId);
    if (!existingDraft || existingDraft.trim() === "") {
      setComposerDraft(draftId, `@${agent.name} `);
    }
    dispatch({ type: "togglePlugins", open: false });
    dispatch({ type: "select", id: targetRoom.id });
  };

  const isImported = agent.rooms.length > 0;
  return (
    <div
      className="flex flex-col border border-hairline bg-card p-4 transition-colors hover:border-ink-secondary/40 gap-3"
      data-testid={`agent-card-${agent.id}`}
    >
      {/* AgentIdentity card variant */}
      <AgentIdentity
        bot={botForIdentity}
        variant="card"
        state={state}
        showCapabilities={false}
        isImported={isAgentImported}
        inRoom={isAgentInRoom}
      />

      {/* Description */}
      {agent.summary && (
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-secondary">
          {agent.summary}
        </p>
      )}

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="label-mono text-[10px] text-ink-secondary mr-1">
            Capabilities:
          </span>
          {agent.capabilities.map((cap) => (
            <Tag key={cap} tone="neutral" variant="outline" size="sm">
              {cap}
            </Tag>
          ))}
        </div>
      )}

      {/* Provenance */}
      <div className="font-mono text-[11px] text-ink-secondary">
        <span className="text-ink-secondary">Provenance:</span>{" "}
        <span className="text-ink">
          {isOkx ? t("okxHub.provenance.localCatalog") : t("okxHub.provenance.localWorkspace")}
        </span>
      </div>

      {/* Rooms display for imported agents */}
      {isImported && (
        <div className="border-t border-hairline pt-3 min-w-0 w-full">
          <div className="label-mono mb-2 text-[10px] text-ink-secondary">
            {agent.rooms.length === 1
              ? t("okxHub.inRoomsLabelOne")
              : t("okxHub.inRoomsLabelMany", { count: agent.rooms.length })}
          </div>
          <div className="flex flex-col gap-2 min-w-0 w-full">
            {agent.rooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col gap-1.5 border border-hairline bg-inset p-2 text-[11px] font-mono text-ink min-w-0 w-full overflow-hidden"
              >
                <span className="truncate font-medium min-w-0 w-full" title={formatChannelName(room.name)}>
                  {formatChannelName(room.name)}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0 w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleOpenRoom(room.id)}
                    title={t("okxHub.action.openRoom")}
                    className="h-5 px-1.5 text-[10px] shrink-0"
                  >
                    <ArrowRight size={10} className="mr-0.5 inline" />
                    {t("okxHub.action.openRoom")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleUseInChannel(room.id)}
                    title={t("okxHub.action.useInChannel")}
                    className="h-5 px-1.5 text-[10px] shrink-0"
                  >
                    <MessageSquare size={10} className="mr-0.5 inline" />
                    {t("okxHub.action.useInChannel")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite to room + View details actions */}
      <div className="mt-auto border-t border-hairline pt-3 flex flex-col gap-2">
        {remoteClient ? (
          <div className="text-[11px] font-mono text-ink-secondary">
            {t("okxHub.remoteClientDisabled")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {nonDmGroups.length > 1 && (
              <div className="w-full min-w-0">
                <ChannelPicker
                  selectedRoomId={selectedRoomId}
                  onSelectRoom={setSelectedRoomId}
                  disabled={isPending || nonDmGroups.length === 0}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!inSelectedRoom && nonDmGroups.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending || !selectedRoomId}
                  onClick={handleImport}
                  className="shrink-0"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={12} className="mr-1 animate-spin" />
                      {t("okxHub.adding")}
                    </>
                  ) : (
                    t("okxHub.inviteToRoom")
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelect?.(agent)}
                className="shrink-0"
              >
                {t("okxHub.viewDetails")}
              </Button>
            </div>

            {result && (
              <div
                role="status"
                aria-live="polite"
                className={`flex items-start gap-1.5 border px-2.5 py-1.5 text-[11px] font-mono ${
                  result.kind === "added"
                    ? "border-success/40 bg-success/10 text-success"
                    : result.kind === "already"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-danger/40 bg-danger/10 text-danger"
                }`}
              >
                {result.kind === "added" ? (
                  <Check size={12} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-0.5">
                  <span>{result.message}</span>
                  {result.subtext && (
                    <span className="text-[10px] opacity-80">{result.subtext}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
