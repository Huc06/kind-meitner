/**
 * Pure TypeScript workflow state model for Team Map demos.
 * No React — reducers + derived Wow facts only.
 */

export type AgentPresence =
  | "idle"
  | "working"
  | "waiting"
  | "blocked"
  | "reviewing"
  | "completed"
  | "offline";

export type TaskState =
  | "queued"
  | "active"
  | "waiting"
  | "blocked"
  | "reviewing"
  | "completed"
  | "failed";

export interface WorkflowAgent {
  id: string;
  name: string;
  role: string;
  avatarHint?: string;
  presence: AgentPresence;
  currentTaskId?: string;
}

export interface WorkflowTask {
  id: string;
  title: string;
  ownerAgentId: string;
  state: TaskState;
  dependsOnTaskIds: string[];
  /** 0–100 */
  progress: number;
  branchId?: string;
}

export type WorkflowMessageKind =
  | "chat"
  | "help"
  | "status"
  | "review"
  | "system";

export interface WorkflowMessage {
  id: string;
  fromAgentId: string;
  toAgentId?: string;
  kind: WorkflowMessageKind | string;
  text: string;
  taskId?: string;
  /** epoch ms */
  at: number;
}

export interface OwnershipTransfer {
  id: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  reason: string;
  /** epoch ms */
  at: number;
  previousState: TaskState;
  nextState: TaskState;
  messagesTransferred?: number;
  artifactsTransferred?: number;
  decisionsTransferred?: number;
  progressAtTransfer?: number;
}

export interface WorkflowArtifact {
  id: string;
  name: string;
  type: "document" | "code" | "spec" | "receipt" | "data";
  sizeBytes?: number;
  summary?: string;
  createdAt: number;
  taskId: string;
  authorAgentId: string;
  reviewState?: "under_review" | "approved" | "rejected" | "superseded";
  assignedReviewerId?: string;
  contentPreview?: string;
  status?: "pending" | "in_progress" | "completed" | "verified";
  actionUrl?: string;
}

export type WorkflowEvent =
  | {
      type: "workflow_created";
      at: number;
      workflowId: string;
      objective: string;
      coordinatorAgentId?: string;
    }
  | {
      type: "task_assigned";
      at: number;
      taskId: string;
      agentId: string;
      title?: string;
      description?: string;
      dependsOnTaskIds?: string[];
      branchId?: string;
      progress?: number;
    }
  | {
      type: "task_started";
      at: number;
      taskId: string;
      agentId: string;
    }
  | {
      type: "help_requested";
      at: number;
      fromAgentId: string;
      toAgentId?: string;
      taskId?: string;
      text: string;
      messageId?: string;
    }
  | {
      type: "dependency_blocked";
      at: number;
      taskId: string;
      agentId?: string;
      dependencyTaskId?: string;
      reason?: string;
    }
  | {
      type: "dependency_resolved" | "dependency_completed";
      at: number;
      taskId: string;
      dependencyTaskId: string;
      reason?: string;
    }
  | {
      type: "ownership_transferred";
      at: number;
      transferId: string;
      taskId: string;
      fromAgentId: string;
      toAgentId: string;
      reason: string;
      previousState: TaskState;
      nextState: TaskState;
      messagesTransferred?: number;
      artifactsTransferred?: number;
      decisionsTransferred?: number;
      progressAtTransfer?: number;
    }
  | {
      type: "task_resumed";
      at: number;
      taskId: string;
      agentId: string;
      progress?: number;
    }
  | {
      type: "artifact_submitted";
      at: number;
      taskId: string;
      authorAgentId: string;
      artifact: WorkflowArtifact;
    }
  | {
      type: "review_requested";
      at: number;
      taskId: string;
      fromAgentId: string;
      toAgentId: string;
      messageId?: string;
      text?: string;
    }
  | {
      type: "review_started";
      at: number;
      taskId: string;
      reviewerAgentId: string;
    }
  | {
      type: "review_changes_requested" | "review_rejected";
      at: number;
      taskId: string;
      reviewerAgentId: string;
      reason: string;
      requiredChanges?: string[];
    }
  | {
      type: "review_approved";
      at: number;
      taskId: string;
      reviewerAgentId: string;
      findings?: string;
    }
  | {
      type: "workflow_completed";
      at: number;
      summary?: string;
    }
  | {
      type: "agent_presence_changed";
      at: number;
      agentId: string;
      presence: AgentPresence;
      name?: string;
      role?: string;
      avatarHint?: string;
      currentTaskId?: string | null;
    }
  | {
      type: "branch_forked";
      at: number;
      branchId: string;
      fromTaskId?: string;
      taskIds?: string[];
    }
  | {
      type: "branch_merged";
      at: number;
      branchId: string;
      intoTaskId?: string;
    }
  | {
      type: "task_blocked";
      at: number;
      taskId: string;
      agentId?: string;
      reason?: string;
    }
  | {
      type: "task_unblocked";
      at: number;
      taskId: string;
      agentId?: string;
      nextState?: TaskState;
    }
  | {
      type: "task_progress";
      at: number;
      taskId: string;
      progress: number;
    }
  | {
      type: "task_completed";
      at: number;
      taskId: string;
      agentId?: string;
    }
  | {
      type: "task_failed";
      at: number;
      taskId: string;
      agentId?: string;
      reason?: string;
    }
  | {
      type: "message_sent";
      at: number;
      messageId: string;
      fromAgentId: string;
      toAgentId?: string;
      kind?: WorkflowMessageKind | string;
      text: string;
      taskId?: string;
    };

export interface WorkflowSnapshot {
  workflowId?: string;
  objective?: string;
  agents: WorkflowAgent[];
  tasks: WorkflowTask[];
  messages: WorkflowMessage[];
  artifacts: WorkflowArtifact[];
  transfers: OwnershipTransfer[];
  events: WorkflowEvent[];
  /** epoch ms; 0 until first event */
  startedAt: number;
  completedAt?: number;
}

export interface TransferOwnershipInput {
  taskId: string;
  toAgentId: string;
  reason: string;
  at: number;
  /** Defaults to "active" when the task was blocked/waiting, else keeps previous. */
  nextState?: TaskState;
  transferId?: string;
  messagesTransferred?: number;
  artifactsTransferred?: number;
  decisionsTransferred?: number;
  progressAtTransfer?: number;
}

export interface TransferOwnershipResult {
  snapshot: WorkflowSnapshot;
  transfer: OwnershipTransfer;
  events: WorkflowEvent[];
}

/** Metrics derived only from events/timestamps — never hardcode showcase numbers. */
export interface WowFacts {
  agentCount: number;
  maxConcurrentActiveAgents: number;
  parallelBranchCount: number;
  agentMessages: number;
  ownershipTransfers: number;
  dependenciesResolved: number;
  reviewsCompleted: number;
  blockedRecovered: number;
  elapsedMs: number | null;
  estimatedSequentialMs: number | null;
  speedup: number | null;
  timeSavedMs: number | null;
  tasksCompleted: number;
  /** null → display as "Not measured" */
  testsExecuted: number | null;
}

export function createEmptyWorkflow(): WorkflowSnapshot {
  return {
    agents: [],
    tasks: [],
    messages: [],
    artifacts: [],
    transfers: [],
    events: [],
    startedAt: 0,
  };
}

function cloneSnapshot(snapshot: WorkflowSnapshot): WorkflowSnapshot {
  return {
    workflowId: snapshot.workflowId,
    objective: snapshot.objective,
    agents: snapshot.agents.map((a) => ({ ...a })),
    tasks: snapshot.tasks.map((t) => ({
      ...t,
      dependsOnTaskIds: [...t.dependsOnTaskIds],
    })),
    messages: snapshot.messages.map((m) => ({ ...m })),
    artifacts: snapshot.artifacts ? snapshot.artifacts.map((art) => ({ ...art })) : [],
    transfers: snapshot.transfers.map((t) => ({ ...t })),
    events: [...snapshot.events],
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
  };
}

type AgentPatch = Omit<Partial<WorkflowAgent>, "currentTaskId"> & {
  id: string;
  /** Pass null to clear currentTaskId. */
  currentTaskId?: string | null;
};

function upsertAgent(agents: WorkflowAgent[], patch: AgentPatch): WorkflowAgent[] {
  const index = agents.findIndex((a) => a.id === patch.id);
  const clearTask = Object.prototype.hasOwnProperty.call(patch, "currentTaskId")
    && patch.currentTaskId === null;
  const nextTaskId: string | undefined = clearTask
    ? undefined
    : typeof patch.currentTaskId === "string"
      ? patch.currentTaskId
      : undefined;
  const hasTaskId = clearTask || typeof patch.currentTaskId === "string";

  if (index < 0) {
    const created: WorkflowAgent = {
      id: patch.id,
      name: patch.name ?? patch.id,
      role: patch.role ?? "agent",
      presence: patch.presence ?? "idle",
    };
    if (patch.avatarHint !== undefined) created.avatarHint = patch.avatarHint;
    if (hasTaskId && !clearTask) created.currentTaskId = nextTaskId;
    return [...agents, created];
  }

  const next = [...agents];
  const current = next[index];
  const { currentTaskId: _ignored, ...rest } = patch;
  const updated: WorkflowAgent = {
    ...current,
    ...rest,
    id: patch.id,
  };
  if (clearTask) delete updated.currentTaskId;
  else if (hasTaskId) updated.currentTaskId = nextTaskId;
  next[index] = updated;
  return next;
}

function upsertTask(
  tasks: WorkflowTask[],
  patch: Partial<WorkflowTask> & { id: string },
): WorkflowTask[] {
  const index = tasks.findIndex((t) => t.id === patch.id);
  if (index < 0) {
    return [
      ...tasks,
      {
        id: patch.id,
        title: patch.title ?? patch.id,
        ownerAgentId: patch.ownerAgentId ?? "",
        state: patch.state ?? "queued",
        dependsOnTaskIds: patch.dependsOnTaskIds ? [...patch.dependsOnTaskIds] : [],
        progress: clampProgress(patch.progress ?? 0),
        branchId: patch.branchId,
      },
    ];
  }
  const next = [...tasks];
  const current = next[index];
  next[index] = {
    ...current,
    ...patch,
    dependsOnTaskIds: patch.dependsOnTaskIds
      ? [...patch.dependsOnTaskIds]
      : current.dependsOnTaskIds,
    progress:
      patch.progress !== undefined ? clampProgress(patch.progress) : current.progress,
  };
  return next;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function appendMessage(
  messages: WorkflowMessage[],
  message: WorkflowMessage,
): WorkflowMessage[] {
  if (messages.some((m) => m.id === message.id)) return messages;
  return [...messages, message];
}

function touchStartedAt(snapshot: WorkflowSnapshot, at: number): number {
  if (snapshot.startedAt > 0) return snapshot.startedAt;
  return at > 0 ? at : snapshot.startedAt;
}

/**
 * Apply a single workflow event immutably.
 * Unknown / no-op fields are ignored; the event is always appended.
 */
export function applyEvent(
  snapshot: WorkflowSnapshot,
  event: WorkflowEvent,
): WorkflowSnapshot {
  const next = cloneSnapshot(snapshot);
  next.startedAt = touchStartedAt(next, event.at);
  next.events = [...next.events, event];

  switch (event.type) {
    case "workflow_created": {
      next.workflowId = event.workflowId;
      next.objective = event.objective;
      if (event.coordinatorAgentId) {
        next.agents = upsertAgent(next.agents, {
          id: event.coordinatorAgentId,
          presence: "working",
        });
      }
      break;
    }
    case "agent_presence_changed": {
      next.agents = upsertAgent(next.agents, {
        id: event.agentId,
        presence: event.presence,
        name: event.name,
        role: event.role,
        avatarHint: event.avatarHint,
        currentTaskId: event.currentTaskId,
      });
      break;
    }
    case "task_assigned": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        title: event.title,
        ownerAgentId: event.agentId,
        state: "queued",
        dependsOnTaskIds: event.dependsOnTaskIds,
        branchId: event.branchId,
        progress: event.progress,
      });
      next.agents = upsertAgent(next.agents, {
        id: event.agentId,
        currentTaskId: event.taskId,
      });
      break;
    }
    case "task_started": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        ownerAgentId: event.agentId,
        state: "active",
      });
      next.agents = upsertAgent(next.agents, {
        id: event.agentId,
        presence: "working",
        currentTaskId: event.taskId,
      });
      break;
    }
    case "task_blocked": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "blocked",
      });
      if (event.agentId) {
        next.agents = upsertAgent(next.agents, {
          id: event.agentId,
          presence: "blocked",
          currentTaskId: event.taskId,
        });
      }
      break;
    }
    case "dependency_blocked": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "blocked",
      });
      if (event.agentId) {
        next.agents = upsertAgent(next.agents, {
          id: event.agentId,
          presence: "blocked",
          currentTaskId: event.taskId,
        });
      }
      break;
    }
    case "dependency_resolved": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "active",
      });
      break;
    }
    case "task_resumed": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        ownerAgentId: event.agentId,
        state: "active",
        progress: event.progress,
      });
      next.agents = upsertAgent(next.agents, {
        id: event.agentId,
        presence: "working",
        currentTaskId: event.taskId,
      });
      break;
    }
    case "artifact_submitted": {
      next.artifacts = [...(next.artifacts ?? []), event.artifact];
      break;
    }
    case "task_unblocked": {
      const state = event.nextState ?? "active";
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state,
      });
      if (event.agentId) {
        next.agents = upsertAgent(next.agents, {
          id: event.agentId,
          presence: state === "active" ? "working" : "waiting",
          currentTaskId: event.taskId,
        });
      }
      break;
    }
    case "task_progress": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        progress: event.progress,
      });
      break;
    }
    case "task_completed": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "completed",
        progress: 100,
      });
      if (event.agentId) {
        next.agents = upsertAgent(next.agents, {
          id: event.agentId,
          presence: "completed",
          currentTaskId: null,
        });
      }
      break;
    }
    case "task_failed": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "failed",
      });
      if (event.agentId) {
        next.agents = upsertAgent(next.agents, {
          id: event.agentId,
          presence: "blocked",
        });
      }
      break;
    }
    case "help_requested": {
      const messageId =
        event.messageId ?? `help:${event.at}:${event.fromAgentId}:${event.taskId ?? ""}`;
      next.messages = appendMessage(next.messages, {
        id: messageId,
        fromAgentId: event.fromAgentId,
        toAgentId: event.toAgentId,
        kind: "help",
        text: event.text,
        taskId: event.taskId,
        at: event.at,
      });
      next.agents = upsertAgent(next.agents, {
        id: event.fromAgentId,
        presence: "waiting",
      });
      if (event.taskId) {
        next.tasks = upsertTask(next.tasks, {
          id: event.taskId,
          state: "waiting",
        });
      }
      break;
    }
    case "message_sent": {
      next.messages = appendMessage(next.messages, {
        id: event.messageId,
        fromAgentId: event.fromAgentId,
        toAgentId: event.toAgentId,
        kind: event.kind ?? "chat",
        text: event.text,
        taskId: event.taskId,
        at: event.at,
      });
      break;
    }
    case "dependency_completed": {
      // Mark dependency task completed if present; wake the dependent if it was waiting.
      next.tasks = upsertTask(next.tasks, {
        id: event.dependencyTaskId,
        state: "completed",
        progress: 100,
      });
      const dependent = next.tasks.find((t) => t.id === event.taskId);
      if (dependent && (dependent.state === "waiting" || dependent.state === "blocked")) {
        next.tasks = upsertTask(next.tasks, {
          id: event.taskId,
          state: "queued",
        });
      }
      break;
    }
    case "ownership_transferred": {
      const transfer: OwnershipTransfer = {
        id: event.transferId,
        taskId: event.taskId,
        fromAgentId: event.fromAgentId,
        toAgentId: event.toAgentId,
        reason: event.reason,
        at: event.at,
        previousState: event.previousState,
        nextState: event.nextState,
        messagesTransferred: event.messagesTransferred,
        artifactsTransferred: event.artifactsTransferred,
        decisionsTransferred: event.decisionsTransferred,
        progressAtTransfer: event.progressAtTransfer,
      };
      if (!next.transfers.some((t) => t.id === transfer.id)) {
        next.transfers = [...next.transfers, transfer];
      }
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        ownerAgentId: event.toAgentId,
        state: event.nextState,
      });
      next.agents = upsertAgent(next.agents, {
        id: event.fromAgentId,
        presence: "idle",
        currentTaskId: null,
      });
      next.agents = upsertAgent(next.agents, {
        id: event.toAgentId,
        presence: event.nextState === "active" ? "working" : "waiting",
        currentTaskId: event.taskId,
      });
      break;
    }
    case "review_started": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "reviewing",
      });
      next.agents = upsertAgent(next.agents, {
        id: event.reviewerAgentId,
        presence: "reviewing",
        currentTaskId: event.taskId,
      });
      break;
    }
    case "review_changes_requested": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "active",
      });
      next.agents = upsertAgent(next.agents, {
        id: event.reviewerAgentId,
        presence: "waiting",
      });
      break;
    }
    case "review_requested": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "reviewing",
      });
      next.agents = upsertAgent(next.agents, {
        id: event.fromAgentId,
        presence: "waiting",
      });
      next.agents = upsertAgent(next.agents, {
        id: event.toAgentId,
        presence: "reviewing",
        currentTaskId: event.taskId,
      });
      if (event.text) {
        const messageId =
          event.messageId ?? `review:${event.at}:${event.taskId}`;
        next.messages = appendMessage(next.messages, {
          id: messageId,
          fromAgentId: event.fromAgentId,
          toAgentId: event.toAgentId,
          kind: "review",
          text: event.text,
          taskId: event.taskId,
          at: event.at,
        });
      }
      break;
    }
    case "review_approved": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "completed",
        progress: 100,
      });
      next.agents = upsertAgent(next.agents, {
        id: event.reviewerAgentId,
        presence: "completed",
      });
      break;
    }
    case "review_rejected": {
      next.tasks = upsertTask(next.tasks, {
        id: event.taskId,
        state: "active",
      });
      next.agents = upsertAgent(next.agents, {
        id: event.reviewerAgentId,
        presence: "idle",
      });
      break;
    }
    case "branch_forked": {
      if (event.taskIds) {
        for (const taskId of event.taskIds) {
          next.tasks = upsertTask(next.tasks, {
            id: taskId,
            branchId: event.branchId,
          });
        }
      }
      if (event.fromTaskId) {
        next.tasks = upsertTask(next.tasks, {
          id: event.fromTaskId,
          branchId: event.branchId,
        });
      }
      break;
    }
    case "branch_merged": {
      next.tasks = next.tasks.map((task) =>
        task.branchId === event.branchId
          ? { ...task, branchId: undefined }
          : task,
      );
      break;
    }
    case "workflow_completed": {
      next.completedAt = event.at;
      next.agents = next.agents.map((agent) =>
        agent.presence === "offline"
          ? agent
          : { ...agent, presence: "completed" as AgentPresence },
      );
      break;
    }
    default: {
      // Exhaustiveness: extra event shapes are still recorded.
      break;
    }
  }

  return next;
}

/**
 * Transfer task ownership. Records OwnershipTransfer with all required fields
 * and emits an ownership_transferred event (applied via applyEvent).
 */
export function transferOwnership(
  snapshot: WorkflowSnapshot,
  input: TransferOwnershipInput,
): TransferOwnershipResult {
  const task = snapshot.tasks.find((t) => t.id === input.taskId);
  if (!task) {
    throw new Error(`transferOwnership: unknown taskId ${input.taskId}`);
  }
  if (!snapshot.agents.some((a) => a.id === input.toAgentId)) {
    // Allow transfer to an agent not yet upserted — applyEvent will create them.
  }

  const previousState = task.state;
  const nextState =
    input.nextState ??
    (previousState === "blocked" || previousState === "waiting"
      ? "active"
      : previousState === "queued"
        ? "queued"
        : previousState);

  const transferId =
    input.transferId ?? `xfer:${input.at}:${input.taskId}:${input.toAgentId}`;

  const event: WorkflowEvent = {
    type: "ownership_transferred",
    at: input.at,
    transferId,
    taskId: input.taskId,
    fromAgentId: task.ownerAgentId,
    toAgentId: input.toAgentId,
    reason: input.reason,
    previousState,
    nextState,
    messagesTransferred: input.messagesTransferred,
    artifactsTransferred: input.artifactsTransferred,
    decisionsTransferred: input.decisionsTransferred,
    progressAtTransfer: input.progressAtTransfer ?? task.progress,
  };

  const nextSnapshot = applyEvent(snapshot, event);
  const transfer = nextSnapshot.transfers.find((t) => t.id === transferId)!;

  return {
    snapshot: nextSnapshot,
    transfer,
    events: [event],
  };
}

// —— Query helpers ————————————————————————————————————————————————

export function getActiveAgents(snapshot: WorkflowSnapshot): WorkflowAgent[] {
  return snapshot.agents.filter(
    (a) =>
      a.presence === "working" ||
      a.presence === "reviewing" ||
      a.presence === "waiting" ||
      a.presence === "blocked",
  );
}

export function getWorkingAgents(snapshot: WorkflowSnapshot): WorkflowAgent[] {
  return snapshot.agents.filter((a) => a.presence === "working");
}

export function getBlockedTasks(snapshot: WorkflowSnapshot): WorkflowTask[] {
  return snapshot.tasks.filter((t) => t.state === "blocked");
}

export function getCompletedTasks(snapshot: WorkflowSnapshot): WorkflowTask[] {
  return snapshot.tasks.filter((t) => t.state === "completed");
}

export function getOwnershipTransfers(
  snapshot: WorkflowSnapshot,
): OwnershipTransfer[] {
  return [...snapshot.transfers];
}

export function getTasksByState(
  snapshot: WorkflowSnapshot,
  state: TaskState,
): WorkflowTask[] {
  return snapshot.tasks.filter((t) => t.state === state);
}

export function getAgentsByPresence(
  snapshot: WorkflowSnapshot,
  presence: AgentPresence,
): WorkflowAgent[] {
  return snapshot.agents.filter((a) => a.presence === presence);
}

// —— Wow facts (derived only) ——————————————————————————————————————

function eventTimes(events: WorkflowEvent[]): number[] {
  return events.map((e) => e.at).filter((t) => Number.isFinite(t) && t > 0);
}

/**
 * Active duration per task from task_started → terminal event
 * (completed / failed / review_approved / ownership leave while active ends
 * at next ownership_transferred or task terminal).
 */
function taskActiveDurationsMs(events: WorkflowEvent[]): Map<string, number> | null {
  const starts = new Map<string, number>();
  const durations = new Map<string, number>();
  let sawStart = false;

  const close = (taskId: string, endAt: number) => {
    const start = starts.get(taskId);
    if (start === undefined) return;
    if (endAt < start) return;
    durations.set(taskId, (durations.get(taskId) ?? 0) + (endAt - start));
    starts.delete(taskId);
  };

  for (const event of events) {
    switch (event.type) {
      case "task_started":
        sawStart = true;
        // If already active, close previous open interval first.
        if (starts.has(event.taskId)) close(event.taskId, event.at);
        starts.set(event.taskId, event.at);
        break;
      case "task_completed":
      case "task_failed":
        close(event.taskId, event.at);
        break;
      case "review_approved":
        close(event.taskId, event.at);
        break;
      case "task_blocked":
      case "help_requested":
        if (event.type === "help_requested" && event.taskId) {
          close(event.taskId, event.at);
        } else if (event.type === "task_blocked") {
          close(event.taskId, event.at);
        }
        break;
      case "task_unblocked":
        if (event.nextState === "active" || event.nextState === undefined) {
          if (!starts.has(event.taskId)) {
            sawStart = true;
            starts.set(event.taskId, event.at);
          }
        }
        break;
      case "ownership_transferred":
        // Previous owner stops; if nextState is active, new interval starts.
        close(event.taskId, event.at);
        if (event.nextState === "active") {
          sawStart = true;
          starts.set(event.taskId, event.at);
        }
        break;
      case "workflow_completed":
        for (const taskId of Array.from(starts.keys())) close(taskId, event.at);
        break;
      default:
        break;
    }
  }

  if (!sawStart) return null;
  // Open intervals without an end cannot contribute a known duration.
  if (starts.size > 0) return null;
  return durations;
}

function maxConcurrentActiveAgents(events: WorkflowEvent[]): number {
  // Sweep presence / task_started to count agents in "working" at each point.
  const working = new Set<string>();
  let max = 0;

  const bump = () => {
    if (working.size > max) max = working.size;
  };

  for (const event of events) {
    switch (event.type) {
      case "task_started":
        working.add(event.agentId);
        bump();
        break;
      case "agent_presence_changed":
        if (event.presence === "working") {
          working.add(event.agentId);
        } else {
          working.delete(event.agentId);
        }
        bump();
        break;
      case "task_completed":
      case "task_failed":
        if (event.agentId) working.delete(event.agentId);
        bump();
        break;
      case "task_blocked":
        if (event.agentId) working.delete(event.agentId);
        bump();
        break;
      case "help_requested":
        working.delete(event.fromAgentId);
        bump();
        break;
      case "ownership_transferred":
        working.delete(event.fromAgentId);
        if (event.nextState === "active") working.add(event.toAgentId);
        else working.delete(event.toAgentId);
        bump();
        break;
      case "review_requested":
        working.delete(event.fromAgentId);
        working.delete(event.toAgentId);
        bump();
        break;
      case "review_approved":
      case "review_rejected":
        working.delete(event.reviewerAgentId);
        bump();
        break;
      case "task_unblocked":
        if (event.agentId && (event.nextState === "active" || !event.nextState)) {
          working.add(event.agentId);
        }
        bump();
        break;
      case "workflow_completed":
        working.clear();
        bump();
        break;
      default:
        break;
    }
  }

  return max;
}

function parallelBranchCount(events: WorkflowEvent[]): number {
  const branches = new Set<string>();
  for (const event of events) {
    if (event.type === "branch_forked") branches.add(event.branchId);
    if ("branchId" in event && typeof event.branchId === "string" && event.branchId.length > 0) {
      branches.add(event.branchId);
    }
  }
  return branches.size;
}

function countBlockedRecovered(events: WorkflowEvent[]): number {
  let blocked = 0;
  let recovered = 0;
  for (const event of events) {
    if (event.type === "task_blocked" || event.type === "dependency_blocked") blocked += 1;
    if ((event.type === "task_unblocked" || event.type === "dependency_resolved") && blocked > recovered) {
      recovered += 1;
    }
    // Ownership transfer out of blocked also counts as recovery.
    if (
      event.type === "ownership_transferred" &&
      event.previousState === "blocked" &&
      event.nextState !== "blocked"
    ) {
      recovered += 1;
    }
  }
  return Math.max(recovered, blocked > 0 && events.some((e) => e.type === "dependency_resolved" || e.type === "task_resumed") ? 1 : 0);
}

/**
 * Derive showcase metrics strictly from the event log and timestamps.
 * Empty / insufficient data → nulls (UI shows "Not measured").
 */
export function computeWowFacts(snapshot: WorkflowSnapshot): WowFacts {
  const { events, agents, tasks, messages, transfers, startedAt, completedAt } =
    snapshot;

  const agentIds = new Set<string>();
  for (const agent of agents) agentIds.add(agent.id);
  for (const event of events) {
    if ("agentId" in event && typeof event.agentId === "string") {
      agentIds.add(event.agentId);
    }
    if ("fromAgentId" in event && typeof event.fromAgentId === "string") {
      agentIds.add(event.fromAgentId);
    }
    if ("toAgentId" in event && typeof event.toAgentId === "string") {
      agentIds.add(event.toAgentId);
    }
    if ("reviewerAgentId" in event && typeof event.reviewerAgentId === "string") {
      agentIds.add(event.reviewerAgentId);
    }
  }

  const times = eventTimes(events);
  const endAt =
    completedAt ??
    (times.length > 0 ? Math.max(...times) : null);
  const startAt = startedAt > 0 ? startedAt : times.length > 0 ? Math.min(...times) : null;
  const elapsedMs =
    startAt !== null && endAt !== null && endAt >= startAt ? endAt - startAt : null;

  const durations = taskActiveDurationsMs(events);
  const estimatedSequentialMs =
    durations === null
      ? null
      : [...durations.values()].reduce((sum, d) => sum + d, 0);

  const speedup =
    elapsedMs !== null &&
    estimatedSequentialMs !== null &&
    elapsedMs > 0
      ? estimatedSequentialMs / elapsedMs
      : null;

  const timeSavedMs =
    elapsedMs !== null && estimatedSequentialMs !== null
      ? Math.max(0, estimatedSequentialMs - elapsedMs)
      : null;

  const tasksCompleted =
    tasks.filter((t) => t.state === "completed").length ||
    events.filter(
      (e) =>
        e.type === "task_completed" ||
        e.type === "review_approved",
    ).length;

  // testsExecuted is never inventable from this model — always null unless
  // a future event type records it. Keep explicit for "Not measured".
  const testsExecuted: number | null = null;

  if (events.length === 0 && agents.length === 0 && tasks.length === 0) {
    return {
      agentCount: 0,
      maxConcurrentActiveAgents: 0,
      parallelBranchCount: 0,
      agentMessages: 0,
      ownershipTransfers: 0,
      dependenciesResolved: 0,
      reviewsCompleted: 0,
      blockedRecovered: 0,
      elapsedMs: null,
      estimatedSequentialMs: null,
      speedup: null,
      timeSavedMs: null,
      tasksCompleted: 0,
      testsExecuted: null,
    };
  }

  return {
    agentCount: agentIds.size,
    maxConcurrentActiveAgents: maxConcurrentActiveAgents(events),
    parallelBranchCount: parallelBranchCount(events),
    agentMessages:
      messages.length ||
      events.filter(
        (e) => e.type === "help_requested" || e.type === "message_sent",
      ).length,
    ownershipTransfers:
      transfers.length ||
      events.filter((e) => e.type === "ownership_transferred").length,
    dependenciesResolved: events.filter((e) => e.type === "dependency_completed")
      .length,
    reviewsCompleted: events.filter(
      (e) => e.type === "review_approved" || e.type === "review_rejected",
    ).length,
    blockedRecovered: countBlockedRecovered(events),
    elapsedMs,
    estimatedSequentialMs,
    speedup,
    timeSavedMs,
    tasksCompleted,
    testsExecuted,
  };
}

/** Convenience: fold a list of events onto an empty (or seed) snapshot. */
export function reduceEvents(
  events: WorkflowEvent[],
  seed: WorkflowSnapshot = createEmptyWorkflow(),
): WorkflowSnapshot {
  return events.reduce((snap, event) => applyEvent(snap, event), seed);
}
