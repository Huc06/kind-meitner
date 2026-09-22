import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DevDayGateStarters } from "./DevDayGateStarters";

describe("DevDayGateStarters", () => {
  it("renders four named composer-fill starters and an explicit send hint", () => {
    const markup = renderToStaticMarkup(createElement(DevDayGateStarters, { composerDraftId: "group:dev-day:thread" }));
    expect(markup).toContain("Three agents, one gate");
    expect(markup).toContain("Enter to send.");
    expect(markup.match(/<button/g)).toHaveLength(4);
    for (const label of ["Scan a vercel URL", "Scan our Railway Free MCP", "Trust agent 99999", "Trust agent 13837"]) {
      expect(markup).toContain(label);
    }
  });
});
