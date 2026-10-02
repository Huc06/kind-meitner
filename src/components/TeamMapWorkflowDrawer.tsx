import { useEffect, useRef, useState } from "react";
import {
  X,
  MessageSquare,
  FileText,
  AlertCircle,
  SlidersHorizontal,
  CheckCircle2,
  Copy,
  Check,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  WorkflowSnapshot,
  WorkflowTask,
  WorkflowAgent,
  OwnershipTransfer,
  WorkflowArtifact,
} from "@/lib/team-map-workflow";
import type { Bot } from "@/state/store";
import { TeamMapAgentAvatar } from "./TeamMapAgentAvatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
export type InterventionCommand =
  | { type: "inspect_blocker"; taskId: string }
  | { type: "open_conversation"; agentId: string }
  | { type: "unblock_task"; taskId: string }
  | { type: "approve_task"; taskId: string }
  | { type: "approve_artifact"; artifactId: string; taskId: string }
  | { type: "request_changes"; taskId: string; reason: string }
  | { type: "provide_input"; agentId: string; taskId?: string };
function presenceBadge(presence?: string): { label: string; tone: string } {
  switch (presence) {
    case "working":
      return { label: "Working", tone: "border-success/60 bg-success/15 text-success" };
    case "blocked":
      return { label: "BLOCKED", tone: "border-danger bg-danger/20 text-danger animate-pulse font-bold" };
    case "waiting":
      return { label: "Waiting", tone: "border-warning/60 bg-warning/15 text-warning" };
    case "reviewing":
      return { label: "Reviewing", tone: "border-accent bg-accent/15 text-accent font-semibold" };
    case "completed":
      return { label: "Completed", tone: "border-success/40 bg-success/10 text-success" };
    case "offline":
      return { label: "Offline", tone: "border-hairline bg-control text-ink-secondary" };
    default:
      return { label: "Ready", tone: "border-hairline bg-inset text-ink-secondary" };
  }
}

export function TeamMapWorkflowDrawer({
  snapshot,
  bots = [],
  agentId,
  taskId,
  onClose,
  onSelectAgent: _onSelectAgent,
  onSelectTask,
  onIntervene,
  dataMode = "sample",
  initialTab = "overview",
}: {
  snapshot: WorkflowSnapshot;
  bots?: Bot[];
  agentId?: string | null;
  taskId?: string | null;
  onClose: () => void;
  onSelectAgent?: (id: string) => void;
  onSelectTask?: (id: string) => void;
  onIntervene?: (command: InterventionCommand) => void;
  dataMode?: "live" | "sample" | "empty" | "unavailable";
  initialTab?: "overview" | "history" | "artifacts";
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "artifacts">(initialTab);
  const [inspectingArtifact, setInspectingArtifact] = useState<WorkflowArtifact | null>(null);
  const [approvedArtifactIds, setApprovedArtifactIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus trap / entry on mount
  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  // 1. Resolve agent: from snapshot or fallback to real workspace bot
  const realBot = agentId ? bots.find((b) => b.id === agentId) : undefined;
  const snapshotAgent: WorkflowAgent | undefined = agentId
    ? snapshot.agents.find((a) => a.id === agentId)
    : undefined;

  const agentName = snapshotAgent?.name ?? realBot?.name ?? agentId ?? "Unknown agent";
  const agentRole = snapshotAgent?.role ?? realBot?.title ?? "AI Teammate";
  const agentPresence = snapshotAgent?.presence ?? (realBot?.busy ? "working" : realBot?.activity === "waiting-on-you" ? "waiting" : "idle");

  // 2. Resolve task: explicit taskId, snapshot task, or real bot task
  const snapshotTask: WorkflowTask | undefined = taskId
    ? snapshot.tasks.find((t) => t.id === taskId)
    : snapshotAgent?.currentTaskId
      ? snapshot.tasks.find((t) => t.id === snapshotAgent.currentTaskId)
      : snapshot.tasks.find((t) => t.ownerAgentId === agentId);

  const realBotTask = realBot?.tasks?.[0];

  const taskTitle = snapshotTask?.title ?? realBotTask?.title;
  const taskState = snapshotTask?.state ?? (realBot?.busy ? "active" : "queued");
  const taskProgress = snapshotTask?.progress ?? (snapshotTask?.state === "completed" ? 100 : undefined);

  // If neither an agent ID nor a task ID was provided, render nothing
  if (!agentId && !taskId) return null;

  // 3. Ownership History
  const transfers: OwnershipTransfer[] = snapshot.transfers.filter((x) => {
    if (taskId && x.taskId === taskId) return true;
    if (agentId && (x.fromAgentId === agentId || x.toAgentId === agentId)) return true;
    return false;
  });

  // 4. Collaboration messages & help requests
  const messages = snapshot.messages.filter((m) => {
    if (taskId && m.taskId === taskId) return true;
    if (agentId && (m.fromAgentId === agentId || m.toAgentId === agentId)) return true;
    return false;
  });

  // 5. Artifacts / Deliverables (both authored by agent or assigned for review)
  const artifacts: WorkflowArtifact[] = (snapshot.artifacts ?? []).filter((art) => {
    if (taskId && art.taskId === taskId) return true;
    if (agentId && (art.authorAgentId === agentId || art.assignedReviewerId === agentId)) return true;
    return false;
  });

  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label={`Workflow details for ${agentName}`}
      className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-hairline bg-panel text-ink shadow-2xl outline-none"
    >
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between frame-rule-below bg-app px-4">
        <div className="flex items-center gap-2 truncate">
          <SlidersHorizontal size={13} className="shrink-0 text-ink-secondary" aria-hidden="true" />
          <h3 className="label-mono truncate text-[12px] font-semibold text-ink">Inspector</h3>
          <span className="text-ink-secondary/40">·</span>
          <span className="truncate label-mono text-[11px] text-ink-secondary">{agentName}</span>
        </div>
        <button
          type="button"
          aria-label="Close inspector drawer"
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs for Progressive Disclosure */}
      <div className="flex h-10 shrink-0 frame-rule-below bg-app px-4 text-[12px]">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "nav-link flex items-center gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors outline-none",
            activeTab === "overview" && "text-ink font-semibold",
          )}
          data-active={activeTab === "overview" ? true : undefined}
        >
          <span>Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "nav-link flex items-center gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors outline-none",
            activeTab === "history" && "text-ink font-semibold",
          )}
          data-active={activeTab === "history" ? true : undefined}
        >
          <span>Collaboration</span>
          {messages.length > 0 && (
            <span className="border border-hairline bg-inset px-1 font-mono text-[10.5px] tabular-nums text-ink-secondary">
              {messages.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("artifacts")}
          className={cn(
            "nav-link flex items-center gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors outline-none",
            activeTab === "artifacts" && "text-ink font-semibold",
          )}
          data-active={activeTab === "artifacts" ? true : undefined}
        >
          <span>Artifacts</span>
          {artifacts.length > 0 && (
            <span className="border border-hairline bg-inset px-1 font-mono text-[10.5px] tabular-nums text-ink-secondary">
              {artifacts.length}
            </span>
          )}
        </button>
      </div>
      {/* Drawer Body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-[12.5px] leading-relaxed">
        {activeTab === "overview" && (
          <>
            {/* 1. Agent Identity Card */}
            <section className="space-y-3 border border-hairline bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label-mono text-[10.5px] text-ink-secondary">
                  Agent Identity
                </span>
                <span className={cn("border px-1.5 py-0.5 font-mono text-[10.5px]", presenceBadge(agentPresence).tone)}>
                  {presenceBadge(agentPresence).label}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {agentId && (
                  <TeamMapAgentAvatar
                    agentId={agentId}
                    name={agentName}
                    presence={agentPresence ?? "idle"}
                    size={36}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[13.5px] font-semibold text-ink">{agentName}</h4>
                  <p className="truncate text-[11px] text-ink-secondary">{agentRole}</p>
                </div>
              </div>
            </section>

            {/* 2. Current Task & Workload */}
            <section className="space-y-3 border border-hairline bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label-mono text-[10.5px] text-ink-secondary">
                  Current Task
                </span>
                {taskState && (
                  <span className="border border-hairline bg-inset px-1.5 py-0.5 font-mono text-[10.5px] uppercase text-ink-secondary">
                    {taskState}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-[13px] font-semibold text-ink">
                  {taskTitle ?? "No active task assigned"}
                </h4>
                {snapshot.objective && (
                  <p className="mt-1 text-[11px] text-ink-secondary">
                    <span className="font-medium text-ink">Objective:</span> {snapshot.objective}
                  </p>
                )}
              </div>

              {taskProgress !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>Progress</span>
                    <span className="font-mono tabular-nums text-ink">{taskProgress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden border border-hairline bg-inset">
                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${taskProgress}%` }} />
                  </div>
                </div>
              )}

              {snapshotTask?.dependsOnTaskIds && snapshotTask.dependsOnTaskIds.length > 0 && (
                <div className="border border-hairline bg-inset p-2.5 text-[11.5px]">
                  <span className="font-medium text-ink">Depends on:</span>
                  <ul className="mt-1 space-y-1 text-ink-secondary">
                    {snapshotTask.dependsOnTaskIds.map((depId) => (
                      <li key={depId}>
                        <button
                          type="button"
                          onClick={() => onSelectTask?.(depId)}
                          className="text-ink underline hover:text-ink-secondary"
                        >
                          {snapshot.tasks.find((t) => t.id === depId)?.title || depId}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* 3. Truthful Operational Actions (Never fakes state mutation) */}
            <section className="space-y-2 border border-hairline bg-card p-3.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
                <span className="label-mono text-[10.5px] text-ink-secondary">Operational Action</span>
                <span className="font-mono text-[10.5px] text-ink-secondary">Verified command</span>
              </div>

              {agentId && (
                <button
                  type="button"
                  onClick={() => onIntervene?.({ type: "open_conversation", agentId })}
                  className="flex w-full items-center justify-center gap-1.5 border border-hairline bg-raised px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink hover:border-ink hover:bg-raised-hover focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  <span>Open 1:1 Conversation with {agentName}</span>
                </button>
              )}

              {taskState === "blocked" && (
                <div className="border border-danger/40 bg-danger/10 p-2.5 text-[11px] text-danger">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle size={13} aria-hidden="true" />
                    <span>Agent is blocked</span>
                  </div>
                  <p className="mt-1 text-danger/80">
                    Send instructions or resolve dependencies directly through the conversation.
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Ownership transfers */}
            {transfers.length > 0 && (
              <section className="space-y-2.5">
                <h5 className="label-mono text-[10.5px] text-ink-secondary">
                  Ownership Transfers
                </h5>
                <div className="space-y-2">
                  {transfers.map((xfer) => (
                    <div key={xfer.id} className="border border-hairline bg-card p-3 text-[11.5px]">
                      <div className="font-semibold text-ink">
                        {snapshot.agents.find((a) => a.id === xfer.fromAgentId)?.name ?? xfer.fromAgentId} →{" "}
                        {snapshot.agents.find((a) => a.id === xfer.toAgentId)?.name ?? xfer.toAgentId}
                      </div>
                      <p className="mt-1 text-ink-secondary">{xfer.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Messages */}
            <section className="space-y-2.5">
              <h5 className="label-mono text-[10.5px] text-ink-secondary">
                Recent Communication
              </h5>
              {messages.length === 0 ? (
                <p className="text-[12px] text-ink-secondary">No messages recorded for this scope.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="border border-hairline bg-card p-3 text-[11.5px]">
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span className="font-semibold text-ink">
                          {snapshot.agents.find((a) => a.id === m.fromAgentId)?.name ?? m.fromAgentId}
                        </span>
                        <span className="font-mono text-[10.5px] tabular-nums">{new Date(m.at).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-ink">{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "artifacts" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="label-mono text-[10.5px] text-ink-secondary">
                Deliverables &amp; Artifacts ({artifacts.length})
              </h5>
              <span className="font-mono text-[10.5px] text-ink-secondary">
                {dataMode === "live" ? "Live deliverables" : "Sample workflow data — not live commerce"}
              </span>
            </div>

            {artifacts.length === 0 ? (
              <div className="frame-edge p-6 text-center">
                <div className="mx-auto flex size-8 items-center justify-center border border-hairline bg-inset text-ink-secondary">
                  <FileText size={15} aria-hidden="true" />
                </div>
                <p className="mt-2.5 text-[12.5px] font-medium text-ink">No artifacts submitted yet</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary max-w-xs mx-auto">
                  {agentName} has not published deliverables for this task cycle. Artifacts appear automatically when an agent commits code, reports, or contracts.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {artifacts.map((art) => {
                  const isAuthor = art.authorAgentId === agentId;
                  const isReviewer = art.assignedReviewerId === agentId;
                  const effectiveApproved = art.reviewState === "approved" || approvedArtifactIds.includes(art.id);
                  const isUnderReview = art.reviewState === "under_review" && !effectiveApproved;
                  const isSuperseded = art.reviewState === "superseded";

                  return (
                    <div
                      key={art.id}
                      className="flex flex-col gap-2 border border-hairline bg-card p-3 transition-colors hover:border-ink hover:bg-raised-hover"
                    >
                      {/* Title & Type Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={14} className="shrink-0 text-ink" aria-hidden="true" />
                          <span className="truncate font-semibold text-ink text-[12.5px]">{art.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {effectiveApproved && (
                            <Tag tone="success" variant="solid" size="sm">
                              <CheckCircle2 size={10} /> Approved
                            </Tag>
                          )}
                          {isUnderReview && (
                            <Tag tone="warning" variant="solid" size="sm">
                              Under Review
                            </Tag>
                          )}
                          {isSuperseded && (
                            <Tag tone="neutral" size="sm">
                              Superseded
                            </Tag>
                          )}
                          <span className="border border-hairline bg-inset px-1.5 py-0.5 font-mono text-[10.5px] uppercase text-ink-secondary">
                            {art.type}
                          </span>
                        </div>
                      </div>

                      {/* Summary */}
                      {art.summary && (
                        <p className="text-[11.5px] leading-relaxed text-ink-secondary">{art.summary}</p>
                      )}

                      {/* Content Preview Box if available */}
                      {art.contentPreview && (
                        <pre className="max-h-20 overflow-x-auto border border-hairline bg-inset p-2 font-mono text-[10.5px] leading-tight text-ink-secondary">
                          {art.contentPreview}
                        </pre>
                      )}

                      {/* Role & Action Footer */}
                      <div className="mt-1 flex items-center justify-between frame-rule-above pt-2 text-[11px] text-ink-secondary">
                        <span className="truncate mr-2">
                          {isReviewer ? "Assigned for review" : isAuthor ? "Authored deliverable" : "Task artifact"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isReviewer && isUnderReview && (
                            <button
                              type="button"
                              aria-label={`Approve ${art.name}`}
                              onClick={() => {
                                setApprovedArtifactIds((prev) => [...prev, art.id]);
                                onIntervene?.({ type: "approve_artifact", artifactId: art.id, taskId: art.taskId });
                              }}
                              className={cn(buttonClass({ variant: "primary", size: "xs" }), "gap-1 font-mono normal-case")}
                            >
                              <Check size={11} aria-hidden="true" />
                              <span>Approve</span>
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Inspect ${art.name}`}
                            onClick={() => setInspectingArtifact(art)}
                            className={cn(buttonClass({ variant: "secondary", size: "xs" }), "gap-1 font-mono normal-case")}
                          >
                            <Eye size={11} aria-hidden="true" />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* In-drawer Inspect Detail View */}
        {inspectingArtifact && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Inspect ${inspectingArtifact.name}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col border border-hairline bg-panel shadow-2xl overflow-hidden">
              <header className="flex h-11 shrink-0 items-center justify-between frame-rule-below bg-app px-4">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-ink shrink-0" aria-hidden="true" />
                  <h4 className="truncate text-[13px] font-semibold text-ink">
                    {inspectingArtifact.name}
                  </h4>
                </div>
                <button
                  type="button"
                  aria-label="Close inspection"
                  onClick={() => setInspectingArtifact(null)}
                  className="inline-flex size-7 items-center justify-center text-ink-secondary hover:bg-raised-hover hover:text-ink"
                >
                  <X size={14} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-[12px]">
                {/* Metadata summary */}
                <div className="grid grid-cols-2 gap-2 text-[11px] border border-hairline bg-inset p-2.5">
                  <div>
                    <span className="label-mono text-[10.5px] text-ink-secondary block">Type</span>
                    <span className="font-mono text-ink uppercase">{inspectingArtifact.type}</span>
                  </div>
                  <div>
                    <span className="label-mono text-[10.5px] text-ink-secondary block">Size</span>
                    <span className="font-mono text-ink">
                      {inspectingArtifact.sizeBytes !== undefined
                        ? `${Math.round(inspectingArtifact.sizeBytes / 1000)} KB`
                        : "Unspecified"}
                    </span>
                  </div>
                  <div>
                    <span className="label-mono text-[10.5px] text-ink-secondary block">Review state</span>
                    <span className="capitalize text-ink">
                      {approvedArtifactIds.includes(inspectingArtifact.id)
                        ? "Approved"
                        : (inspectingArtifact.reviewState ?? "Pending review")}
                    </span>
                  </div>
                  <div>
                    <span className="label-mono text-[10.5px] text-ink-secondary block">Task</span>
                    <span className="font-mono text-ink truncate">{inspectingArtifact.taskId}</span>
                  </div>
                </div>

                {inspectingArtifact.summary && (
                  <div>
                    <span className="label-mono text-[10.5px] text-ink-secondary block mb-1">
                      Executive Summary
                    </span>
                    <p className="text-[12px] leading-relaxed text-ink">
                      {inspectingArtifact.summary}
                    </p>
                  </div>
                )}

                {/* Content preview with copy button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="label-mono text-[10.5px] text-ink-secondary">
                      Deliverable Payload
                    </span>
                    {inspectingArtifact.contentPreview && (
                      <button
                        type="button"
                        aria-label="Copy deliverable content"
                        onClick={() => {
                          if (inspectingArtifact.contentPreview && typeof navigator !== "undefined" && navigator.clipboard) {
                            navigator.clipboard.writeText(inspectingArtifact.contentPreview);
                            setCopiedId(inspectingArtifact.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }
                        }}
                        className="inline-flex items-center gap-1 border border-hairline bg-inset px-2 py-0.5 font-mono text-[10.5px] text-ink hover:bg-raised-hover"
                      >
                        {copiedId === inspectingArtifact.id ? (
                          <>
                            <Check size={11} className="text-success" />
                            <span className="text-success font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <pre className="max-h-60 overflow-y-auto border border-hairline bg-inset p-3 font-mono text-[11px] leading-relaxed text-ink">
                    {inspectingArtifact.contentPreview ?? "No raw preview content available for this deliverable."}
                  </pre>
                </div>
              </div>

              <footer className="flex items-center justify-between frame-rule-above bg-app px-4 py-2.5">
                <span className="font-mono text-[10.5px] text-ink-secondary">
                  {dataMode === "live" ? "Live deliverable payload" : "Sample workflow data — not live commerce"}
                </span>
                <div className="flex items-center gap-2">
                  {inspectingArtifact.assignedReviewerId === agentId && inspectingArtifact.reviewState === "under_review" && !approvedArtifactIds.includes(inspectingArtifact.id) && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setApprovedArtifactIds((prev) => [...prev, inspectingArtifact.id]);
                        onIntervene?.({ type: "approve_artifact", artifactId: inspectingArtifact.id, taskId: inspectingArtifact.taskId });
                      }}
                    >
                      <Check size={12} aria-hidden="true" />
                      <span>Approve artifact</span>
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setInspectingArtifact(null)}
                  >
                    Close
                  </Button>
                </div>
              </footer>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
