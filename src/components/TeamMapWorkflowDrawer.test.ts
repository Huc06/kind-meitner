import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamMapWorkflowDrawer } from "./TeamMapWorkflowDrawer";
import { createEmptyWorkflow } from "@/lib/team-map-workflow";
import type { Bot } from "@/state/store";

describe("TeamMapWorkflowDrawer with Real Bots", () => {
  const realBots: Bot[] = [
    {
      id: "bot-real-1",
      name: "Listing Coach",
      title: "Offer Quality Checker",
      color: "blue",
      modelSelection: { instanceId: "i", model: "m" },
      activity: "idle",
      tasks: [{ threadId: "th-1", title: "Review seller documentation", createdAt: 1 }],
    } as Bot,
  ];

  it("renders authentic bot identity and tasks from workspace bots even when workflow snapshot is empty", () => {
    const emptySnapshot = createEmptyWorkflow();

    // In default production mode (no sample fixture), snapshot is empty.
    // The drawer MUST NOT return null when a real bot ID is selected!
    const markup = renderToStaticMarkup(
      createElement(TeamMapWorkflowDrawer, {
        snapshot: emptySnapshot,
        bots: realBots,
        agentId: "bot-real-1",
        onClose: () => {},
      }),
    );

    // Inspector title and agent name
    expect(markup).toContain("Inspector");
    expect(markup).toContain("Listing Coach");
    expect(markup).toContain("Offer Quality Checker");

    // Real task from bot record
    expect(markup).toContain("Review seller documentation");

    // Truthful operational action (Open conversation, never a fake unblock/approve mutation)
    expect(markup).toContain("Open 1:1 Conversation with Listing Coach");
    expect(markup).not.toContain("Unblock Task & Resume");
    expect(markup).not.toContain("Approve");
  });

  it("safely handles non-existent bot and task IDs by returning null", () => {
    const emptySnapshot = createEmptyWorkflow();
    const markup = renderToStaticMarkup(
      createElement(TeamMapWorkflowDrawer, {
        snapshot: emptySnapshot,
        bots: realBots,
        agentId: null,
        taskId: null,
        onClose: () => {},
      }),
    );
    expect(markup).toBe("");
  });
});
