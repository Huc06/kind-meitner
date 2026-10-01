import { useEffect, useState } from "react";
import type { HubAgent, ImportHubAgentResult } from "@/lib/agent-hub";
import { importHubAgent } from "@/lib/agent-hub";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { setComposerDraft } from "@/lib/drafts";
import { ChartAvatar } from "@/components/Avatar";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { ChannelPicker, formatChannelName } from "./ChannelPicker";
import { tileFor } from "@/components/ui/tile";
import { Check, Loader2, ArrowRight, MessageSquare, AlertCircle } from "lucide-react";
import type { MausColor } from "@/lib/mascot";

function agentAvatarColor(key: string): MausColor {
  const tone = tileFor(key);
  if (tone === "violet") return "purple";
  if (tone === "magenta") return "pink";
  return tone;
}

export interface AgentCardProps {
  agent: HubAgent;
  viewMode?: "discover" | "workspace";
  onSelect?: (agent: HubAgent) => void;
  resultMessage?: { kind: ImportHubAgentResult["kind"]; message: string } | null;
}

export function AgentCard({
  agent,
  viewMode = "discover",
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
  const [result, setResult] = useState<{ kind: ImportHubAgentResult["kind"]; message: string } | null>(
    resultMessage ?? null,
  );

  useEffect(() => {
    if (resultMessage !== undefined) {
      setResult(resultMessage);
    }
  }, [resultMessage]);

  const handleImport = async () => {
    if (!selectedRoomId || remoteClient || isPending) return;
    setIsPending(true);
    setResult(null);

    const targetRoom = (state.groups ?? []).find((g) => g.id === selectedRoomId);
    const roomName = formatChannelName(targetRoom?.name ?? selectedRoomId);

    try {
      const res = await importHubAgent(agent.id, selectedRoomId);
      let message = "";
      switch (res.kind) {
        case "added":
          message = t("okxHub.result.added", { room: roomName });
          break;
        case "already":
          message = t("okxHub.result.already", { room: roomName });
          break;
        case "notFound":
          message = res.message ?? t("okxHub.result.notFound");
          break;
        case "dmRoom":
          message = res.message ?? t("okxHub.result.dmRoom");
          break;
        case "invalid":
          message = res.message ?? t("okxHub.result.invalid");
          break;
        case "network":
          message = res.message ?? t("okxHub.result.network");
          break;
      }
      setResult({ kind: res.kind, message });
    } catch (err) {
      setResult({
        kind: "network",
        message: err instanceof Error ? err.message : t("okxHub.result.network"),
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
    setComposerDraft(draftId, `@${agent.name} `);
    dispatch({ type: "togglePlugins", open: false });
    dispatch({ type: "select", id: targetRoom.id });
  };

  const avatarColor = agentAvatarColor(agent.id);
  const isImported = agent.rooms.length > 0;

  return (
    <div
      className="flex flex-col border border-hairline bg-card p-4 transition-colors hover:border-ink-secondary/40"
      data-testid={`agent-card-${agent.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <ChartAvatar
            size={40}
            name={agent.name}
            color={avatarColor}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              onClick={() => onSelect?.(agent)}
              className="cursor-pointer truncate text-[14px] font-medium text-ink hover:underline"
            >
              {agent.name}
            </h4>
            <span className="font-mono text-[11px] text-ink-secondary">
              {agent.provider}
            </span>
            {isImported && (
              <Tag tone="success" variant="soft" size="sm">
                {agent.rooms.length === 1
                  ? t("okxHub.inRoomsOne")
                  : t("okxHub.inRoomsMany", { count: agent.rooms.length })}
              </Tag>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-secondary">
            {agent.summary}
          </p>
        </div>
      </div>

      {agent.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.capabilities.map((cap) => (
            <Tag key={cap} tone="neutral" variant="outline" size="sm">
              {cap}
            </Tag>
          ))}
        </div>
      )}

      {/* Rooms display for imported agents */}
      {isImported && (
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="label-mono mb-2 text-[10px] text-ink-secondary">
            {agent.rooms.length === 1
              ? t("okxHub.inRoomsLabelOne")
              : t("okxHub.inRoomsLabelMany", { count: agent.rooms.length })}
          </div>
          <div className="flex flex-wrap gap-2">
            {agent.rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-1.5 border border-hairline bg-inset px-2 py-1 text-[11px] font-mono text-ink"
              >
                <span>{formatChannelName(room.name)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleOpenRoom(room.id)}
                  title={t("okxHub.action.openRoom")}
                  className="h-5 px-1 text-[10px]"
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
                  className="h-5 px-1 text-[10px]"
                >
                  <MessageSquare size={10} className="mr-0.5 inline" />
                  {t("okxHub.action.useInChannel")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to channel section in Discover view */}
      {viewMode === "discover" && (
        <div className="mt-4 border-t border-hairline pt-3">
          {remoteClient ? (
            <div className="text-[11px] font-mono text-ink-secondary">
              {t("okxHub.remoteClientDisabled")}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ChannelPicker
                    selectedRoomId={selectedRoomId}
                    onSelectRoom={setSelectedRoomId}
                    disabled={isPending || nonDmGroups.length === 0}
                  />
                </div>
                {nonDmGroups.length > 0 && (
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
                      t("okxHub.addToChannel")
                    )}
                  </Button>
                )}
              </div>

              {result && (
                <div
                  role="status"
                  className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-mono ${
                    result.kind === "added"
                      ? "border-success/40 bg-success/10 text-success"
                      : result.kind === "already"
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  {result.kind === "added" ? (
                    <Check size={12} className="shrink-0" />
                  ) : (
                    <AlertCircle size={12} className="shrink-0" />
                  )}
                  <span>{result.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
