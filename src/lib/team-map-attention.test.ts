import { describe, expect, it } from "vitest";
import {
  deriveAttentionItems,
  getTeamMapDataMode,
  ATTENTION_PRIORITY_ORDER,
} from "./team-map-attention";
import type { WorkflowSnapshot } from "./team-map-workflow";
import type { Bot } from "@/state/store";

describe("Team Map Attention Derivation & Truthfulness", () => {
  const bots: Bot[] = [
    { id: "bot-1", name: "Alpha", activity: "idle" } as Bot,
    { id: "bot-2", name: "Beta", activity: "waiting-on-you" } as Bot,
    { id: "bot-3", name: "Gamma", activity: "dead" } as Bot,
  ];

  it("requires an explicit fixture flag to activate sample mode", () => {
    // Default URL search with no flag -> empty or live
    expect(getTeamMapDataMode({ search: "" })).toBe("empty");
    expect(getTeamMapDataMode({ search: "?view=board" })).toBe("empty");
    expect(getTeamMapDataMode({ search: "", hasLiveWorkflow: true })).toBe("live");
    expect(getTeamMapDataMode({ isError: true })).toBe("unavailable");

    // Only explicit flags activate sample mode
    expect(getTeamMapDataMode({ search: "?fixture=sample" })).toBe("sample");
    expect(getTeamMapDataMode({ search: "?sample=1" })).toBe("sample");
    expect(getTeamMapDataMode({ search: "?sample=0" })).toBe("empty");
  });

  it("strictly enforces priority ordering: blocked -> failed -> input_needed -> review -> warning", () => {
    expect(ATTENTION_PRIORITY_ORDER.blocked).toBeLessThan(ATTENTION_PRIORITY_ORDER.failed);
    expect(ATTENTION_PRIORITY_ORDER.failed).toBeLessThan(ATTENTION_PRIORITY_ORDER.input_needed);
    expect(ATTENTION_PRIORITY_ORDER.input_needed).toBeLessThan(ATTENTION_PRIORITY_ORDER.review);
    expect(ATTENTION_PRIORITY_ORDER.review).toBeLessThan(ATTENTION_PRIORITY_ORDER.warning);

    const snapshot: WorkflowSnapshot = {
      agents: [],
      tasks: [
        {
          id: "task-rev",
          title: "Audit proposal",
          ownerAgentId: "bot-1",
          state: "reviewing",
          dependsOnTaskIds: [],
          progress: 90,
        },
        {
          id: "task-block",
          title: "Payment release",
          ownerAgentId: "bot-1",
          state: "blocked",
          dependsOnTaskIds: [],
          progress: 40,
        },
        {
          id: "task-fail",
          title: "Bridge transaction",
          ownerAgentId: "bot-1",
          state: "failed",
          dependsOnTaskIds: [],
          progress: 50,
        },
      ],
      messages: [],
      artifacts: [],
      transfers: [],
      events: [
        { type: "task_blocked", taskId: "task-block", at: 1000, reason: "Insufficient liquidity" },
        { type: "task_failed", taskId: "task-fail", at: 1020, reason: "RPC timeout" },
        { type: "review_requested", taskId: "task-rev", at: 1050, fromAgentId: "bot-1", toAgentId: "bot-1" },
      ],
      startedAt: 1000,
    };

    const items = deriveAttentionItems(snapshot, bots);

    // Items count: 1 blocked + 1 failed + 1 input_needed (bot-2) + 1 review + 1 warning (bot-3)
    expect(items).toHaveLength(5);
    expect(items[0].priority).toBe("blocked");
    expect(items[0].taskId).toBe("task-block");

    expect(items[1].priority).toBe("failed");
    expect(items[1].taskId).toBe("task-fail");

    expect(items[2].priority).toBe("input_needed");
    expect(items[2].agentId).toBe("bot-2");

    expect(items[3].priority).toBe("review");
    expect(items[3].taskId).toBe("task-rev");

    expect(items[4].priority).toBe("warning");
    expect(items[4].agentId).toBe("bot-3");
  });

  it("handles missing task reasons and timestamps truthfully without inventing values", () => {
    const snapshot: WorkflowSnapshot = {
      agents: [],
      tasks: [
        {
          id: "task-orphan",
          title: "",
          ownerAgentId: "bot-1",
          state: "blocked",
          dependsOnTaskIds: [],
          progress: 0,
        },
      ],
      messages: [],
      artifacts: [],
      transfers: [],
      events: [], // No recorded event -> reason and timestamp missing
      startedAt: 0,
    };

    const items = deriveAttentionItems(snapshot, [bots[0]]);
    expect(items).toHaveLength(1);

    // Missing reason should use honest fallback, never fabricated scenario text
    expect(items[0].summary).toBe("Dependency blocked. Reason unavailable.");

    // Missing timestamp must be undefined, never a fake "2m ago" or "live"
    expect(items[0].createdAt).toBeUndefined();

    // Empty title should not crash
    expect(items[0].taskTitle).toBeUndefined();
  });
});
