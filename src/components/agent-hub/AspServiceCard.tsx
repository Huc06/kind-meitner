import { useMemo, useState } from "react";
import type { HubService } from "@/lib/agent-hub";
import {
  findLatestAspResults,
  importHubAgent,
  readinessPrompt,
  trustPrompt,
  PUBLIC_OKX_AGENT_ID,
  type AspScanEvidence,
} from "@/lib/agent-hub";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { setComposerDraft } from "@/lib/drafts";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { ChannelPicker, formatChannelName } from "./ChannelPicker";
import {
  ShieldCheck,
  Cpu,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  UserPlus,
} from "lucide-react";

export interface AspServiceCardProps {
  service: HubService;
  lastCheck?: string;
  evidence?: AspScanEvidence;
}

export function AspServiceCard({ service, lastCheck: _lastCheck, evidence: propEvidence }: AspServiceCardProps) {
  const { state, dispatch } = useStore();
  const nonDmGroups = (state.groups ?? []).filter((g) => !g.dm);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    const currentIsNonDm = nonDmGroups.find((g) => g.id === state.selectedId);
    return currentIsNonDm ? currentIsNonDm.id : nonDmGroups[0]?.id ?? null;
  });

  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    kind: "added" | "already" | "failed";
    message: string;
    subtext?: string;
  } | null>(null);

  // Scan state.groups messages with parseOkxActionCard for matching endpoint/agent id
  const evidence = useMemo(() => {
    if (propEvidence) return propEvidence;
    return findLatestAspResults(state.groups ?? [], service.endpoint, service.okxAgentId);
  }, [propEvidence, state.groups, service.endpoint, service.okxAgentId]);

  const readinessVerdict = evidence.readinessVerdict;
  const trustDecision = evidence.trustDecision;
  const lastCheckedTime = evidence.lastCheckedTime;
  const evidenceJson = evidence.evidenceJson;

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

  const handleViewTrustCard = () => {
    if (evidence.trustRoomId) {
      dispatch({ type: "select", id: evidence.trustRoomId });
      dispatch({ type: "togglePlugins", open: false });
    } else {
      const prompt = trustPrompt(service.okxAgentId || PUBLIC_OKX_AGENT_ID, service.endpoint);
      handlePrompt(prompt);
    }
  };

  const handleOpenListing = () => {
    const agentId = service.okxAgentId || PUBLIC_OKX_AGENT_ID;
    const url = `https://www.okx.ai/agents/${agentId}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyEndpoint = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(service.endpoint);
        setCopiedEndpoint(true);
        setTimeout(() => setCopiedEndpoint(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleCopyEvidence = async () => {
    if (!evidenceJson) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(evidenceJson);
        setCopiedEvidence(true);
        setTimeout(() => setCopiedEvidence(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleInviteMarkets = async () => {
    if (!selectedRoomId) {
      setInviteStatus({
        kind: "failed",
        message: "Could not invite this agent.",
        subtext: "Check that the room is active and try again.",
      });
      return;
    }
    setInvitePending(true);
    setInviteStatus(null);
    try {
      const res = await importHubAgent("okx-market-scout-v1", selectedRoomId);
      const room = (state.groups ?? []).find((g) => g.id === selectedRoomId);
      const roomName = room ? formatChannelName(room.name) : "channel";
      if (res.kind === "added") {
        setInviteStatus({
          kind: "added",
          message: t("okxHub.result.added", { room: roomName }),
        });
      } else if (res.kind === "already") {
        setInviteStatus({
          kind: "already",
          message: t("okxHub.result.already", { room: roomName }),
        });
      } else {
        setInviteStatus({
          kind: "failed",
          message: "Could not invite this agent.",
          subtext: "Check that the room is active and try again.",
        });
      }
    } catch {
      setInviteStatus({
        kind: "failed",
        message: "Could not invite this agent.",
        subtext: "Check that the room is active and try again.",
      });
    } finally {
      setInvitePending(false);
    }
  };

  return (
    <div
      className="flex flex-col border border-hairline bg-card p-4 transition-colors"
      data-testid={`asp-service-card-${service.id}`}
    >
      {/* Header: Name and Agent ID */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-[14px] font-medium text-ink">
              {service.name}
            </h4>
            <span className="font-mono text-[11px] text-ink-secondary">
              #{service.okxAgentId || PUBLIC_OKX_AGENT_ID}
            </span>
          </div>

          {/* Endpoint (copyable text) */}
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink-secondary">
            <span className="truncate text-ink select-all">{service.endpoint}</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleCopyEndpoint}
              className="h-5 px-1.5 text-[10px]"
              aria-label="Copy endpoint URL"
            >
              {copiedEndpoint ? (
                <>
                  <Check size={10} className="mr-0.5 inline text-success" /> Copied
                </>
              ) : (
                <>
                  <Copy size={10} className="mr-0.5 inline" /> Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Free / Paid, Wallet, Mainnet Badges */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <Tag tone="accent" variant="soft" size="sm">
            Free
          </Tag>
          <Tag tone="neutral" variant="outline" size="sm">
            Wallet: No
          </Tag>
          <Tag tone="neutral" variant="outline" size="sm">
            Mainnet: No
          </Tag>
        </div>
      </div>

      {/* Provenance */}
      <div className="mt-2 text-[12px] text-ink-secondary font-mono">
        <span className="text-ink-secondary">Provenance:</span>{" "}
        <span className="text-ink">{service.provenance}</span>
      </div>

      {/* Readiness Verdict + Trust Decision + Last Checked from result */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 border-y border-hairline py-3 font-mono text-[11px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-secondary">
            Readiness verdict
          </div>
          <div className="mt-1">
            {readinessVerdict ? (
              <Tag
                tone={
                  readinessVerdict === "PASS"
                    ? "success"
                    : readinessVerdict === "WARN"
                      ? "warning"
                      : "danger"
                }
                variant="solid"
                size="sm"
              >
                {readinessVerdict}
              </Tag>
            ) : (
              <span className="text-ink-secondary">Not checked yet</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-secondary">
            Trust decision
          </div>
          <div className="mt-1">
            {trustDecision ? (
              <Tag
                tone={
                  trustDecision === "GO"
                    ? "success"
                    : trustDecision === "CAUTION"
                      ? "warning"
                      : "danger"
                }
                variant="solid"
                size="sm"
              >
                {trustDecision}
              </Tag>
            ) : (
              <span className="text-ink-secondary">Not checked yet</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-secondary">
            Last checked time
          </div>
          <div className="mt-1 text-ink">
            {lastCheckedTime ? lastCheckedTime : "Not checked yet"}
          </div>
        </div>
      </div>

      {/* Tool count and expandable tool list */}
      <div className="mt-2 pt-1">
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

      {/* Target room picker & Actions */}
      <div className="mt-4 border-t border-hairline pt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 sm:max-w-[260px]">
            <ChannelPicker
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
              disabled={nonDmGroups.length === 0}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Run readiness scan */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedRoomId}
              onClick={handleCheckReadiness}
            >
              <Cpu size={12} className="mr-1.5 inline" />
              Run readiness scan
            </Button>

            {/* 2. View trust card */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedRoomId && !evidence.trustRoomId}
              onClick={handleViewTrustCard}
            >
              <ShieldCheck size={12} className="mr-1.5 inline" />
              View trust card
            </Button>

            {/* 3. Open endpoint / Open listing */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenListing}
            >
              <ExternalLink size={12} className="mr-1.5 inline" />
              Open listing
            </Button>

            {/* 4. Invite related agent (Markets) */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedRoomId || invitePending}
              onClick={handleInviteMarkets}
            >
              <UserPlus size={12} className="mr-1.5 inline" />
              Invite related agent
            </Button>

            {/* 5. Copy evidence */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!evidenceJson}
              title={
                !evidenceJson
                  ? "No scan or trust card results recorded yet."
                  : undefined
              }
              onClick={handleCopyEvidence}
            >
              <Copy size={12} className="mr-1.5 inline" />
              {copiedEvidence ? "Evidence copied!" : "Copy evidence"}
            </Button>
          </div>
        </div>

        {/* Invite feedback with aria-live polite */}
        {inviteStatus && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-1.5 border px-2.5 py-1.5 text-[11px] font-mono ${
              inviteStatus.kind === "added"
                ? "border-success/40 bg-success/10 text-success"
                : inviteStatus.kind === "already"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {inviteStatus.kind === "added" ? (
              <Check size={12} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col gap-0.5">
              <span>{inviteStatus.message}</span>
              {inviteStatus.subtext && (
                <span className="text-[10px] opacity-80">{inviteStatus.subtext}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
