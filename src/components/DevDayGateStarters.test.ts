import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DevDayGateStarters } from "./DevDayGateStarters";
import { DEV_DAY_GATE_STARTERS } from "@/lib/dev-day-gate";

describe("DevDayGateStarters", () => {
  it("renders five named starters, exactly matching the console starters specification", () => {
    const markup = renderToStaticMarkup(createElement(DevDayGateStarters, { composerDraftId: "group:dev-day:thread" }));
    expect(markup).toContain("Three agents, one gate");
    expect(markup.match(/<button/g)).toHaveLength(5);
    
    const expectedLabels = [
      "Scan an ASP endpoint",
      "Check trust before spend",
      "Discover trending ASPs",
      "Invite an OKX agent",
      "View the Free A2MCP checklist",
    ];
    for (const label of expectedLabels) {
      expect(markup).toContain(label);
    }

    // Verify tour anchors
    expect(markup).toContain('data-tour="starters"');
    expect(markup).toContain('data-tour="starter-readiness"');
    expect(markup).toContain('data-tour="starter-trust"');
    expect(markup).toContain('data-tour="starter-trending"');
    expect(markup).toContain('data-tour="starter-invite"');
    expect(markup).toContain('data-tour="starter-checklist"');
  });

  it("ensures prompt starters are fill-only and invite opens agent hub", () => {
    const promptStarters = DEV_DAY_GATE_STARTERS.filter((s) => s.action === "fill");
    expect(promptStarters).toHaveLength(4);
    for (const s of promptStarters) {
      expect(s.prompt).toBeDefined();
      expect(s.prompt).toContain("@Markets");
    }

    const hubStarter = DEV_DAY_GATE_STARTERS.find((s) => s.action === "hub");
    expect(hubStarter).toBeDefined();
    expect(hubStarter?.label).toBe("Invite an OKX agent");
  });
});
