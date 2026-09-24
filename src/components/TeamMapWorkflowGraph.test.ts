import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamMapWorkflowGraph } from "@/components/TeamMapWorkflowGraph";
import { TeamMapWowFacts } from "@/components/TeamMapWowFacts";
import { buildMarketplaceDemoWorkflow } from "@/lib/team-map-demo";
import { computeWowFacts } from "@/lib/team-map-workflow";

describe("TeamMapWorkflowGraph Component", () => {
  it("renders 2D spatial DAG with parallel branches and objective", () => {
    const snapshot = buildMarketplaceDemoWorkflow();
    const markup = renderToStaticMarkup(
      createElement(TeamMapWorkflowGraph, {
        snapshot,
        currentStep: 7,
        selectedTaskId: "escrow-prep",
        selectedAgentId: "escrow",
        onSelectTask: () => {},
        onSelectAgent: () => {},
      }),
    );

    expect(markup).toContain("Autonomous Workflow DAG");
    expect(markup).toContain("Stage 1");
    expect(markup).toContain("Stage 2 · Parallel Agent Branches");
    expect(markup).toContain("Stage 3");
    expect(markup).toContain("Marketplace Objective");
    expect(markup).toContain("B2B Industrial Sensor Sourcing");
    expect(markup).toContain("Branch 1 · Catalog Discovery");
    expect(markup).toContain("Branch 2 · Counterparty Risk");
    expect(markup).toContain("Branch 3 · Payment Protection");
    expect(markup).toContain("Commercial Terms");
    expect(markup).toContain("Jury Review");
    expect(markup).toContain("Handoff: Escrow → Negotiation");
    expect(markup).toContain("Context preserved");
    expect(markup).toContain("<svg");
    expect(markup).toContain("dag-arrow");
  });

  it("renders interactive wow facts with click drill-down hint", () => {
    const snapshot = buildMarketplaceDemoWorkflow();
    const facts = computeWowFacts(snapshot);
    const markup = renderToStaticMarkup(
      createElement(TeamMapWowFacts, {
        facts,
        activeMetricId: "parallel-branches",
      }),
    );

    expect(markup).toContain("Workflow facts");
    expect(markup).toContain("Parallel branches");
    expect(markup).toContain("Ownership transfers");
    expect(markup).toContain("Parallel speedup");
    expect(markup).toContain("Time saved");
  });
});
