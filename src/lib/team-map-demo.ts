/**
 * Deterministic marketplace DEMO for Team Map.
 * Clearly labelled as demo data — not live commerce.
 * Pure: fixed epoch timestamps, no I/O.
 */

import {
  applyEvent,
  createEmptyWorkflow,
  transferOwnership,
  type WorkflowEvent,
  type WorkflowSnapshot,
} from "./team-map-workflow";

/** Visible banner copy for UI — never imply live settlement. */
export const DEMO_LABEL = "Demo data — not live commerce";

/** Separate flag: WorkflowSnapshot has no metadata field. */
export const isDemoWorkflow = true as const;

/** Fixed epoch ms so Wow facts stay stable across runs. */
export const DEMO_START_AT = 1_700_000_000_000;

export interface DemoAgentSpec {
  id: string;
  name: string;
  role: string;
  avatarHint?: string;
}

/** Six distinct marketplace roles. */
export const DEMO_AGENTS: readonly DemoAgentSpec[] = [
  { id: "coordinator", name: "Coordinator", role: "Coordinator", avatarHint: "star" },
  { id: "discovery", name: "Discovery", role: "Discovery", avatarHint: "cloud" },
  { id: "risk", name: "Risk", role: "Risk", avatarHint: "hexagon" },
  { id: "negotiation", name: "Negotiation", role: "Negotiation", avatarHint: "flower" },
  { id: "escrow", name: "Escrow", role: "Escrow", avatarHint: "mech" },
  { id: "reviewer", name: "Reviewer", role: "Reviewer", avatarHint: "clover" },
] as const;

export interface DemoTimelineStep {
  /** 1-based narrative step */
  step: number;
  /** epoch ms */
  at: number;
  label: string;
  detail: string;
  /** Optional task / branch anchors for UI highlight */
  taskId?: string;
  branchId?: string;
  agentId?: string;
}

function atOffset(seconds: number): number {
  return DEMO_START_AT + seconds * 1000;
}

/**
 * Ordered human-readable steps for UI progressive reveal.
 * Aligns with the 12-beat marketplace scenario.
 */
export function demoTimelineSteps(): DemoTimelineStep[] {
  return [
    {
      step: 1,
      at: atOffset(2),
      label: "Coordinator receives objective",
      detail: `${DEMO_LABEL}. Marketplace brief: source vetted B2B industrial-sensor listings; target close in 48h.`,
      taskId: "intake",
      agentId: "coordinator",
    },
    {
      step: 2,
      at: atOffset(12),
      label: "Discovery searches opportunities",
      detail: "Discovery scans catalog and shortlists Vendor Orion and two alternates.",
      taskId: "discover",
      agentId: "discovery",
    },
    {
      step: 3,
      at: atOffset(35),
      label: "Risk evaluates counterparties",
      detail: "Risk opens counterparty scoring on branch-counterparty.",
      taskId: "risk-eval",
      branchId: "branch-counterparty",
      agentId: "risk",
    },
    {
      step: 4,
      at: atOffset(34),
      label: "Negotiation blocked on dependencies",
      detail: "Prepare commercial terms waits on risk-eval and escrow-prep.",
      taskId: "negotiate",
      agentId: "negotiation",
    },
    {
      step: 5,
      at: atOffset(36),
      label: "Escrow prepares payment protection",
      detail: "Escrow drafts protection rails on branch-protection (parallel with Risk).",
      taskId: "escrow-prep",
      branchId: "branch-protection",
      agentId: "escrow",
    },
    {
      step: 6,
      at: atOffset(45),
      label: "Risk asks Discovery for help",
      detail: "help_requested: seller reputation history for Vendor Orion.",
      taskId: "risk-eval",
      agentId: "risk",
    },
    {
      step: 7,
      at: atOffset(60),
      label: "Ownership transfer: Escrow → Negotiation",
      detail:
        "Escrow hit unsupported payment rail (ACH→stablecoin bridge). Negotiation owns commercial settlement terms and can finish protection prep.",
      taskId: "escrow-prep",
      agentId: "negotiation",
    },
    {
      step: 8,
      at: atOffset(75),
      label: "Risk evaluation completes",
      detail: "Counterparty memo approved; dependency for terms unlocks.",
      taskId: "risk-eval",
      agentId: "risk",
    },
    {
      step: 9,
      at: atOffset(85),
      label: "Escrow protection completed by Negotiation",
      detail: "Transferred escrow-prep reaches 100%; negotiate unblocks.",
      taskId: "escrow-prep",
      agentId: "negotiation",
    },
    {
      step: 10,
      at: atOffset(90),
      label: "Negotiation prepares terms",
      detail: "Commercial terms drafted after both parallel branches finish.",
      taskId: "negotiate",
      agentId: "negotiation",
    },
    {
      step: 11,
      at: atOffset(104),
      label: "Branches converge; Reviewer checks",
      detail: "branch-counterparty and branch-protection merge into reviewed deal package.",
      taskId: "review",
      agentId: "reviewer",
    },
    {
      step: 12,
      at: atOffset(120),
      label: "Workflow completed",
      detail: "Full auditable event history retained; demo only — not live commerce.",
      agentId: "reviewer",
    },
  ];
}

/**
 * Apply the full marketplace demo event sequence.
 * Pure and deterministic (fixed timestamps). Uses transferOwnership for the handoff.
 */
export function runDemoToCompletion(): WorkflowSnapshot {
  let snap = createEmptyWorkflow();

  for (const agent of DEMO_AGENTS) {
    snap = applyEvent(snap, {
      type: "agent_presence_changed",
      at: atOffset(0),
      agentId: agent.id,
      presence: "idle",
      name: agent.name,
      role: agent.role,
      avatarHint: agent.avatarHint,
    });
  }

  // 1. Coordinator receives marketplace objective
  snap = applyEvent(snap, {
    type: "task_assigned",
    at: atOffset(1),
    taskId: "intake",
    agentId: "coordinator",
    title: "Receive marketplace objective",
  });
  snap = applyEvent(snap, {
    type: "task_started",
    at: atOffset(2),
    taskId: "intake",
    agentId: "coordinator",
  });
  snap = applyEvent(snap, {
    type: "message_sent",
    at: atOffset(3),
    messageId: "msg-objective",
    fromAgentId: "coordinator",
    kind: "status",
    text: `${DEMO_LABEL}: Source vetted B2B listings for industrial sensors; target close in 48h.`,
    taskId: "intake",
  });
  snap = applyEvent(snap, {
    type: "task_progress",
    at: atOffset(6),
    taskId: "intake",
    progress: 100,
  });
  snap = applyEvent(snap, {
    type: "task_completed",
    at: atOffset(10),
    taskId: "intake",
    agentId: "coordinator",
  });

  // 2. Discovery searches
  snap = applyEvent(snap, {
    type: "task_assigned",
    at: atOffset(11),
    taskId: "discover",
    agentId: "discovery",
    title: "Search marketplace opportunities",
    dependsOnTaskIds: ["intake"],
  });
  snap = applyEvent(snap, {
    type: "dependency_completed",
    at: atOffset(11),
    taskId: "discover",
    dependencyTaskId: "intake",
  });
  snap = applyEvent(snap, {
    type: "task_started",
    at: atOffset(12),
    taskId: "discover",
    agentId: "discovery",
  });
  snap = applyEvent(snap, {
    type: "task_progress",
    at: atOffset(20),
    taskId: "discover",
    progress: 60,
  });
  snap = applyEvent(snap, {
    type: "message_sent",
    at: atOffset(25),
    messageId: "msg-discover-hit",
    fromAgentId: "discovery",
    toAgentId: "coordinator",
    kind: "status",
    text: "Shortlist: Vendor Orion (primary), Helix Parts, Nova Supply.",
    taskId: "discover",
  });
  snap = applyEvent(snap, {
    type: "task_completed",
    at: atOffset(30),
    taskId: "discover",
    agentId: "discovery",
  });

  // Parallel branches: Risk + Escrow (independent)
  snap = applyEvent(snap, {
    type: "branch_forked",
    at: atOffset(31),
    branchId: "branch-counterparty",
    fromTaskId: "discover",
    taskIds: ["risk-eval"],
  });
  snap = applyEvent(snap, {
    type: "branch_forked",
    at: atOffset(31),
    branchId: "branch-protection",
    fromTaskId: "discover",
    taskIds: ["escrow-prep"],
  });

  // 3. Risk evaluates
  snap = applyEvent(snap, {
    type: "task_assigned",
    at: atOffset(32),
    taskId: "risk-eval",
    agentId: "risk",
    title: "Evaluate counterparties",
    dependsOnTaskIds: ["discover"],
    branchId: "branch-counterparty",
  });

  // 5. Escrow prepares protection (assigned before start so both can go active)
  snap = applyEvent(snap, {
    type: "task_assigned",
    at: atOffset(32),
    taskId: "escrow-prep",
    agentId: "escrow",
    title: "Prepare payment protection",
    dependsOnTaskIds: ["discover"],
    branchId: "branch-protection",
  });

  // 4 / 7. Negotiation blocked by dependency on both branches
  snap = applyEvent(snap, {
    type: "task_assigned",
    at: atOffset(33),
    taskId: "negotiate",
    agentId: "negotiation",
    title: "Prepare commercial terms",
    dependsOnTaskIds: ["risk-eval", "escrow-prep"],
  });
  snap = applyEvent(snap, {
    type: "task_blocked",
    at: atOffset(34),
    taskId: "negotiate",
    agentId: "negotiation",
    reason: "Blocked on risk-eval and escrow-prep",
  });

  // ≥2 concurrent active tasks on different branchIds
  snap = applyEvent(snap, {
    type: "task_started",
    at: atOffset(35),
    taskId: "risk-eval",
    agentId: "risk",
  });
  snap = applyEvent(snap, {
    type: "task_started",
    at: atOffset(36),
    taskId: "escrow-prep",
    agentId: "escrow",
  });

  // 8. help_requested — Risk asks Discovery
  snap = applyEvent(snap, {
    type: "help_requested",
    at: atOffset(45),
    fromAgentId: "risk",
    toAgentId: "discovery",
    taskId: "risk-eval",
    text: "Need seller reputation history for Vendor Orion before I can score counterparty risk.",
    messageId: "msg-help-risk",
  });
  snap = applyEvent(snap, {
    type: "message_sent",
    at: atOffset(48),
    messageId: "msg-help-reply",
    fromAgentId: "discovery",
    toAgentId: "risk",
    kind: "chat",
    text: "Orion: 4.8/5 across 62 deals; no open disputes.",
    taskId: "risk-eval",
  });
  snap = applyEvent(snap, {
    type: "task_started",
    at: atOffset(50),
    taskId: "risk-eval",
    agentId: "risk",
  });

  snap = applyEvent(snap, {
    type: "task_progress",
    at: atOffset(55),
    taskId: "escrow-prep",
    progress: 40,
  });

  // 9. Ownership transfer with full reason (Escrow → Negotiation)
  const { snapshot: afterTransfer } = transferOwnership(snap, {
    taskId: "escrow-prep",
    toAgentId: "negotiation",
    reason:
      "Escrow hit unsupported payment rail (ACH→stablecoin bridge). Negotiation owns commercial settlement terms and can finish protection prep.",
    at: atOffset(60),
    transferId: "xfer-escrow-to-negotiation",
    nextState: "active",
  });
  snap = afterTransfer;

  snap = applyEvent(snap, {
    type: "task_progress",
    at: atOffset(70),
    taskId: "risk-eval",
    progress: 100,
  });
  snap = applyEvent(snap, {
    type: "task_completed",
    at: atOffset(75),
    taskId: "risk-eval",
    agentId: "risk",
  });

  snap = applyEvent(snap, {
    type: "task_progress",
    at: atOffset(80),
    taskId: "escrow-prep",
    progress: 100,
  });
  snap = applyEvent(snap, {
    type: "task_completed",
    at: atOffset(85),
    taskId: "escrow-prep",
    agentId: "negotiation",
  });

  // Recover blocked negotiate after deps complete
  snap = applyEvent(snap, {
    type: "dependency_completed",
    at: atOffset(86),
    taskId: "negotiate",
    dependencyTaskId: "risk-eval",
  });
  snap = applyEvent(snap, {
    type: "dependency_completed",
    at: atOffset(87),
    taskId: "negotiate",
    dependencyTaskId: "escrow-prep",
  });
  snap = applyEvent(snap, {
    type: "task_unblocked",
    at: atOffset(88),
    taskId: "negotiate",
    agentId: "negotiation",
    nextState: "active",
  });

  // 4 (continued). Negotiation prepares terms
  snap = applyEvent(snap, {
    type: "task_started",
    at: atOffset(90),
    taskId: "negotiate",
    agentId: "negotiation",
  });
  snap = applyEvent(snap, {
    type: "task_progress",
    at: atOffset(95),
    taskId: "negotiate",
    progress: 70,
  });
  snap = applyEvent(snap, {
    type: "task_completed",
    at: atOffset(100),
    taskId: "negotiate",
    agentId: "negotiation",
  });

  // 11. Branches converge into reviewed result
  snap = applyEvent(snap, {
    type: "branch_merged",
    at: atOffset(101),
    branchId: "branch-counterparty",
    intoTaskId: "review",
  });
  snap = applyEvent(snap, {
    type: "branch_merged",
    at: atOffset(102),
    branchId: "branch-protection",
    intoTaskId: "review",
  });

  // 6. Reviewer checks
  snap = applyEvent(snap, {
    type: "task_assigned",
    at: atOffset(103),
    taskId: "review",
    agentId: "reviewer",
    title: "Review marketplace deal package",
    dependsOnTaskIds: ["negotiate"],
  });
  snap = applyEvent(snap, {
    type: "review_requested",
    at: atOffset(104),
    taskId: "review",
    fromAgentId: "negotiation",
    toAgentId: "reviewer",
    messageId: "msg-review",
    text: "PTAL: terms + escrow protection + risk memo ready for marketplace close.",
  });
  snap = applyEvent(snap, {
    type: "review_approved",
    at: atOffset(110),
    taskId: "review",
    reviewerAgentId: "reviewer",
  });

  // 12. workflow_completed
  snap = applyEvent(snap, {
    type: "workflow_completed",
    at: atOffset(120),
  });

  return snap;
}

/**
 * Build the completed marketplace demo snapshot.
 * Same as runDemoToCompletion — UI may call either.
 */
export function buildMarketplaceDemoWorkflow(): WorkflowSnapshot {
  return runDemoToCompletion();
}

/** Events recorded by a completed demo run (auditable history). */
export function demoEventLog(): WorkflowEvent[] {
  return runDemoToCompletion().events;
}
