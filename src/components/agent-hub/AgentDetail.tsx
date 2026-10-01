import { useState } from "react";
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
import { Check, Loader2, ArrowRight, MessageSquare, AlertCircle, ArrowLeft } from "lucide-react";
import type { MausColor } from "@/lib/mascot";

function agentAvatarColor(key: string): MausColor {
  const tone = tileFor(key);
  if (tone === "violet") return "purple";
  if (tone === "magenta") return "pink";
  return tone;
}

export interface AgentDetailProps {
  agent: HubAgent;
  onBack: () => void;
}

export function AgentDetail({ agent, onBack }: AgentDetailProps) {
  const { state, dispatch } = useStore();
  const remoteClient = window.ogb?.remoteClient?.active === true;
  const nonDmGroups = (state.groups ?? []).filter((g) => !g.dm);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    const currentIsNonDm = nonDmGroups.find((g) => g.id === state.selectedId);
    return currentIsNonDm ? currentIsNonDm.id : nonDmGroups[0]?.id ?? null;
  });

  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ kind: ImportHubAgentResult["kind"]; message: string } | null>(null);

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
        <ChartAvatar
          size={56}
          name={agent.name}
          color={avatarColor}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold text-ink">{agent.name}</h3>
            <Tag tone="neutral" variant="soft" size="sm">
              {agent.provider}
            </Tag>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
            {agent.summary}
          </p>
        </div>
      </div>

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
          {t("okxHub.addToChannel")}
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
                  t("okxHub.addToChannel")
                )}
              </Button>
            )}

            {result && (
              <div
                role="status"
                className={`flex items-center gap-2 border p-2.5 text-[12px] font-mono ${
                  result.kind === "added"
                    ? "border-success/40 bg-success/10 text-success"
                    : result.kind === "already"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-danger/40 bg-danger/10 text-danger"
                }`}
              >
                {result.kind === "added" ? (
                  <Check size={14} className="shrink-0" />
                ) : (
                  <AlertCircle size={14} className="shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
