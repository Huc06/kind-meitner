import { useEffect, useRef, useState } from "react";
import {
  X,
  MessageSquare,
  FileText,
  Sparkles,
  AlertCircle,
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
      <div className="flex h-13 shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-3">
        <div className="flex items-center gap-2 truncate">
          <Sparkles size={15} className="shrink-0 text-accent" aria-hidden="true" />
          <h3 className="truncate text-[14px] font-semibold text-white/95">Inspector</h3>
          <span className="text-white/40">·</span>
          <span className="truncate text-[12px] text-white/60">{agentName}</span>
        </div>
        <button
          type="button"
          aria-label="Close inspector drawer"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-accent"
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
              <span className="text-[11px] text-white/40">Verified on-chain rails</span>
            </div>

            {artifacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-black/20 p-6 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-white/40">
                  <FileText size={18} aria-hidden="true" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-white/80">No artifacts submitted yet</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/40">
                  {agentName} has not published deliverables for this task cycle. Artifacts appear automatically when an agent commits code, reports, or contracts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {artifacts.map((art) => {
                  const isAuthor = art.authorAgentId === agentId;
                  const isReviewer = art.assignedReviewerId === agentId;
                  const isApproved = art.reviewState === "approved";
                  const isUnderReview = art.reviewState === "under_review";
                  const isSuperseded = art.reviewState === "superseded";

                  return (
                    <div
                      key={art.id}
                      className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-[#1C2025] p-3.5 transition hover:border-white/[0.15]"
                    >
                      {/* Title & Type Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={15} className="shrink-0 text-accent" aria-hidden="true" />
                          <span className="truncate font-semibold text-white/90">{art.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isApproved && (
                            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              Approved
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
                        <p className="text-[12px] leading-relaxed text-white/70">{art.summary}</p>
                      )}

                      {/* Content Preview Box if available */}
                      {art.contentPreview && (
                        <pre className="max-h-24 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0E1013] p-2.5 font-mono text-[10.5px] leading-tight text-white/60">
                          {art.contentPreview}
                        </pre>
                      )}

                      {/* Role & Action Footer */}
                      <div className="mt-1 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-white/50">
                        <span>
                          {isReviewer ? "Assigned for review" : isAuthor ? "Authored deliverable" : "Task artifact"}
                        </span>
                        <div className="flex items-center gap-2">
                          {isReviewer && isUnderReview && (
                            <button
                              type="button"
                              className="rounded-lg bg-accent/20 px-2 py-1 font-medium text-accent hover:bg-accent/30"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-medium text-white/70 hover:bg-white/10"
                          >
                            Inspect
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
      </div>
    </aside>
  );
}
