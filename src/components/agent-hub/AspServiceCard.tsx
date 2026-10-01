import { useState } from "react";
import type { HubService } from "@/lib/agent-hub";
import { readinessPrompt, trustPrompt } from "@/lib/agent-hub";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { setComposerDraft } from "@/lib/drafts";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { ChannelPicker } from "./ChannelPicker";
import { ShieldCheck, Cpu, ChevronDown, ChevronUp } from "lucide-react";

export interface AspServiceCardProps {
  service: HubService;
  lastCheck?: string;
}

export function AspServiceCard({ service, lastCheck }: AspServiceCardProps) {
  const { state, dispatch } = useStore();
  const nonDmGroups = (state.groups ?? []).filter((g) => !g.dm);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    const currentIsNonDm = nonDmGroups.find((g) => g.id === state.selectedId);
    return currentIsNonDm ? currentIsNonDm.id : nonDmGroups[0]?.id ?? null;
  });

  const [toolsExpanded, setToolsExpanded] = useState(false);

  const handlePrompt = (promptText: string) => {
    if (!selectedRoomId) return;
    const room = (state.groups ?? []).find((g) => g.id === selectedRoomId);
    if (!room) return;

    const draftId = `group:${room.id}:${room.threadId}`;
    setComposerDraft(draftId, promptText);
    dispatch({ type: "togglePlugins", open: false });
    dispatch({ type: "select", id: room.id });
  };

  const handleCheckReadiness = () => {
    const prompt = readinessPrompt(service.endpoint);
    handlePrompt(prompt);
  };

  const handleCheckTrust = () => {
    if (!service.okxAgentId) return;
    const prompt = trustPrompt(service.okxAgentId, service.endpoint);
    handlePrompt(prompt);
  };

  return (
    <div
      className="flex flex-col border border-hairline bg-card p-4 transition-colors"
      data-testid={`asp-service-card-${service.id}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[14px] font-medium text-ink">
              {service.name}
            </h4>
            <Tag tone="accent" variant="soft" size="sm">
              Free MCP
            </Tag>
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-secondary">
            {service.endpoint}
          </div>
        </div>

        {lastCheck && (
          <div className="font-mono text-[10px] text-ink-secondary sm:text-right">
            {t("okxHub.lastCheck", { time: lastCheck })}
          </div>
        )}
      </div>

      {/* Boundary disclaimer */}
      <div className="mt-3 border border-hairline bg-inset p-2.5 font-mono text-[11px] text-ink-secondary">
        <span className="text-ink">[ BOUNDARY ]</span> {t("okxHub.freeBoundary")}
      </div>

      {/* Provenance */}
      <div className="mt-2 text-[12px] text-ink-secondary">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary">
          {t("okxHub.provenance", { provenance: service.provenance })}
        </span>
      </div>

      {/* Tool list */}
      <div className="mt-3 border-t border-hairline pt-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-ink-secondary">
            {t("okxHub.toolsCount", { count: service.tools.length })}
          </span>
          {service.tools.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="h-6 text-[11px]"
            >
              {toolsExpanded ? (
                <>
                  <ChevronUp size={12} className="mr-1 inline" /> Less
                </>
              ) : (
                <>
                  <ChevronDown size={12} className="mr-1 inline" /> Tools
                </>
              )}
            </Button>
          )}
        </div>

        {toolsExpanded && service.tools.length > 0 && (
          <div className="mt-2 flex max-h-48 flex-col gap-1.5 overflow-y-auto border border-hairline bg-inset p-2">
            {service.tools.map((tool) => (
              <div key={tool.name} className="flex flex-col gap-0.5">
                <span className="font-mono text-[11px] font-medium text-ink">
                  &gt;_ {tool.name}
                </span>
                {tool.description && (
                  <span className="text-[11px] text-ink-secondary">
                    {tool.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions & Target Channel */}
      <div className="mt-4 border-t border-hairline pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 sm:max-w-[260px]">
            <ChannelPicker
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
              disabled={nonDmGroups.length === 0}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedRoomId}
              onClick={handleCheckReadiness}
            >
              <Cpu size={12} className="mr-1.5 inline" />
              {t("okxHub.action.checkReadiness")}
            </Button>

            {service.okxAgentId && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!selectedRoomId}
                onClick={handleCheckTrust}
              >
                <ShieldCheck size={12} className="mr-1.5 inline" />
                {t("okxHub.action.checkTrust")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
