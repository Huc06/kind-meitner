import { describe, expect, it } from "vitest";
import {
  buildSampleWorkflowSnapshot,
  DEFAULT_BOT_ROLES,
} from "./team-map-sample-workflow";

describe("Deterministic Sample Workflow Scenario (14 beats)", () => {
  it("derives all facts strictly from event timestamps and counts without fabrication", () => {
    const { snapshot, facts } = buildSampleWorkflowSnapshot();

    // 1. Agents count
    expect(facts.agentCount).toBe(5);
    expect(facts.parallelBranchCount).toBe(3);
    expect(facts.maxConcurrentActiveAgents).toBe(3); // 3 agents working simultaneously

    // 2. Transfers
    expect(facts.ownershipTransfers).toBe(1);
    const transfer = snapshot.transfers[0];
    expect(transfer).toBeDefined();
    expect(transfer?.fromAgentId).toBe(DEFAULT_BOT_ROLES.coordinatorId);
    expect(transfer?.toAgentId).toBe(DEFAULT_BOT_ROLES.escrowId);
    expect(transfer?.messagesTransferred).toBe(4);
    expect(transfer?.artifactsTransferred).toBe(2);
    expect(transfer?.decisionsTransferred).toBe(1);
    expect(transfer?.progressAtTransfer).toBe(68);

    // 3. Blocked and recovered
    expect(facts.blockedRecovered).toBeGreaterThanOrEqual(1);

    // 4. Reviews completed
    expect(facts.reviewsCompleted).toBeGreaterThanOrEqual(1);

    // 5. Tasks completed
    expect(facts.tasksCompleted).toBe(3);

    // 6. Speedup and time saved
    expect(facts.speedup).toBeGreaterThan(1);
    expect(facts.timeSavedMs).toBeGreaterThan(0);
    expect(facts.elapsedMs).toBeGreaterThan(0);
  });

  it("retains all artifacts submitted across agents", () => {
    const { snapshot } = buildSampleWorkflowSnapshot();
    expect(snapshot.artifacts.length).toBeGreaterThanOrEqual(3);
    const names = snapshot.artifacts.map((a) => a.name);
    expect(names).toContain("vendor-orion-diligence.json");
    expect(names).toContain("escrow-vault-contract.sol");
    expect(names).toContain("commercial-agreement-v2-72h.md");
  });

  it("records the help request from listing-coach to markets", () => {
    const { snapshot } = buildSampleWorkflowSnapshot();
    const helpMsg = snapshot.messages.find((m) => m.kind === "help");
    expect(helpMsg).toBeDefined();
    expect(helpMsg?.fromAgentId).toBe(DEFAULT_BOT_ROLES.listingCoachId);
    expect(helpMsg?.toAgentId).toBe(DEFAULT_BOT_ROLES.discoveryId);
  });
});
