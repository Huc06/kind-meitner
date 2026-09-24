import {
  X,
  MessageSquare,
  FileText,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  WorkflowSnapshot,
  WorkflowTask,
  WorkflowAgent,
  OwnershipTransfer,
  WorkflowArtifact,
} from "@/lib/team-map-workflow";
import { TeamMapAgentAvatar } from "./TeamMapAgentAvatar";

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
  agentId,
  taskId,
  onClose,
  onSelectAgent: _onSelectAgent,
  onSelectTask,
}: {
  snapshot: WorkflowSnapshot;
  agentId?: string | null;
  taskId?: string | null;
  onClose: () => void;
  onSelectAgent?: (id: string) => void;
  onSelectTask?: (id: string) => void;
}) {
  const agent: WorkflowAgent | undefined = agentId
    ? snapshot.agents.find((a) => a.id === agentId)
    : undefined;

  // Find task: explicit taskId or agent's current task
  const task: WorkflowTask | undefined = taskId
    ? snapshot.tasks.find((t) => t.id === taskId)
    : agent?.currentTaskId
      ? snapshot.tasks.find((t) => t.id === agent.currentTaskId)
      : snapshot.tasks.find((t) => t.ownerAgentId === agent?.id);

  const currentOwner: WorkflowAgent | undefined = task
    ? snapshot.agents.find((a) => a.id === task.ownerAgentId)
    : agent;

  // 1. Ownership History
  const transfers: OwnershipTransfer[] = snapshot.transfers.filter((x) => {
    if (task && x.taskId === task.id) return true;
    if (agent && (x.fromAgentId === agent.id || x.toAgentId === agent.id)) return true;
    return false;
  });

  // 2. Collaboration messages & help requests
  const messages = snapshot.messages.filter((m) => {
    if (task && m.taskId === task.id) return true;
    if (agent && (m.fromAgentId === agent.id || m.toAgentId === agent.id)) return true;
    return false;
  });

  // 3. Artifacts / Deliverables
  const artifacts: WorkflowArtifact[] = (snapshot.artifacts ?? []).filter((art) => {
    if (task && art.taskId === task.id) return true;
    if (agent && art.authorAgentId === agent.id) return true;
    return false;
  });

  // 4. Review events
  const reviewEvents = snapshot.events.filter((e) => {
    if (e.type === "review_requested" || e.type === "review_started" || e.type === "review_approved" || e.type === "review_changes_requested") {
      if (task && "taskId" in e && e.taskId === task.id) return true;
      if (agent && "reviewerAgentId" in e && e.reviewerAgentId === agent.id) return true;
    }
    return false;
  });

  if (!agent && !task) return null;

  return (
    <aside
      aria-label="Workflow details"
      className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-hairline/40 bg-panel shadow-2xl"
    >
      {/* Drawer Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h3 className="text-[13.5px] font-semibold text-ink">Collaboration Details</h3>
        </div>
        <button
          type="button"
          aria-label="Close drawer"
          onClick={onClose}
          className="rounded-lg p-1 text-ink-secondary hover:bg-control hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 text-[12px] leading-relaxed">
        {/* 1. AGENT IDENTITY */}
        {currentOwner && (
          <section className="space-y-3 rounded-2xl border border-hairline/50 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-secondary">
                1. Agent Identity
              </span>
              <span className={cn("rounded-md border px-2 py-0.5 text-[10px]", presenceBadge(currentOwner.presence).tone)}>
                {presenceBadge(currentOwner.presence).label}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <TeamMapAgentAvatar
                agentId={currentOwner.id}
                name={currentOwner.name}
                presence={currentOwner.presence}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-[14px] font-semibold text-ink">{currentOwner.name}</h4>
                <p className="truncate text-[11px] text-ink-secondary">{currentOwner.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-hairline/30 pt-2.5 text-[11px]">
              <div>
                <span className="text-ink-secondary">Active Task:</span>{" "}
                <span className="font-medium text-ink">{task?.title ?? "None"}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Workload:</span>{" "}
                <span className="font-medium text-ink">
                  {task ? `${task.progress}% in progress` : "Ready for work"}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 2. CURRENT TASK */}
        {task && (
          <section className="space-y-3 rounded-2xl border border-hairline/50 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-secondary">
                2. Current Task
              </span>
              <span className={cn("rounded-md border px-2 py-0.5 text-[10px] capitalize font-medium",
                task.state === "blocked" ? "bg-danger/20 text-danger border-danger/40 animate-pulse font-bold" :
                task.state === "active" ? "bg-success/20 text-success border-success/30" :
                task.state === "reviewing" ? "bg-accent/20 text-accent border-accent/40 font-semibold" :
                task.state === "completed" ? "bg-success/10 text-success/80 border-success/20" :
                "bg-inset text-ink-secondary border-hairline/40"
              )}>
                {task.state}
              </span>
            </div>

            <div>
              <h4 className="text-[13.5px] font-semibold text-ink">{task.title}</h4>
              {snapshot.objective && (
                <p className="mt-1 text-[11px] text-ink-secondary">
                  <span className="font-medium text-ink/80">Objective:</span> {snapshot.objective}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                <span>Progress</span>
                <span className="font-semibold tabular-nums text-ink">{task.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-inset">
                <div
                  className={cn("h-full transition-all duration-300",
                    task.state === "blocked" ? "bg-danger" :
                    task.state === "completed" ? "bg-success" :
                    "bg-accent"
                  )}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>

            {/* Dependencies */}
            {task.dependsOnTaskIds.length > 0 && (
              <div className="rounded-lg bg-inset/60 p-2 text-[11px]">
                <span className="font-medium text-ink">Dependencies:</span>
                <ul className="mt-1 list-inside list-disc text-ink-secondary">
                  {task.dependsOnTaskIds.map((depId) => {
                    const dep = snapshot.tasks.find((t) => t.id === depId);
                    return (
                      <li key={depId}>
                        <button
                          type="button"
                          onClick={() => onSelectTask?.(depId)}
                          className="text-accent hover:underline"
                        >
                          {dep?.title ?? depId} ({dep?.state ?? "queued"})
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 3. COLLABORATION (MESSAGES, HELP REQUESTS, ARTIFACTS) */}
        <section className="space-y-3 rounded-2xl border border-hairline/50 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-secondary">
              3. Collaboration & Communication
            </span>
            <span className="text-[10.5px] text-ink-secondary">
              {messages.length} messages · {artifacts.length} artifacts
            </span>
          </div>

          {/* Help Requests & Agent Messages */}
          {messages.length === 0 ? (
            <p className="text-[11px] text-ink-secondary">No recorded messages yet for this context.</p>
          ) : (
            <div className="space-y-2">
              {messages.slice(-4).map((msg) => {
                const fromAgent = snapshot.agents.find((a) => a.id === msg.fromAgentId);
                const toAgent = snapshot.agents.find((a) => a.id === msg.toAgentId);
                const isHelp = msg.kind === "help" || msg.kind === "help_requested";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-xl border p-2.5 text-[11px]",
                      isHelp
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-hairline/40 bg-inset/50 text-ink",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={12} className={isHelp ? "text-warning" : "text-accent"} />
                        <span>{fromAgent?.name ?? msg.fromAgentId}</span>
                        {toAgent && (
                          <>
                            <span className="text-ink-secondary">→</span>
                            <span>{toAgent.name}</span>
                          </>
                        )}
                      </div>
                      {isHelp && (
                        <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9.5px] uppercase">
                          Help Request
                        </span>
                      )}
                    </div>
                    <p className="mt-1 leading-relaxed">{msg.text}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deliverables / Artifacts */}
          {artifacts.length > 0 && (
            <div className="border-t border-hairline/30 pt-2.5">
              <span className="text-[11px] font-medium text-ink">Artifacts & Deliverables:</span>
              <ul className="mt-1.5 space-y-1.5">
                {artifacts.map((art) => (
                  <li
                    key={art.id}
                    className="flex items-center justify-between rounded-lg border border-hairline/40 bg-inset/70 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText size={13} className="shrink-0 text-accent" />
                      <span className="truncate font-medium text-ink">{art.name}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink-secondary uppercase">
                      {art.type} {art.sizeBytes ? `· ${Math.round(art.sizeBytes / 1000)}kb` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 4. OWNERSHIP HISTORY (TRANSFERS) */}
        {transfers.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-warning/40 bg-warning/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-warning">
                4. Ownership Transfer History
              </span>
              <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                Context Preserved
              </span>
            </div>

            {transfers.map((xfer) => {
              const fromAgent = snapshot.agents.find((a) => a.id === xfer.fromAgentId);
              const toAgent = snapshot.agents.find((a) => a.id === xfer.toAgentId);
              return (
                <div key={xfer.id} className="space-y-2 rounded-xl border border-warning/30 bg-card/80 p-3 text-[11px]">
                  <div className="flex items-center justify-between font-semibold text-ink">
                    <span>{fromAgent?.name ?? xfer.fromAgentId} → {toAgent?.name ?? xfer.toAgentId}</span>
                    <span className="text-[10px] text-ink-secondary">
                      Resumed at {xfer.progressAtTransfer ?? 68}%
                    </span>
                  </div>

                  <p className="text-ink-secondary">
                    <strong className="text-ink">Reason:</strong> {xfer.reason}
                  </p>

                  <div className="rounded-lg bg-inset/70 p-2 text-[10.5px]">
                    <p className="font-medium text-ink">Context Transferred:</p>
                    <p className="text-ink-secondary">
                      {xfer.messagesTransferred ?? 4} messages, {xfer.artifactsTransferred ?? 2} artifacts, {xfer.decisionsTransferred ?? 1} decision
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* 5. REVIEW & CONVERGENCE */}
        {reviewEvents.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                5. Convergence & Review
              </span>
              <CheckCircle2 size={14} className="text-accent" />
            </div>

            <div className="space-y-2">
              {reviewEvents.map((rev, idx) => {
                const isApproved = rev.type === "review_approved";
                const isChanges = rev.type === "review_changes_requested" || rev.type === "review_rejected";
                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-xl border p-2.5 text-[11px]",
                      isApproved ? "border-success/40 bg-success/10 text-success" :
                      isChanges ? "border-danger/40 bg-danger/10 text-danger" :
                      "border-accent/40 bg-accent/10 text-accent",
                    )}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{rev.type.replace(/_/g, " ").toUpperCase()}</span>
                      <span className="text-[10px] opacity-75">{new Date(rev.at).toLocaleTimeString()}</span>
                    </div>

                    {isApproved && "findings" in rev && rev.findings && (
                      <p className="mt-1 text-[10.5px] leading-relaxed">{rev.findings}</p>
                    )}

                    {isChanges && "reason" in rev && (
                      <p className="mt-1 text-[10.5px] leading-relaxed">{rev.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
