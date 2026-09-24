import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TeamMapAttentionRail,
  type AttentionItem,
} from "./TeamMapAttentionRail";

describe("TeamMapAttentionRail", () => {
  it("renders healthy operational state when no attention items exist", () => {
    const markup = renderToStaticMarkup(
      createElement(TeamMapAttentionRail, {
        items: [],
        onSelectItem: () => {},
      }),
    );

    expect(markup).toContain("All tracked agents healthy");
    expect(markup).toContain("No blockers or pending reviews");
    expect(markup).toContain("Select any agent to inspect workload");
  });

  it("prioritizes blocked items first and renders actionable next steps", () => {
    const items: AttentionItem[] = [
      {
        id: "att-rev",
        priority: "review",
        agentId: "spend-scout",
        agentName: "Spend Scout",
        taskTitle: "Review commercial terms",
        summary: "1 pending review approval required",
        recommendedAction: "Review",
      },
      {
        id: "att-block",
        priority: "blocked",
        agentId: "listing-coach",
        agentName: "Listing Coach",
        taskTitle: "Validate terms",
        summary: "Blocked on counterparty risk data",
        recommendedAction: "Unblock",
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(TeamMapAttentionRail, {
        items,
        selectedItemId: "att-block",
        onSelectItem: () => {},
      }),
    );

    expect(markup).toContain("Needs attention");
    expect(markup).toContain("2");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("Unblock");
    expect(markup).toContain("Review required");

    // Blocked item should appear before review item in DOM
    const blockIndex = markup.indexOf("Blocked on counterparty risk data");
    const reviewIndex = markup.indexOf("1 pending review approval required");
    expect(blockIndex).toBeLessThan(reviewIndex);
  });
});
