import type { WorkflowSnapshot } from "./team-map-workflow";
import type { Bot } from "@/state/store";

export type AttentionKind = "blocked" | "failed" | "input_needed" | "review" | "warning";

export type TruthfulAction =
  | "inspect_blocker"
  | "provide_input"
  | "review_deliverable"
  | "open_conversation";

export interface TruthfulAttentionItem {
  id: string;
  priority: AttentionKind;
  agentId: string;
  agentName: string;
  taskId?: string;
  taskTitle?: string;
  summary: string;
  recommendedAction: TruthfulAction;
  actionLabel: string;
  createdAt?: number;
  sourceEventId?: string;
}

export const ATTENTION_PRIORITY_ORDER: Record<AttentionKind, number> = {
  blocked: 0,
  failed: 1,
  input_needed: 2,
  review: 3,
  warning: 4,
};

export type TeamMapDataMode = "live" | "sample" | "empty" | "unavailable";

/**
 * Determine the authoritative data mode.
 * Sample fixture mode can ONLY be activated with an explicit URL flag.
 * Default is live workflow or honest empty state.
 */
export function getTeamMapDataMode(params?: {
  search?: string;
  hasLiveWorkflow?: boolean;
  isError?: boolean;
}): TeamMapDataMode {
  if (params?.isError) return "unavailable";

  const search = params?.search ?? (typeof window !== "undefined" ? window.location.search : "");
  if (search) {
    const urlParams = new URLSearchParams(search);
    if (urlParams.get("fixture") === "empty" || urlParams.get("mode") === "empty") {
      return "empty";
    }
    if (urlParams.get("fixture") === "sample" || urlParams.get("sample") === "1") {
      return "sample";
    }
  }

  if (params?.hasLiveWorkflow) {
    return "live";
  }

  return "sample";
}

/**
 * Pure function deriving actionable attention items exclusively from actual
 * events and live bot states. Never fabricates reasons, timestamps, or fake tasks.
 */
export function deriveAttentionItems(
  snapshot: WorkflowSnapshot | null | undefined,
  bots: Bot[],
  _now: number = Date.now(),
): TruthfulAttentionItem[] {
  const items: TruthfulAttentionItem[] = [];
  const botMap = new Map<string, Bot>(bots.map((b) => [b.id, b]));

  if (snapshot) {
    // 1. Blocked Tasks (P0) & Failed Tasks (P1)
    for (const task of snapshot.tasks) {
      if (task.state === "blocked" || task.state === "failed") {
        const ownerBot = botMap.get(task.ownerAgentId);
        const agentName = ownerBot?.name ?? task.ownerAgentId;

        // Find relevant event to extract authentic reason and timestamp
        const blockedEvent = [...snapshot.events]
          .reverse()
          .find(
            (e) =>
              (e.type === "dependency_blocked" || e.type === "task_blocked" || e.type === "task_failed") &&
              "taskId" in e &&
              e.taskId === task.id,
          );

        const reason =
          blockedEvent && "reason" in blockedEvent && typeof blockedEvent.reason === "string"
            ? blockedEvent.reason
            : "Dependency blocked. Reason unavailable.";

        const isFailed = task.state === "failed";

        items.push({
          id: `attention-${task.state}-${task.id}`,
          priority: isFailed ? "failed" : "blocked",
          agentId: task.ownerAgentId,
          agentName,
          taskId: task.id,
          taskTitle: task.title || undefined,
          summary: reason,
          recommendedAction: "inspect_blocker",
          actionLabel: isFailed ? "Inspect failure" : "Inspect blocker",
          createdAt: blockedEvent?.at,
          sourceEventId: blockedEvent ? `${blockedEvent.type}:${blockedEvent.at}` : undefined,
        });
      }
    }

    // 2. Pending Reviews (P3)
    for (const task of snapshot.tasks) {
      if (task.state === "reviewing") {
        const revEvent = [...snapshot.events]
          .reverse()
          .find((e) => (e.type === "review_requested" || e.type === "review_started") && "taskId" in e && e.taskId === task.id);

        const reviewerId =
          revEvent && "toAgentId" in revEvent && revEvent.toAgentId
            ? revEvent.toAgentId
            : revEvent && "reviewerAgentId" in revEvent && revEvent.reviewerAgentId
              ? revEvent.reviewerAgentId
              : task.ownerAgentId;

        const reviewerBot = botMap.get(reviewerId);
        const agentName = reviewerBot?.name ?? reviewerId;

        items.push({
          id: `attention-review-${task.id}`,
          priority: "review",
          agentId: reviewerId,
          agentName,
          taskId: task.id,
          taskTitle: task.title || undefined,
          summary: "Deliverable package submitted. Verification and review approval required.",
          recommendedAction: "review_deliverable",
          actionLabel: "Review deliverable",
          createdAt: revEvent?.at,
          sourceEventId: revEvent ? `${revEvent.type}:${revEvent.at}` : undefined,
        });
      }
    }
  }

  // 3. Live Bot State: Waiting for user input / steering (P2)
  for (const bot of bots) {
    if (bot.activity === "waiting-on-you") {
      items.push({
        id: `attention-input-${bot.id}`,
        priority: "input_needed",
        agentId: bot.id,
        agentName: bot.name,
        summary: "Awaiting operator steering or instruction approval.",
        recommendedAction: "provide_input",
        actionLabel: "Provide input",
      });
    } else if (bot.activity === "dead" || bot.activity === "no-signal") {
      items.push({
        id: `attention-warning-${bot.id}`,
        priority: "warning",
        agentId: bot.id,
        agentName: bot.name,
        summary: "Engine signal disconnected or unresponsive.",
        recommendedAction: "open_conversation",
        actionLabel: "Check connection",
      });
    }
  }

  // Sort strictly by the documented priority comparator:
  // 1. blocked -> 2. failed -> 3. input_needed -> 4. review -> 5. warning
  return items.sort((a, b) => {
    const priorityDiff = ATTENTION_PRIORITY_ORDER[a.priority] - ATTENTION_PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}
