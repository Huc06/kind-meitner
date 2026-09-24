/**
 * UI helpers for Team Map marketplace demo (progressive reveal + activity).
 * Does not invent metrics — only filters/derives from engine snapshots.
 */

import {
  reduceEvents,
  type OwnershipTransfer,
  type WorkflowEvent,
  type WorkflowMessage,
  type WorkflowSnapshot,
} from "./team-map-workflow";
import {
  buildMarketplaceDemoWorkflow,
  demoTimelineSteps,
  type DemoTimelineStep,
} from "./team-map-demo";

export type ActivityKind =
  | "message"
  | "transfer"
  | "task"
  | "review"
  | "help"
  | "system"
  | "presence"
  | "branch";

export interface ActivityItem {
  id: string;
  at: number;
  kind: ActivityKind;
  /** Message kind or event type label */
  label: string;
  text: string;
  agentId?: string;
  taskId?: string;
  branchId?: string;
}

function agentName(snapshot: WorkflowSnapshot, id?: string): string {
  if (!id) return "";
  return snapshot.agents.find((a) => a.id === id)?.name ?? id;
}

function taskTitle(snapshot: WorkflowSnapshot, id?: string): string {
  if (!id) return "";
  return snapshot.tasks.find((t) => t.id === id)?.title ?? id;
}

function messageItem(snapshot: WorkflowSnapshot, msg: WorkflowMessage): ActivityItem {
  const from = agentName(snapshot, msg.fromAgentId);
  const to = msg.toAgentId ? ` → ${agentName(snapshot, msg.toAgentId)}` : "";
  return {
    id: `msg:${msg.id}`,
    at: msg.at,
    kind: msg.kind === "help" ? "help" : msg.kind === "system" ? "system" : "message",
    label: String(msg.kind),
    text: `${from}${to}: ${msg.text}`,
    agentId: msg.fromAgentId,
    taskId: msg.taskId,
  };
}

function transferItem(snapshot: WorkflowSnapshot, xfer: OwnershipTransfer): ActivityItem {
  return {
    id: `xfer:${xfer.id}`,
    at: xfer.at,
    kind: "transfer",
    label: "ownership",
    text: `${agentName(snapshot, xfer.fromAgentId)} → ${agentName(snapshot, xfer.toAgentId)}: ${taskTitle(snapshot, xfer.taskId)} (${xfer.reason})`,
    agentId: xfer.toAgentId,
    taskId: xfer.taskId,
  };
}

function eventItem(snapshot: WorkflowSnapshot, event: WorkflowEvent, index: number): ActivityItem | null {
  switch (event.type) {
    case "task_started":
      return {
        id: `evt:${index}:task_started`,
        at: event.at,
        kind: "task",
        label: "started",
        text: `${agentName(snapshot, event.agentId)} started ${taskTitle(snapshot, event.taskId)}`,
        agentId: event.agentId,
        taskId: event.taskId,
      };
    case "task_completed":
      return {
        id: `evt:${index}:task_completed`,
        at: event.at,
        kind: "task",
        label: "completed",
        text: `${agentName(snapshot, event.agentId)} completed ${taskTitle(snapshot, event.taskId)}`,
        agentId: event.agentId,
        taskId: event.taskId,
      };
    case "task_blocked":
      return {
        id: `evt:${index}:task_blocked`,
        at: event.at,
        kind: "task",
        label: "blocked",
        text: `${taskTitle(snapshot, event.taskId)} blocked${event.reason ? `: ${event.reason}` : ""}`,
        agentId: event.agentId,
        taskId: event.taskId,
      };
    case "task_unblocked":
      return {
        id: `evt:${index}:task_unblocked`,
        at: event.at,
        kind: "task",
        label: "unblocked",
        text: `${taskTitle(snapshot, event.taskId)} unblocked${event.nextState ? ` → ${event.nextState}` : ""}`,
        agentId: event.agentId,
        taskId: event.taskId,
      };
    case "task_assigned":
      return {
        id: `evt:${index}:task_assigned`,
        at: event.at,
        kind: "task",
        label: "assigned",
        text: `${event.title ?? taskTitle(snapshot, event.taskId)} → ${agentName(snapshot, event.agentId)}`,
        agentId: event.agentId,
        taskId: event.taskId,
        branchId: event.branchId,
      };
    case "help_requested":
      // Prefer message row when present; still show if no matching message
      return {
        id: `evt:${index}:help`,
        at: event.at,
        kind: "help",
        label: "help",
        text: `${agentName(snapshot, event.fromAgentId)}${event.toAgentId ? ` → ${agentName(snapshot, event.toAgentId)}` : ""}: ${event.text}`,
        agentId: event.fromAgentId,
        taskId: event.taskId,
      };
    case "review_requested":
      return {
        id: `evt:${index}:review_requested`,
        at: event.at,
        kind: "review",
        label: "review",
        text: `${agentName(snapshot, event.fromAgentId)} → ${agentName(snapshot, event.toAgentId)}: ${event.text ?? "Review requested"}`,
        agentId: event.fromAgentId,
        taskId: event.taskId,
      };
    case "review_approved":
      return {
        id: `evt:${index}:review_approved`,
        at: event.at,
        kind: "review",
        label: "approved",
        text: `${agentName(snapshot, event.reviewerAgentId)} approved ${taskTitle(snapshot, event.taskId)}`,
        agentId: event.reviewerAgentId,
        taskId: event.taskId,
      };
    case "review_rejected":
      return {
        id: `evt:${index}:review_rejected`,
        at: event.at,
        kind: "review",
        label: "rejected",
        text: `${agentName(snapshot, event.reviewerAgentId)} rejected ${taskTitle(snapshot, event.taskId)}${event.reason ? `: ${event.reason}` : ""}`,
        agentId: event.reviewerAgentId,
        taskId: event.taskId,
      };
    case "ownership_transferred":
      // Covered by transfers list
      return null;
    case "message_sent":
      // Covered by messages list
      return null;
    case "workflow_completed":
      return {
        id: `evt:${index}:workflow_completed`,
        at: event.at,
        kind: "system",
        label: "completed",
        text: "Workflow completed",
      };
    case "branch_forked":
      return {
        id: `evt:${index}:branch_forked`,
        at: event.at,
        kind: "branch",
        label: "fork",
        text: `Branch ${event.branchId} forked`,
        taskId: event.fromTaskId,
        branchId: event.branchId,
      };
    case "branch_merged":
      return {
        id: `evt:${index}:branch_merged`,
        at: event.at,
        kind: "branch",
        label: "merge",
        text: `Branch ${event.branchId} merged${event.intoTaskId ? ` into ${event.intoTaskId}` : ""}`,
        taskId: event.intoTaskId,
        branchId: event.branchId,
      };
    case "dependency_completed":
      return {
        id: `evt:${index}:dep`,
        at: event.at,
        kind: "task",
        label: "dependency",
        text: `Dependency ${event.dependencyTaskId} completed for ${taskTitle(snapshot, event.taskId)}`,
        taskId: event.taskId,
      };
    default:
      return null;
  }
}

/**
 * Chronological activity from messages, transfers, and key task/review events.
 * Dedupes help/message overlaps by preferring message rows when ids match.
 */
export function buildActivityItems(snapshot: WorkflowSnapshot): ActivityItem[] {
  const items: ActivityItem[] = [];
  const messageIds = new Set(snapshot.messages.map((m) => m.id));

  for (const msg of snapshot.messages) {
    items.push(messageItem(snapshot, msg));
  }
  for (const xfer of snapshot.transfers) {
    items.push(transferItem(snapshot, xfer));
  }
  snapshot.events.forEach((event, index) => {
    if (event.type === "help_requested" && event.messageId && messageIds.has(event.messageId)) {
      return;
    }
    if (event.type === "review_requested" && event.messageId && messageIds.has(event.messageId)) {
      return;
    }
    const item = eventItem(snapshot, event, index);
    if (item) items.push(item);
  });

  return items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** Monotonic cutoff so Next always reveals at least as much as Prev. */
export function cutoffForStep(steps: DemoTimelineStep[], stepNumber: number): number {
  const slice = steps.filter((s) => s.step <= stepNumber);
  if (slice.length === 0) return 0;
  return Math.max(...slice.map((s) => s.at));
}

export function snapshotAtDemoStep(
  full: WorkflowSnapshot,
  stepNumber: number,
  steps: DemoTimelineStep[] = demoTimelineSteps(),
): WorkflowSnapshot {
  const cutoff = cutoffForStep(steps, stepNumber);
  return reduceEvents(full.events.filter((e) => e.at <= cutoff));
}

let cachedFull: WorkflowSnapshot | null = null;

export function getDemoFullSnapshot(): WorkflowSnapshot {
  if (!cachedFull) cachedFull = buildMarketplaceDemoWorkflow();
  return cachedFull;
}

export function getDemoTimelineSteps(): DemoTimelineStep[] {
  return demoTimelineSteps();
}
