import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamMapWowFacts } from "./TeamMapWowFacts";
import type { WowFacts } from "@/lib/team-map-workflow";

describe("TeamMapWowFacts Redesign", () => {
  const sampleFacts: WowFacts = {
    agentCount: 5,
    maxConcurrentActiveAgents: 3,
    parallelBranchCount: 3,
    agentMessages: 4,
    ownershipTransfers: 1,
    dependenciesResolved: 1,
    reviewsCompleted: 1,
    blockedRecovered: 1,
    tasksCompleted: 3,
    elapsedMs: 95000,
    estimatedSequentialMs: 171000,
    speedup: 1.8,
    timeSavedMs: 76000,
    testsExecuted: null, // Should display as "Not measured"
  };

  it("renders metric values with tabular figures and sentence case labels", () => {
    const markup = renderToStaticMarkup(
      createElement(TeamMapWowFacts, {
        facts: sampleFacts,
        activeMetricId: null,
      }),
    );

    expect(markup).toContain("Workflow facts");
    expect(markup).toContain("Derived from events");
    expect(markup).toContain("Select a metric to inspect supporting events");

    // Values
    expect(markup).toContain("5");
    expect(markup).toContain("3");
    expect(markup).toContain("4");
    expect(markup).toContain("1");
    expect(markup).toContain("1.80×");
    expect(markup).toContain("1m 16s");

    // Null displayed honestly as "Not measured"
    expect(markup).toContain("Not measured");
    expect(markup).not.toContain("Tests executed: 0");

    // Labels in sentence case
    expect(markup).toContain("Participating agents");
    expect(markup).toContain("Peak concurrent");
    expect(markup).toContain("Parallel branches");
    expect(markup).toContain("Ownership transfers");
    expect(markup).toContain("Blocked recovered");
    expect(markup).toContain("Reviews completed");
    expect(markup).toContain("Parallel speedup");
  });

  it("renders compact contextual inspector bar when a metric is selected", () => {
    const markup = renderToStaticMarkup(
      createElement(TeamMapWowFacts, {
        facts: sampleFacts,
        activeMetricId: "transfers",
        onSelectMetric: () => {},
        onResetMetric: () => {},
      }),
    );

    // Selected state on button
    expect(markup).toContain('aria-selected="true"');

    // Contextual Inspector Bar
    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Metric calculation details"');
    expect(markup).toContain("Ownership transfers:");
    expect(markup).toContain("1 task ownership handoff prevented stalling with full context preserved.");
    expect(markup).toContain("Reset filter");
  });
});
