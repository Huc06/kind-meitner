import { useState } from "react";
import type { HubAgent, ImportHubAgentResult } from "@/lib/agent-hub";
import { importHubAgent } from "@/lib/agent-hub";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { getDraft, setComposerDraft } from "@/lib/drafts";
import { AgentMark } from "@/components/agent-identity/AgentMark";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { ChannelPicker, formatChannelName } from "./ChannelPicker";
import { Check, Loader2, ArrowRight, MessageSquare, AlertCircle, ArrowLeft } from "lucide-react";
import type { BotIdentityLike } from "@/lib/agent-identity";

export interface AgentDetailProps {
  agent: HubAgent;
  bot?: BotIdentityLike;
  onBack: () => void;
}

export function AgentDetail({ agent, bot, onBack }: AgentDetailProps) {
  const { state, dispatch } = useStore();
  const remoteClient = window.ogb?.remoteClient?.active === true;
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
  } | null>(null);

  const isOkx = agent.provider.toLowerCase().includes("okx") || Boolean(bot?.okxImport);

  const botForIdentity: BotIdentityLike = bot ?? {
    id: agent.importedBotId ?? agent.id,
    name: agent.name,
    description: agent.summary,
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

  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6" data-testid={`agent-detail-${agent.id}`}>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onBack}
          className="mb-3 text-[11px]"
        >
          <ArrowLeft size={12} className="mr-1 inline" /> Back
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <AgentMark
          bot={botForIdentity}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold text-ink">{agent.name}</h3>
            <Tag tone={isOkx ? "cyan" : "neutral"} variant="soft" size="sm">
              {isOkx ? t("okxHub.provenance.localCatalog") : t("okxHub.provenance.localWorkspace")}
            </Tag>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
            {agent.summary}
          </p>
        </div>
      </div>

      {agent.capabilities.length > 0 && (
        <div className="border-t border-hairline pt-4">
          <h4 className="label-mono mb-2 text-ink-secondary">Capabilities</h4>
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.map((cap) => (
              <Tag key={cap} tone="neutral" variant="outline" size="sm">
                {cap}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {agent.rooms.length > 0 && (
        <div className="border-t border-hairline pt-4">
          <h4 className="label-mono mb-2 text-ink-secondary">
            {agent.rooms.length === 1
              ? t("okxHub.inRoomsLabelOne")
              : t("okxHub.inRoomsLabelMany", { count: agent.rooms.length })}
          </h4>
          <div className="flex flex-wrap gap-2">
            {agent.rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-2 border border-hairline bg-card px-3 py-1.5 font-mono text-[12px] text-ink"
              >
                <span>{formatChannelName(room.name)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleOpenRoom(room.id)}
                  title={t("okxHub.action.openRoom")}
                >
                  <ArrowRight size={11} className="mr-1 inline" />
                  {t("okxHub.action.openRoom")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleUseInChannel(room.id)}
                  title={t("okxHub.action.useInChannel")}
                >
                  <MessageSquare size={11} className="mr-1 inline" />
                  {t("okxHub.action.useInChannel")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-hairline pt-4">
        <h4 className="label-mono mb-2 text-ink-secondary">
          Invite to room
        </h4>
        {remoteClient ? (
          <div className="text-[12px] font-mono text-ink-secondary">
            {t("okxHub.remoteClientDisabled")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-w-[400px]">
            <ChannelPicker
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
              disabled={isPending || nonDmGroups.length === 0}
            />
            {nonDmGroups.length > 0 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isPending || !selectedRoomId}
                onClick={handleImport}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                    {t("okxHub.adding")}
                  </>
                ) : (
                  "Invite to room"
                )}
              </Button>
            )}

            {result && (
              <div
                role="status"
                aria-live="polite"
                className={`flex items-start gap-2 border p-2.5 text-[12px] font-mono ${
                  result.kind === "added"
                    ? "border-success/40 bg-success/10 text-success"
                    : result.kind === "already"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-danger/40 bg-danger/10 text-danger"
                }`}
              >
                {result.kind === "added" ? (
                  <Check size={14} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
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
