import { describe, expect, it } from "vitest";

import {
  applyEvent,
  computeWowFacts,
  createEmptyWorkflow,
  getActiveAgents,
  getBlockedTasks,
  getCompletedTasks,
  getOwnershipTransfers,
  getWorkingAgents,
  reduceEvents,
  transferOwnership,
  type WorkflowEvent,
  type WorkflowSnapshot,
} from "./team-map-workflow";

function seedAgents(snapshot: WorkflowSnapshot, ids: string[]): WorkflowSnapshot {
  return ids.reduce(
    (snap, id) =>
      applyEvent(snap, {
        type: "agent_presence_changed",
        at: 1,
        agentId: id,
        presence: "idle",
        name: id,
        role: "worker",
      }),
    snapshot,
  );
}

describe("team-map-workflow", () => {
  it("createEmptyWorkflow starts with empty collections and null-ready wow facts", () => {
    const empty = createEmptyWorkflow();
    expect(empty).toEqual({
      agents: [],
      tasks: [],
      messages: [],
      artifacts: [],
      transfers: [],
      events: [],
      startedAt: 0,
    });
    const facts = computeWowFacts(empty);
    expect(facts.testsExecuted).toBeNull();
    expect(facts.elapsedMs).toBeNull();
    expect(facts.estimatedSequentialMs).toBeNull();
    expect(facts.speedup).toBeNull();
    expect(facts.timeSavedMs).toBeNull();
    expect(facts.agentCount).toBe(0);
    expect(facts.tasksCompleted).toBe(0);
    expect(facts.maxConcurrentActiveAgents).toBe(0);
    expect(facts.parallelBranchCount).toBe(0);
    expect(facts.agentMessages).toBe(0);
    expect(facts.ownershipTransfers).toBe(0);
    expect(facts.dependenciesResolved).toBe(0);
    expect(facts.reviewsCompleted).toBe(0);
    expect(facts.blockedRecovered).toBe(0);
  });

  it("ownership transfer records all required fields", () => {
    let snap = seedAgents(createEmptyWorkflow(), ["alice", "bob"]);
    snap = applyEvent(snap, {
      type: "task_assigned",
      at: 100,
      taskId: "t1",
      agentId: "alice",
      title: "Ship gate",
    });
    snap = applyEvent(snap, {
      type: "task_started",
      at: 110,
      taskId: "t1",
      agentId: "alice",
    });
    snap = applyEvent(snap, {
      type: "task_blocked",
      at: 120,
      taskId: "t1",
      agentId: "alice",
      reason: "needs review credentials",
    });

    const { snapshot, transfer, events } = transferOwnership(snap, {
      taskId: "t1",
      toAgentId: "bob",
      reason: "alice blocked; bob has credentials",
      at: 130,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ownership_transferred");

    expect(transfer).toMatchObject({
      id: transfer.id,
      taskId: "t1",
      fromAgentId: "alice",
      toAgentId: "bob",
      reason: "alice blocked; bob has credentials",
      at: 130,
      previousState: "blocked",
      nextState: "active",
    });
    expect(transfer.id.length).toBeGreaterThan(0);

    const task = snapshot.tasks.find((t) => t.id === "t1");
    expect(task?.ownerAgentId).toBe("bob");
    expect(task?.state).toBe("active");

    const alice = snapshot.agents.find((a) => a.id === "alice");
    const bob = snapshot.agents.find((a) => a.id === "bob");
    expect(alice?.presence).toBe("idle");
    expect(alice?.currentTaskId).toBeUndefined();
    expect(bob?.presence).toBe("working");
    expect(bob?.currentTaskId).toBe("t1");

    expect(getOwnershipTransfers(snapshot)).toHaveLength(1);
    expect(snapshot.transfers[0]).toEqual(transfer);
  });

  it("parallel tasks can be active at the same time", () => {
    let snap = seedAgents(createEmptyWorkflow(), ["a", "b", "c"]);
    snap = applyEvent(snap, {
      type: "task_assigned",
      at: 10,
      taskId: "t-a",
      agentId: "a",
      title: "A",
      branchId: "br-1",
    });
    snap = applyEvent(snap, {
      type: "task_assigned",
      at: 11,
      taskId: "t-b",
      agentId: "b",
      title: "B",
      branchId: "br-1",
    });
    snap = applyEvent(snap, {
      type: "branch_forked",
      at: 12,
      branchId: "br-1",
      taskIds: ["t-a", "t-b"],
    });
    snap = applyEvent(snap, {
      type: "task_started",
      at: 20,
      taskId: "t-a",
      agentId: "a",
    });
    snap = applyEvent(snap, {
      type: "task_started",
      at: 21,
      taskId: "t-b",
      agentId: "b",
    });

    const active = snap.tasks.filter((t) => t.state === "active");
    expect(active.map((t) => t.id).sort()).toEqual(["t-a", "t-b"]);
    expect(getWorkingAgents(snap).map((a) => a.id).sort()).toEqual(["a", "b"]);
    expect(getActiveAgents(snap).length).toBeGreaterThanOrEqual(2);

    const facts = computeWowFacts(snap);
    expect(facts.maxConcurrentActiveAgents).toBe(2);
    expect(facts.parallelBranchCount).toBe(1);
  });

  it("blocked → recovered via unblock and via ownership transfer", () => {
    let snap = seedAgents(createEmptyWorkflow(), ["a", "b"]);
    snap = applyEvent(snap, {
      type: "task_assigned",
      at: 1,
      taskId: "t1",
      agentId: "a",
      title: "Gate",
    });
    snap = applyEvent(snap, {
      type: "task_started",
      at: 2,
      taskId: "t1",
      agentId: "a",
    });
    snap = applyEvent(snap, {
      type: "task_blocked",
      at: 3,
      taskId: "t1",
      agentId: "a",
    });
    expect(getBlockedTasks(snap)).toHaveLength(1);

    snap = applyEvent(snap, {
      type: "task_unblocked",
      at: 4,
      taskId: "t1",
      agentId: "a",
      nextState: "active",
    });
    expect(getBlockedTasks(snap)).toHaveLength(0);
    expect(snap.tasks.find((t) => t.id === "t1")?.state).toBe("active");

    // Second block + ownership recovery
    snap = applyEvent(snap, {
      type: "task_blocked",
      at: 5,
      taskId: "t1",
      agentId: "a",
    });
    const { snapshot } = transferOwnership(snap, {
      taskId: "t1",
      toAgentId: "b",
      reason: "handoff after block",
      at: 6,
    });
    expect(getBlockedTasks(snapshot)).toHaveLength(0);
    expect(snapshot.tasks.find((t) => t.id === "t1")?.state).toBe("active");

    const facts = computeWowFacts(snapshot);
    expect(facts.blockedRecovered).toBe(2);
  });

  it("wow facts match event log exactly for a small fixture", () => {
    const events: WorkflowEvent[] = [
      {
        type: "agent_presence_changed",
        at: 1000,
        agentId: "chief",
        presence: "idle",
        name: "Chief",
        role: "lead",
      },
      {
        type: "agent_presence_changed",
        at: 1000,
        agentId: "coder",
        presence: "idle",
        name: "Coder",
        role: "impl",
      },
      {
        type: "agent_presence_changed",
        at: 1000,
        agentId: "reviewer",
        presence: "idle",
        name: "Reviewer",
        role: "qa",
      },
      {
        type: "task_assigned",
        at: 1100,
        taskId: "design",
        agentId: "chief",
        title: "Design",
      },
      {
        type: "task_assigned",
        at: 1100,
        taskId: "impl",
        agentId: "coder",
        title: "Implement",
        dependsOnTaskIds: ["design"],
      },
      {
        type: "task_started",
        at: 1200,
        taskId: "design",
        agentId: "chief",
      },
      {
        type: "task_completed",
        at: 2200,
        taskId: "design",
        agentId: "chief",
      },
      {
        type: "dependency_completed",
        at: 2200,
        taskId: "impl",
        dependencyTaskId: "design",
      },
      {
        type: "branch_forked",
        at: 2250,
        branchId: "feature/x",
        taskIds: ["impl"],
      },
      {
        type: "task_started",
        at: 2300,
        taskId: "impl",
        agentId: "coder",
      },
      {
        type: "help_requested",
        at: 2500,
        fromAgentId: "coder",
        toAgentId: "chief",
        taskId: "impl",
        text: "Need API shape",
        messageId: "m1",
      },
      {
        type: "message_sent",
        at: 2600,
        messageId: "m2",
        fromAgentId: "chief",
        toAgentId: "coder",
        kind: "chat",
        text: "Use v2 schema",
        taskId: "impl",
      },
      {
        type: "task_started",
        at: 2700,
        taskId: "impl",
        agentId: "coder",
      },
      {
        type: "review_requested",
        at: 3700,
        taskId: "impl",
        fromAgentId: "coder",
        toAgentId: "reviewer",
        text: "PTAL",
        messageId: "m3",
      },
      {
        type: "review_approved",
        at: 4000,
        taskId: "impl",
        reviewerAgentId: "reviewer",
      },
      {
        type: "branch_merged",
        at: 4100,
        branchId: "feature/x",
        intoTaskId: "impl",
      },
      {
        type: "workflow_completed",
        at: 4200,
      },
    ];

    const snap = reduceEvents(events);
    const facts = computeWowFacts(snap);

    // Counts must equal what the event log / snapshot actually recorded.
    expect(facts.agentCount).toBe(3);
    expect(facts.agentMessages).toBe(snap.messages.length);
    expect(snap.messages).toHaveLength(3); // help + reply + review text
    expect(facts.ownershipTransfers).toBe(0);
    expect(facts.dependenciesResolved).toBe(1);
    expect(facts.reviewsCompleted).toBe(1);
    expect(facts.parallelBranchCount).toBe(1);
    expect(facts.blockedRecovered).toBe(0);
    expect(facts.tasksCompleted).toBe(getCompletedTasks(snap).length);
    expect(getCompletedTasks(snap).map((t) => t.id).sort()).toEqual([
      "design",
      "impl",
    ]);
    expect(facts.testsExecuted).toBeNull();

    // Wall clock: first event 1000 → completed 4200
    expect(facts.elapsedMs).toBe(4200 - 1000);

    // Sequential: design 1200→2200 (1000) + impl 2300→2500 (200) + 2700→3700 (1000)
    // review_requested closes? help_requested closes active; task_started reopens;
    // review_requested does NOT close via taskActiveDurations — check implementation.
    // In our reducer: help_requested closes; task_started opens; review_approved closes.
    // So impl durations: (2500-2300) + (4000-2700) = 200 + 1300 = 1500
    // design: 1000
    // total sequential = 2500
    expect(facts.estimatedSequentialMs).toBe(1000 + 200 + 1300);
    expect(facts.speedup).toBeCloseTo(2500 / 3200);
    expect(facts.timeSavedMs).toBe(0); // sequential < elapsed? 2500 < 3200 → saved 0
    expect(facts.timeSavedMs).toBe(Math.max(0, 2500 - 3200));

    // max concurrent: only one agent working at a time in this fixture
    expect(facts.maxConcurrentActiveAgents).toBe(1);
  });

  it("applyEvent is immutable", () => {
    const empty = createEmptyWorkflow();
    const next = applyEvent(empty, {
      type: "agent_presence_changed",
      at: 5,
      agentId: "x",
      presence: "working",
      name: "X",
      role: "r",
    });
    expect(empty.agents).toHaveLength(0);
    expect(empty.events).toHaveLength(0);
    expect(next.agents).toHaveLength(1);
    expect(next.events).toHaveLength(1);
    expect(next.startedAt).toBe(5);
  });

  it("query helpers filter agents and tasks", () => {
    let snap = seedAgents(createEmptyWorkflow(), ["a", "b"]);
    snap = applyEvent(snap, {
      type: "task_assigned",
      at: 1,
      taskId: "t1",
      agentId: "a",
      title: "T",
    });
    snap = applyEvent(snap, {
      type: "task_started",
      at: 2,
      taskId: "t1",
      agentId: "a",
    });
    snap = applyEvent(snap, {
      type: "task_assigned",
      at: 3,
      taskId: "t2",
      agentId: "b",
      title: "Blocked one",
    });
    snap = applyEvent(snap, {
      type: "task_started",
      at: 4,
      taskId: "t2",
      agentId: "b",
    });
    snap = applyEvent(snap, {
      type: "task_blocked",
      at: 5,
      taskId: "t2",
      agentId: "b",
    });
    snap = applyEvent(snap, {
      type: "task_completed",
      at: 6,
      taskId: "t1",
      agentId: "a",
    });

    expect(getWorkingAgents(snap).map((a) => a.id)).toEqual([]);
    expect(getBlockedTasks(snap).map((t) => t.id)).toEqual(["t2"]);
    expect(getCompletedTasks(snap).map((t) => t.id)).toEqual(["t1"]);
    expect(getActiveAgents(snap).map((a) => a.id)).toEqual(["b"]);
  });
});
