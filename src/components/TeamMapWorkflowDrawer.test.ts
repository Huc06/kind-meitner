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

  it("filters artifacts for both author and assigned reviewer with honest sample copy", () => {
    const sampleSnapshot = {
      ...createEmptyWorkflow(),
      artifacts: [
        {
          id: "art-authored",
          name: "vendor-matrix.json",
          type: "data" as const,
          createdAt: 1000,
          taskId: "task-1",
          authorAgentId: "bot-real-1",
          summary: "Vendor discovery results",
          reviewState: "approved" as const,
        },
        {
          id: "art-review-assigned",
          name: "escrow-vault.sol",
          type: "code" as const,
          createdAt: 2000,
          taskId: "task-2",
          authorAgentId: "other-agent",
          assignedReviewerId: "bot-real-1",
          summary: "72h escrow smart contract",
          reviewState: "under_review" as const,
          contentPreview: "// SPDX-License-Identifier: MIT\ncontract Vault {}",
        },
        {
          id: "art-unrelated",
          name: "unrelated.txt",
          type: "document" as const,
          createdAt: 3000,
          taskId: "task-3",
          authorAgentId: "third-agent",
          assignedReviewerId: "third-agent",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(TeamMapWorkflowDrawer, {
        snapshot: sampleSnapshot,
        bots: realBots,
        agentId: "bot-real-1",
        onClose: () => {},
      }),
    );

    // Both authored and review-assigned artifacts must be included in the tab badge
    expect(markup).toContain("Artifacts");
    expect(markup).toContain("2");

    // Honest provenance copy: must NOT claim "Verified on-chain rails"
    expect(markup).not.toContain("Verified on-chain rails");
  });

  it("distinguishes live versus sample provenance honestly based on dataMode prop", () => {
    const sampleSnapshot = {
      ...createEmptyWorkflow(),
      artifacts: [
        {
          id: "art-1",
          name: "contract.sol",
          type: "code" as const,
          createdAt: 1000,
          taskId: "task-1",
          authorAgentId: "bot-real-1",
        },
      ],
    };

    // Sample mode
    const sampleMarkup = renderToStaticMarkup(
      createElement(TeamMapWorkflowDrawer, {
        snapshot: sampleSnapshot,
        bots: realBots,
        agentId: "bot-real-1",
        dataMode: "sample",
        initialTab: "artifacts",
        onClose: () => {},
      }),
    );
    expect(sampleMarkup).toContain("Sample workflow data — not live commerce");
    expect(sampleMarkup).not.toContain("Live deliverables");

    // Live mode
    const liveMarkup = renderToStaticMarkup(
      createElement(TeamMapWorkflowDrawer, {
        snapshot: sampleSnapshot,
        bots: realBots,
        agentId: "bot-real-1",
        dataMode: "live",
        initialTab: "artifacts",
        onClose: () => {},
      }),
    );
    expect(liveMarkup).toContain("Live deliverables");
    expect(liveMarkup).not.toContain("Sample workflow data");
  });

  it("does not fabricate fallback sizes or verified review states when metadata is absent", () => {
    const unannotatedSnapshot = {
      ...createEmptyWorkflow(),
      artifacts: [
        {
          id: "art-unannotated",
          name: "raw-output.txt",
          type: "document" as const,
          createdAt: 1000,
          taskId: "task-1",
          authorAgentId: "bot-real-1",
          // sizeBytes is omitted
          // reviewState is omitted
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(TeamMapWorkflowDrawer, {
        snapshot: unannotatedSnapshot,
        bots: realBots,
        agentId: "bot-real-1",
        onClose: () => {},
      }),
    );

    // Must NOT claim "4 KB" or "Verified"
    expect(markup).not.toContain("4 KB");
    expect(markup).not.toContain("Verified on-chain rails");
  });
});
