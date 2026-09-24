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

export type InterventionCommand =
  | { type: "inspect_blocker"; taskId: string }
  | { type: "open_conversation"; agentId: string }
  | { type: "unblock_task"; taskId: string }
  | { type: "approve_task"; taskId: string }
  | { type: "request_changes"; taskId: string; reason: string }
  | { type: "provide_input"; agentId: string; taskId?: string };
function presenceBadge(presence?: string): { label: string; tone: string } {
  switch (presence) {
    case "working":
      return { label: "Working", tone: "bg-success/20 text-success border-success/30" };
    case "blocked":
      return { label: "BLOCKED", tone: "bg-danger/20 text-danger border-danger/40 animate-pulse font-bold" };
    case "waiting":
      return { label: "Waiting", tone: "bg-warning/20 text-warning border-warning/30" };
    case "reviewing":
      return { label: "Reviewing", tone: "bg-accent/20 text-accent border-accent/40 font-semibold" };
    case "completed":
      return { label: "Completed", tone: "bg-success/10 text-success/80 border-success/20" };
    case "offline":
      return { label: "Offline", tone: "bg-control text-ink-secondary border-hairline/40" };
    default:
      return { label: "Ready", tone: "bg-inset text-ink-secondary border-hairline/40" };
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
}: {
  snapshot: WorkflowSnapshot;
  bots?: Bot[];
  agentId?: string | null;
  taskId?: string | null;
  onClose: () => void;
  onSelectAgent?: (id: string) => void;
  onSelectTask?: (id: string) => void;
  onIntervene?: (command: InterventionCommand) => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "artifacts">("overview");
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
      className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#12151A]/85 backdrop-blur-xl shadow-2xl shadow-black/60 outline-none"
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
        <div className="flex items-center gap-2 truncate">
          <SlidersHorizontal size={14} className="shrink-0 text-white/50" aria-hidden="true" />
          <h3 className="truncate text-[13.5px] font-semibold text-white/95">Inspector</h3>
          <span className="text-white/40">·</span>
          <span className="truncate text-[12px] text-white/70">{agentName}</span>
        </div>
        <button
          type="button"
          aria-label="Close inspector drawer"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-white/50 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={15} />
        </button>
      </div>

      {/* Tabs for Progressive Disclosure */}
      <div className="flex h-10 shrink-0 border-b border-white/[0.08] bg-black/20 px-4 text-[12px]">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 font-medium transition-colors outline-none",
            activeTab === "overview"
              ? "border-accent text-white"
              : "border-transparent text-white/50 hover:text-white/80",
          )}
        >
          <span>Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 font-medium transition-colors outline-none",
            activeTab === "history"
              ? "border-accent text-white"
              : "border-transparent text-white/50 hover:text-white/80",
          )}
        >
          <span>Collaboration</span>
          {messages.length > 0 && (
            <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] text-white/70">
              {messages.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("artifacts")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 font-medium transition-colors outline-none",
            activeTab === "artifacts"
              ? "border-accent text-white"
              : "border-transparent text-white/50 hover:text-white/80",
          )}
        >
          <span>Artifacts</span>
          {artifacts.length > 0 && (
            <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] text-white/70">
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
            <section className="space-y-3 rounded-xl border border-white/[0.08] bg-[#1C2025]/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Agent Identity
                </span>
                <span className={cn("rounded-[6px] border px-2 py-0.5 text-[10.5px] font-medium", presenceBadge(agentPresence).tone)}>
                  {presenceBadge(agentPresence).label}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {agentId && (
                  <TeamMapAgentAvatar
                    agentId={agentId}
                    name={agentName}
                    presence={agentPresence as any}
                    size={38}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[14px] font-semibold text-white/95">{agentName}</h4>
                  <p className="truncate text-[11.5px] text-white/55">{agentRole}</p>
                </div>
              </div>
            </section>

            {/* 2. Current Task & Workload */}
            <section className="space-y-3 rounded-xl border border-white/[0.08] bg-[#1C2025]/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  Current Task
                </span>
                {taskState && (
                  <span className="rounded-[6px] bg-white/[0.08] px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase text-white/70">
                    {taskState}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-[13.5px] font-semibold text-white/90">
                  {taskTitle ?? "No active task assigned"}
                </h4>
                {snapshot.objective && (
                  <p className="mt-1 text-[11.5px] text-white/50">
                    <span className="font-medium text-white/70">Objective:</span> {snapshot.objective}
                  </p>
                )}
              </div>

              {taskProgress !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>Progress</span>
                    <span className="font-mono tabular-nums text-white/80">{taskProgress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${taskProgress}%` }} />
                  </div>
                </div>
              )}

              {snapshotTask?.dependsOnTaskIds && snapshotTask.dependsOnTaskIds.length > 0 && (
                <div className="rounded-lg bg-black/30 p-2.5 text-[11.5px]">
                  <span className="font-medium text-white/80">Depends on:</span>
                  <ul className="mt-1 space-y-1 text-white/60">
                    {snapshotTask.dependsOnTaskIds.map((depId) => (
                      <li key={depId}>
                        <button
                          type="button"
                          onClick={() => onSelectTask?.(depId)}
                          className="text-accent hover:underline"
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
            <section className="space-y-2 rounded-xl border border-white/[0.08] bg-[#1C2025]/80 p-3.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
                <span>Operational Action</span>
                <span className="text-[10.5px] text-white/40">Verified command</span>
              </div>

              {agentId && (
                <button
                  type="button"
                  onClick={() => onIntervene?.({ type: "open_conversation", agentId })}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-[12px] font-semibold text-accent hover:bg-accent/25 focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  <span>Open 1:1 Conversation with {agentName}</span>
                </button>
              )}

              {taskState === "blocked" && (
                <div className="rounded-lg bg-danger/10 p-2.5 text-[11px] text-danger">
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
                <h5 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Ownership Transfers
                </h5>
                <div className="space-y-2">
                  {transfers.map((xfer) => (
                    <div key={xfer.id} className="rounded-xl border border-white/[0.08] bg-[#1C2025] p-3 text-[11.5px]">
                      <div className="font-semibold text-white/90">
                        {snapshot.agents.find((a) => a.id === xfer.fromAgentId)?.name ?? xfer.fromAgentId} →{" "}
                        {snapshot.agents.find((a) => a.id === xfer.toAgentId)?.name ?? xfer.toAgentId}
                      </div>
                      <p className="mt-1 text-white/60">{xfer.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Messages */}
            <section className="space-y-2.5">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Recent Communication
              </h5>
              {messages.length === 0 ? (
                <p className="text-[12px] text-white/40">No messages recorded for this scope.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-xl border border-white/[0.06] bg-[#1C2025] p-3 text-[11.5px]">
                      <div className="flex items-center justify-between text-white/50">
                        <span className="font-semibold text-white/80">
                          {snapshot.agents.find((a) => a.id === m.fromAgentId)?.name ?? m.fromAgentId}
                        </span>
                        <span className="font-mono text-[10px]">{new Date(m.at).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-white/70">{m.text}</p>
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
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Deliverables &amp; Artifacts ({artifacts.length})
              </h5>
              <span className="text-[10.5px] text-white/40 font-mono">Sample workflow data — not live commerce</span>
            </div>

            {artifacts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] bg-black/20 p-6 text-center">
                <div className="mx-auto flex size-9 items-center justify-center rounded-md bg-white/[0.04] text-white/40">
                  <FileText size={16} aria-hidden="true" />
                </div>
                <p className="mt-2.5 text-[12.5px] font-medium text-white/80">No artifacts submitted yet</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40 max-w-xs mx-auto">
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
                      className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-[#16191E]/90 p-3 transition hover:border-white/[0.16]"
                    >
                      {/* Title & Type Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={14} className="shrink-0 text-accent" aria-hidden="true" />
                          <span className="truncate font-semibold text-white/90 text-[12.5px]">{art.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {effectiveApproved && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              <CheckCircle2 size={10} /> Approved
                            </span>
                          )}
                          {isUnderReview && (
                            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                              Under Review
                            </span>
                          )}
                          {isSuperseded && (
                            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/40">
                              Superseded
                            </span>
                          )}
                          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/50">
                            {art.type}
                          </span>
                        </div>
                      </div>

                      {/* Summary */}
                      {art.summary && (
                        <p className="text-[11.5px] leading-relaxed text-white/70">{art.summary}</p>
                      )}

                      {/* Content Preview Box if available */}
                      {art.contentPreview && (
                        <pre className="max-h-20 overflow-x-auto rounded-md border border-white/[0.06] bg-[#0E1013] p-2 font-mono text-[10px] leading-tight text-white/60">
                          {art.contentPreview}
                        </pre>
                      )}

                      {/* Role & Action Footer with BunUI button system */}
                      <div className="mt-1 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] text-white/50">
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
                                onIntervene?.({ type: "approve_task", taskId: art.taskId });
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[11.5px] font-medium text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                            >
                              <Check size={11} aria-hidden="true" />
                              <span>Approve</span>
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Inspect ${art.name}`}
                            onClick={() => setInspectingArtifact(art)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[11.5px] font-medium text-white/80 transition hover:bg-white/[0.08] hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-white/[0.12] bg-[#14171C] shadow-2xl overflow-hidden">
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={15} className="text-accent shrink-0" aria-hidden="true" />
                  <h4 className="truncate text-[13px] font-semibold text-white/95">
                    {inspectingArtifact.name}
                  </h4>
                </div>
                <button
                  type="button"
                  aria-label="Close inspection"
                  onClick={() => setInspectingArtifact(null)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <X size={14} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-[12px]">
                {/* Metadata summary */}
                <div className="grid grid-cols-2 gap-2 text-[11px] rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
                  <div>
                    <span className="text-white/40 block">Type</span>
                    <span className="font-mono text-white/80 uppercase">{inspectingArtifact.type}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Size</span>
                    <span className="font-mono text-white/80">{inspectingArtifact.sizeBytes ? `${Math.round(inspectingArtifact.sizeBytes / 1000)} KB` : "4 KB"}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Review state</span>
                    <span className="capitalize text-white/80">
                      {approvedArtifactIds.includes(inspectingArtifact.id) ? "Approved" : inspectingArtifact.reviewState ?? "Verified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Task</span>
                    <span className="font-mono text-white/80 truncate">{inspectingArtifact.taskId}</span>
                  </div>
                </div>

                {inspectingArtifact.summary && (
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                      Executive Summary
                    </span>
                    <p className="text-[12px] leading-relaxed text-white/80">
                      {inspectingArtifact.summary}
                    </p>
                  </div>
                )}

                {/* Content preview with copy button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
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
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] text-white/60 hover:bg-white/10 hover:text-white transition"
                      >
                        {copiedId === inspectingArtifact.id ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied!</span>
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
                  <pre className="max-h-60 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0A0C0E] p-3 font-mono text-[11px] leading-relaxed text-white/80">
                    {inspectingArtifact.contentPreview ?? "No raw preview content available for this deliverable."}
                  </pre>
                </div>
              </div>

              <footer className="flex items-center justify-between border-t border-white/[0.08] bg-black/30 px-4 py-2.5">
                <span className="text-[10.5px] text-white/40 font-mono">Sample workflow data — not live commerce</span>
                <div className="flex items-center gap-2">
                  {inspectingArtifact.assignedReviewerId === agentId && inspectingArtifact.reviewState === "under_review" && !approvedArtifactIds.includes(inspectingArtifact.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        setApprovedArtifactIds((prev) => [...prev, inspectingArtifact.id]);
                        onIntervene?.({ type: "approve_task", taskId: inspectingArtifact.taskId });
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-white shadow-sm transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
                    >
                      <Check size={12} aria-hidden="true" />
                      <span>Approve artifact</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectingArtifact(null)}
                    className="inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-[12px] font-medium text-white/80 hover:bg-white/[0.08] hover:border-white/20 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
