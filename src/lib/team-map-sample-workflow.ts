import {
  applyEvent,
  computeWowFacts,
  createEmptyWorkflow,
  type WorkflowEvent,
  type WorkflowSnapshot,
  type WowFacts,
} from "./team-map-workflow";

export const SAMPLE_WORKFLOW_LABEL = "Sample workflow data";

export interface BotRoleMapping {
  coordinatorId: string;
  discoveryId: string;
  listingCoachId: string;
  escrowId: string;
  reviewerId: string;
}

export const DEFAULT_BOT_ROLES: BotRoleMapping = {
  coordinatorId: "tuli",
  discoveryId: "markets",
  listingCoachId: "listing-coach",
  escrowId: "atlas",
  reviewerId: "spend-scout",
};

export const SAMPLE_BASE_TIME = 1_700_000_000_000;

function t(seconds: number): number {
  return SAMPLE_BASE_TIME + seconds * 1000;
}

/**
 * Deterministic 14-beat sample scenario complying with:
 * 1. A coordinator assigns three independent tasks.
 * 2. Three agents become Working simultaneously.
 * 3. One agent becomes Blocked by a real dependency.
 * 4. That agent sends a help request.
 * 5. Another agent responds and resolves the dependency.
 * 6. One active task is transferred to another agent.
 * 7. The new owner receives all previous context and resumes progress.
 * 8. Three results become Ready for review.
 * 9. A reviewer receives the results.
 * 10. The reviewer requests one correction.
 * 11. The responsible agent submits the correction.
 * 12. The reviewer approves the combined result.
 * 13. The workflow completes.
 * 14. Facts are computed from these exact events.
 */
export function buildSampleWorkflowEvents(mapping: BotRoleMapping = DEFAULT_BOT_ROLES): WorkflowEvent[] {
  const {
    coordinatorId: coord,
    discoveryId: disc,
    listingCoachId: coach,
    escrowId: escrow,
    reviewerId: rev,
  } = mapping;

  const events: WorkflowEvent[] = [
    // 1. Coordinator creates objective
    {
      type: "workflow_created",
      at: t(0),
      workflowId: "wf-b2b-sensor-2026",
      objective: "B2B Industrial Sensor Marketplace Sourcing",
      coordinatorAgentId: coord,
    },
    {
      type: "agent_presence_changed",
      at: t(1),
      agentId: coord,
      name: "Tuli",
      role: "Coordinator",
      presence: "working",
    },
    {
      type: "agent_presence_changed",
      at: t(1),
      agentId: disc,
      name: "Markets",
      role: "Market Discovery",
      presence: "idle",
    },
    {
      type: "agent_presence_changed",
      at: t(1),
      agentId: coach,
      name: "Listing Coach",
      role: "Offer Quality",
      presence: "idle",
    },
    {
      type: "agent_presence_changed",
      at: t(1),
      agentId: escrow,
      name: "Atlas",
      role: "Settlement & Escrow",
      presence: "idle",
    },
    {
      type: "agent_presence_changed",
      at: t(1),
      agentId: rev,
      name: "Spend Scout",
      role: "Trust & Risk Reviewer",
      presence: "idle",
    },

    // Beat 1: Coordinator assigns 3 independent tasks
    {
      type: "task_assigned",
      at: t(5),
      taskId: "task-discovery",
      agentId: disc,
      title: "Supplier & catalog discovery",
      description: "Scan marketplace catalog for industrial sensor vendors",
      branchId: "branch-discovery",
      progress: 0,
    },
    {
      type: "task_assigned",
      at: t(7),
      taskId: "task-terms",
      agentId: coach,
      title: "Validate commercial terms",
      description: "Draft terms and evaluate seller listing quality",
      branchId: "branch-terms",
      dependsOnTaskIds: ["task-discovery"],
      progress: 0,
    },
    {
      type: "task_assigned",
      at: t(9),
      taskId: "task-escrow",
      agentId: coord, // Initially assigned to coordinator/lead, will transfer to Atlas
      title: "Prepare payment protection",
      description: "Validate escrow rails and stablecoin lockup conditions",
      branchId: "branch-escrow",
      progress: 10,
    },

    // Beat 2: Three agents become Working simultaneously
    {
      type: "task_started",
      at: t(12),
      taskId: "task-discovery",
      agentId: disc,
    },
    {
      type: "task_started",
      at: t(12),
      taskId: "task-terms",
      agentId: coach,
    },
    {
      type: "task_started",
      at: t(12),
      taskId: "task-escrow",
      agentId: coord,
    },
    {
      type: "task_progress",
      at: t(20),
      taskId: "task-discovery",
      progress: 35,
    },
    {
      type: "task_progress",
      at: t(22),
      taskId: "task-escrow",
      progress: 45,
    },

    // Beat 3: One agent becomes Blocked by a dependency
    {
      type: "dependency_blocked",
      at: t(25),
      taskId: "task-terms",
      agentId: coach,
      dependencyTaskId: "task-discovery",
      reason: "Waiting for counterparty risk & reputation data from Vendor Orion",
    },

    // Beat 4: Blocked agent sends a help request
    {
      type: "help_requested",
      at: t(27),
      fromAgentId: coach,
      toAgentId: disc,
      taskId: "task-terms",
      text: "Need seller reputation & historic delivery rates for Vendor Orion before finalizing terms",
    },

    // Beat 5: Another agent responds and resolves dependency
    {
      type: "message_sent",
      at: t(32),
      messageId: "msg-disc-reply-1",
      fromAgentId: disc,
      toAgentId: coach,
      kind: "chat",
      text: "Vendor Orion verified: 98.4% fulfillment rate, 0 disputes in past 90 days. Safe to proceed.",
      taskId: "task-terms",
    },
    {
      type: "task_progress",
      at: t(35),
      taskId: "task-discovery",
      progress: 100,
    },
    {
      type: "dependency_resolved",
      at: t(36),
      taskId: "task-terms",
      dependencyTaskId: "task-discovery",
      reason: "Discovery vendor report verified",
    },
    {
      type: "task_resumed",
      at: t(38),
      taskId: "task-terms",
      agentId: coach,
      progress: 40,
    },

    // Beat 6: Active task transferred to another agent (Tuli -> Atlas)
    {
      type: "ownership_transferred",
      at: t(45),
      transferId: "xfer-escrow-atlas",
      taskId: "task-escrow",
      fromAgentId: coord,
      toAgentId: escrow,
      reason: "Tuli is blocked by missing settlement capability; Atlas has native on-chain escrow runner",
      previousState: "active",
      nextState: "active",
      messagesTransferred: 4,
      artifactsTransferred: 2,
      decisionsTransferred: 1,
      progressAtTransfer: 68,
    },

    // Beat 7: New owner receives context and resumes progress
    {
      type: "task_resumed",
      at: t(48),
      taskId: "task-escrow",
      agentId: escrow,
      progress: 68,
    },
    {
      type: "task_progress",
      at: t(55),
      taskId: "task-escrow",
      progress: 90,
    },
    {
      type: "task_progress",
      at: t(58),
      taskId: "task-terms",
      progress: 95,
    },

    // Beat 8: Three results become Ready for review
    {
      type: "artifact_submitted",
      at: t(60),
      taskId: "task-discovery",
      authorAgentId: disc,
      artifact: {
        id: "art-discovery-1",
        name: "vendor-orion-diligence.json",
        type: "data",
        sizeBytes: 4200,
        summary: "Vendor Orion verified credentials & tier-1 ASP audit",
        createdAt: t(60),
        taskId: "task-discovery",
        authorAgentId: disc,
      },
    },
    {
      type: "artifact_submitted",
      at: t(62),
      taskId: "task-escrow",
      authorAgentId: escrow,
      artifact: {
        id: "art-escrow-1",
        name: "escrow-vault-contract.sol",
        type: "code",
        sizeBytes: 8900,
        summary: "48h escrow lockup with auto-release upon delivery",
        createdAt: t(62),
        taskId: "task-escrow",
        authorAgentId: escrow,
      },
    },
    {
      type: "artifact_submitted",
      at: t(63),
      taskId: "task-terms",
      authorAgentId: coach,
      artifact: {
        id: "art-terms-1",
        name: "commercial-purchase-agreement.md",
        type: "spec",
        sizeBytes: 12400,
        summary: "Terms: 250 units at 420 USDT/unit, 48h settlement",
        createdAt: t(63),
        taskId: "task-terms",
        authorAgentId: coach,
      },
    },
    {
      type: "review_requested",
      at: t(65),
      taskId: "task-terms",
      fromAgentId: coach,
      toAgentId: rev,
      text: "Deal package assembled. Requesting jury review before final escrow deposit.",
    },

    // Beat 9: Reviewer receives results
    {
      type: "review_started",
      at: t(68),
      taskId: "task-terms",
      reviewerAgentId: rev,
    },

    // Beat 10: Reviewer requests one correction
    {
      type: "review_changes_requested",
      at: t(72),
      taskId: "task-terms",
      reviewerAgentId: rev,
      reason: "Buyer protection window: increase escrow lockup from 48h to 72h for high-value hardware",
      requiredChanges: ["Extend vault lockup from 48h to 72h", "Add hardware test receipt clause"],
    },

    // Beat 11: Responsible agent submits correction
    {
      type: "task_resumed",
      at: t(75),
      taskId: "task-terms",
      agentId: coach,
      progress: 95,
    },
    {
      type: "artifact_submitted",
      at: t(80),
      taskId: "task-terms",
      authorAgentId: coach,
      artifact: {
        id: "art-terms-revised",
        name: "commercial-agreement-v2-72h.md",
        type: "spec",
        sizeBytes: 13100,
        summary: "Updated: 72h buyer inspection window and test receipt verified",
        createdAt: t(80),
        taskId: "task-terms",
        authorAgentId: coach,
      },
    },
    {
      type: "task_progress",
      at: t(82),
      taskId: "task-terms",
      progress: 100,
    },
    {
      type: "review_requested",
      at: t(84),
      taskId: "task-terms",
      fromAgentId: coach,
      toAgentId: rev,
      text: "Revised terms submitted with 72h inspection window.",
    },

    // Beat 12: Reviewer approves combined result
    {
      type: "review_approved",
      at: t(88),
      taskId: "task-terms",
      reviewerAgentId: rev,
      findings: "All requirements met: Vendor Orion reputation verified, 72h escrow vault locked, hardware clause approved.",
    },
    {
      type: "task_completed",
      at: t(90),
      taskId: "task-discovery",
      agentId: disc,
    },
    {
      type: "task_completed",
      at: t(90),
      taskId: "task-escrow",
      agentId: escrow,
    },
    {
      type: "task_completed",
      at: t(90),
      taskId: "task-terms",
      agentId: coach,
    },

    // Beat 13: Workflow completed
    {
      type: "workflow_completed",
      at: t(95),
      summary: "Marketplace sourcing workflow successfully completed across 3 parallel branches with 1 ownership transfer and 1 review revision.",
    },
  ];

  return events;
}

export function buildSampleWorkflowSnapshot(mapping?: BotRoleMapping): {
  snapshot: WorkflowSnapshot;
  facts: WowFacts;
} {
  const events = buildSampleWorkflowEvents(mapping);
  let fullSnapshot = createEmptyWorkflow();
  for (const event of events) {
    fullSnapshot = applyEvent(fullSnapshot, event);
  }
  const facts = computeWowFacts(fullSnapshot);

  const {
    coordinatorId: coord = DEFAULT_BOT_ROLES.coordinatorId,
    discoveryId: disc = DEFAULT_BOT_ROLES.discoveryId,
    listingCoachId: coach = DEFAULT_BOT_ROLES.listingCoachId,
    escrowId: escrow = DEFAULT_BOT_ROLES.escrowId,
    reviewerId: rev = DEFAULT_BOT_ROLES.reviewerId,
  } = mapping ?? DEFAULT_BOT_ROLES;

  // Active snapshot preserves active operational friction points (Blocked on Listing Coach, Active on Discovery & Escrow)
  const activeTasks = [
    {
      id: "task-discovery",
      title: "Supplier & catalog discovery",
      ownerAgentId: disc,
      state: "active" as const,
      dependsOnTaskIds: [] as string[],
      progress: 85,
      branchId: "branch-discovery",
    },
    {
      id: "task-terms",
      title: "Validate commercial terms",
      ownerAgentId: coach,
      state: "blocked" as const,
      dependsOnTaskIds: ["task-discovery"],
      progress: 65,
      branchId: "branch-terms",
    },
    {
      id: "task-escrow",
      title: "Prepare payment protection",
      ownerAgentId: escrow,
      state: "active" as const,
      dependsOnTaskIds: [] as string[],
      progress: 45,
      branchId: "branch-escrow",
    },
  ];

  const activeAgents = [
    { id: coord, name: "Tuli", role: "Coordinator", presence: "working" as const, currentTaskId: undefined },
    { id: disc, name: "Markets", role: "Market Discovery", presence: "working" as const, currentTaskId: "task-discovery" },
    { id: coach, name: "Listing Coach", role: "Offer Quality", presence: "blocked" as const, currentTaskId: "task-terms" },
    { id: escrow, name: "Atlas", role: "Settlement & Escrow", presence: "working" as const, currentTaskId: "task-escrow" },
    { id: rev, name: "Spend Scout", role: "Trust & Risk Reviewer", presence: "waiting" as const, currentTaskId: undefined },
  ];

  const snapshot: WorkflowSnapshot = {
    ...fullSnapshot,
    tasks: activeTasks,
    agents: activeAgents,
    completedAt: undefined,
  };

  return { snapshot, facts };
}
