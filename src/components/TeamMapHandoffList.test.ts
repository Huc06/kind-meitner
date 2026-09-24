import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TeamMapHandoffList,
  deduplicateHandoffs,
  type UnifiedHandoffItem,
} from "./TeamMapHandoffList";
import type { OwnershipTransfer, WorkflowTask } from "@/lib/team-map-workflow";
import type { TeamMapEdge } from "@/lib/team-map";
import type { Bot } from "@/state/store";

describe("TeamMapHandoffList & Deduplication", () => {
  const bots: Bot[] = [
    { id: "tuli", name: "Tuli", color: "green", modelSelection: { instanceId: "i", model: "m" } } as Bot,
    { id: "atlas", name: "Atlas", color: "orange", modelSelection: { instanceId: "i", model: "m" } } as Bot,
    { id: "markets", name: "Markets", color: "blue", modelSelection: { instanceId: "i", model: "m" } } as Bot,
  ];

  const transfers: OwnershipTransfer[] = [
    {
      id: "xfer-1",
      taskId: "task-escrow",
      fromAgentId: "tuli",
      toAgentId: "atlas",
      reason: "Tuli is blocked by missing settlement capability; Atlas has native on-chain escrow runner",
      at: 1_700_000_045_000,
      previousState: "active",
      nextState: "active",
      messagesTransferred: 4,
      artifactsTransferred: 2,
      decisionsTransferred: 1,
      progressAtTransfer: 68,
    },
  ];

  const edges: TeamMapEdge[] = [
    // Duplicate pair: Tuli <-> Atlas already has transfer xfer-1
    {
      sourceBotId: "tuli",
      targetBotId: "atlas",
      state: "connected",
      lastAt: 1_700_000_040_000,
    },
    // Distinct pair: Tuli <-> Markets has no transfer
    {
      sourceBotId: "tuli",
      targetBotId: "markets",
      state: "running",
      reason: "Active data scan",
      lastAt: 1_700_000_050_000,
    },
  ];

  it("deduplicates redundant persistent connection rows when an ownership transfer exists for the same directed pair", () => {
    const tasks: WorkflowTask[] = [
      { id: "task-escrow", title: "Prepare payment protection", ownerAgentId: "atlas", state: "active", dependsOnTaskIds: [], progress: 68 },
    ];
    const unified = deduplicateHandoffs(transfers, edges, bots, tasks);

    // Exactly 2 items: 1 rich transfer (Tuli -> Atlas) + 1 distinct edge (Tuli -> Markets)
    expect(unified).toHaveLength(2);

    const atlasItems = unified.filter((i) => i.fromBotId === "tuli" && i.toBotId === "atlas");
    expect(atlasItems).toHaveLength(1);
    expect(atlasItems[0].kind).toBe("transfer");
    expect(atlasItems[0].taskTitle).toBe("Prepare payment protection");
    expect(atlasItems[0].progress).toBe(68);
    expect(atlasItems[0].messagesTransferred).toBe(4);
    expect(atlasItems[0].artifactsTransferred).toBe(2);

    const marketsItems = unified.filter((i) => i.toBotId === "markets");
    expect(marketsItems).toHaveLength(1);
    expect(marketsItems[0].kind).toBe("connection");
    expect(marketsItems[0].statusText).toBe("Running");
  });

  it("preserves reverse direction edges (B -> A) when only (A -> B) was transferred", () => {
    const reverseEdge: TeamMapEdge = {
      sourceBotId: "atlas",
      targetBotId: "tuli",
      state: "running",
      reason: "Reverse status inquiry",
    };
    const unified = deduplicateHandoffs(transfers, [reverseEdge], bots);
    // Both transfer (tuli -> atlas) and reverse connection (atlas -> tuli) should be kept
    expect(unified).toHaveLength(2);
    expect(unified.some((i) => i.fromBotId === "tuli" && i.toBotId === "atlas" && i.kind === "transfer")).toBe(true);
    expect(unified.some((i) => i.fromBotId === "atlas" && i.toBotId === "tuli" && i.kind === "connection")).toBe(true);
  });

  it("renders structured handoff list with accessible attributes and clean hierarchy", () => {
    const items: UnifiedHandoffItem[] = [
      {
        id: "xfer-1",
        kind: "transfer",
        taskId: "task-escrow",
        taskTitle: "Prepare payment protection",
        fromBotId: "tuli",
        fromName: "Tuli",
        toBotId: "atlas",
        toName: "Atlas",
        statusText: "Resumed · 68%",
        progress: 68,
        timeStr: "12:43 PM",
        reason: "Tuli is blocked by missing settlement capability; Atlas has native on-chain escrow runner",
        messagesTransferred: 4,
        artifactsTransferred: 2,
        decisionsTransferred: 1,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(TeamMapHandoffList, {
        items,
        selectedTaskId: "task-escrow",
        onSelectHandoff: () => {},
      }),
    );

    // Header
    expect(markup).toContain("Agent handoffs");
    expect(markup).toContain("Context-preserved transfers");
    expect(markup).toContain('aria-label="1 handoffs"');
    expect(markup).toContain('aria-expanded="true"');

    // Row content
    expect(markup).toContain("Prepare payment protection");
    expect(markup).toContain("Tuli");
    expect(markup).toContain("Atlas");
    expect(markup).toContain("Resumed · 68%");
    expect(markup).toContain("Ownership transfer");
    expect(markup).toContain("12:43 PM");

    // Expanded details
    expect(markup).toContain("Reason");
    expect(markup).toContain("Tuli is blocked by missing settlement capability");
    expect(markup).toContain("4 messages");
    expect(markup).toContain("2 artifacts");
    expect(markup).toContain("1 decision");
    expect(markup).toContain("68% preserved");
  });

  it("renders empty state gracefully without crashing", () => {
    const markup = renderToStaticMarkup(
      createElement(TeamMapHandoffList, {
        items: [],
        onSelectHandoff: () => {},
      }),
    );

    expect(markup).toContain("No active agent handoffs or transfers recorded.");
  });
});
