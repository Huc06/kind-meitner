import { describe, expect, it } from "vitest";

import {
  DEMO_AGENTS,
  DEMO_LABEL,
  DEMO_START_AT,
  buildMarketplaceDemoWorkflow,
  demoTimelineSteps,
  isDemoWorkflow,
  runDemoToCompletion,
} from "./team-map-demo";
import {
  applyEvent,
  computeWowFacts,
  createEmptyWorkflow,
} from "./team-map-workflow";

describe("team-map-demo marketplace", () => {
  it("exports DEMO_LABEL and isDemoWorkflow", () => {
    expect(DEMO_LABEL).toBe("Demo data — not live commerce");
    expect(isDemoWorkflow).toBe(true);
    expect(DEMO_START_AT).toBe(1_700_000_000_000);
  });

  it("runDemoToCompletion produces workflow_completed with auditable history", () => {
    const snap = runDemoToCompletion();
    expect(snap.events.some((e) => e.type === "workflow_completed")).toBe(true);
    expect(snap.completedAt).toBe(DEMO_START_AT + 120_000);
    expect(snap.startedAt).toBe(DEMO_START_AT);
    expect(snap.events.length).toBeGreaterThan(20);
    expect(snap.agents.map((a) => a.id).sort()).toEqual(
      [...DEMO_AGENTS].map((a) => a.id).sort(),
    );
  });

  it("buildMarketplaceDemoWorkflow matches runDemoToCompletion", () => {
    const a = buildMarketplaceDemoWorkflow();
    const b = runDemoToCompletion();
    expect(a.events).toEqual(b.events);
    expect(a.transfers).toEqual(b.transfers);
    expect(a.completedAt).toBe(b.completedAt);
  });

  it("includes ≥1 ownership transfer with full reason", () => {
    const snap = runDemoToCompletion();
    expect(snap.transfers.length).toBeGreaterThanOrEqual(1);
    const xfer = snap.transfers.find((t) => t.id === "xfer-escrow-to-negotiation");
    expect(xfer).toBeDefined();
    expect(xfer!.fromAgentId).toBe("escrow");
    expect(xfer!.toAgentId).toBe("negotiation");
    expect(xfer!.taskId).toBe("escrow-prep");
    expect(xfer!.reason.length).toBeGreaterThan(20);
    expect(xfer!.reason).toMatch(/payment rail/i);
    expect(xfer!.previousState).toBeDefined();
    expect(xfer!.nextState).toBe("active");
    expect(
      snap.events.filter((e) => e.type === "ownership_transferred"),
    ).toHaveLength(snap.transfers.length);
  });

  it("includes ≥1 blocked then recovered", () => {
    const snap = runDemoToCompletion();
    const blocked = snap.events.filter((e) => e.type === "task_blocked");
    const unblocked = snap.events.filter((e) => e.type === "task_unblocked");
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(unblocked.length).toBeGreaterThanOrEqual(1);
    expect(
      blocked.some((e) => e.type === "task_blocked" && e.taskId === "negotiate"),
    ).toBe(true);
    const facts = computeWowFacts(snap);
    expect(facts.blockedRecovered).toBeGreaterThanOrEqual(1);
  });

  it("includes ≥1 help_requested", () => {
    const snap = runDemoToCompletion();
    const helps = snap.events.filter((e) => e.type === "help_requested");
    expect(helps.length).toBeGreaterThanOrEqual(1);
    const help = helps[0];
    if (help.type !== "help_requested") throw new Error("unreachable");
    expect(help.fromAgentId).toBe("risk");
    expect(help.toAgentId).toBe("discovery");
    expect(help.text.length).toBeGreaterThan(0);
    expect(snap.messages.some((m) => m.kind === "help")).toBe(true);
  });

  it("includes ≥2 parallel branches with concurrent active tasks", () => {
    const snap = runDemoToCompletion();
    const forks = snap.events.filter((e) => e.type === "branch_forked");
    expect(forks.length).toBeGreaterThanOrEqual(2);
    const branchIds = new Set(
      forks.map((e) => (e.type === "branch_forked" ? e.branchId : "")),
    );
    expect(branchIds.has("branch-counterparty")).toBe(true);
    expect(branchIds.has("branch-protection")).toBe(true);

    let cursor = createEmptyWorkflow();
    let sawParallel = false;
    for (const event of snap.events) {
      cursor = applyEvent(cursor, event);
      const active = cursor.tasks.filter((t) => t.state === "active");
      const branches = new Set(
        active.map((t) => t.branchId).filter((id): id is string => Boolean(id)),
      );
      if (active.length >= 2 && branches.size >= 2) {
        sawParallel = true;
        break;
      }
    }
    expect(sawParallel).toBe(true);

    const facts = computeWowFacts(snap);
    expect(facts.parallelBranchCount).toBeGreaterThanOrEqual(2);
    expect(facts.maxConcurrentActiveAgents).toBeGreaterThanOrEqual(2);
  });

  it("computeWowFacts numbers match events", () => {
    const snap = runDemoToCompletion();
    const facts = computeWowFacts(snap);

    expect(facts.agentCount).toBe(DEMO_AGENTS.length);
    expect(facts.ownershipTransfers).toBe(snap.transfers.length);
    expect(facts.ownershipTransfers).toBe(
      snap.events.filter((e) => e.type === "ownership_transferred").length,
    );
    expect(facts.agentMessages).toBe(snap.messages.length);
    expect(facts.dependenciesResolved).toBe(
      snap.events.filter((e) => e.type === "dependency_completed").length,
    );
    expect(facts.reviewsCompleted).toBe(
      snap.events.filter(
        (e) => e.type === "review_approved" || e.type === "review_rejected",
      ).length,
    );
    expect(facts.reviewsCompleted).toBeGreaterThanOrEqual(1);
    expect(facts.parallelBranchCount).toBe(
      new Set(
        snap.events
          .filter((e) => e.type === "branch_forked")
          .map((e) => (e.type === "branch_forked" ? e.branchId : "")),
      ).size,
    );
    expect(facts.blockedRecovered).toBeGreaterThanOrEqual(1);
    expect(facts.tasksCompleted).toBeGreaterThanOrEqual(5);
    expect(facts.elapsedMs).toBe(120_000);
    expect(facts.testsExecuted).toBeNull();
  });

  it("covers all six agent roles and demo label in messages", () => {
    const snap = runDemoToCompletion();
    const roles = new Set(snap.agents.map((a) => a.role));
    for (const agent of DEMO_AGENTS) {
      expect(roles.has(agent.role)).toBe(true);
    }
    expect(snap.messages.some((m) => m.text.includes(DEMO_LABEL))).toBe(true);
    expect(isDemoWorkflow).toBe(true);
  });

  it("demoTimelineSteps returns 12 ordered human-readable steps", () => {
    const steps = demoTimelineSteps();
    expect(steps).toHaveLength(12);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const step of steps) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
      expect(step.at).toBeGreaterThanOrEqual(DEMO_START_AT);
    }
    expect(steps[0].detail).toContain(DEMO_LABEL);
    expect(steps[11].label.toLowerCase()).toMatch(/completed/);
  });

  it("is deterministic across runs", () => {
    const a = runDemoToCompletion();
    const b = runDemoToCompletion();
    expect(a).toEqual(b);
  });
});
