import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Message } from "@/state/store";
import { OkxGateToolResult } from "./OkxGateToolResult";

const message = (output: string): Message => ({
  id: "gate-result",
  role: "bot",
  kind: "activity",
  at: 1,
  tool: { name: "scan_free_mcp_readiness", ok: true, output },
});

describe("OkxGateToolResult", () => {
  it("falls back to the existing tool result with fixed parse-failure copy", () => {
    const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
      message: message("not JSON"),
      enabled: true,
      composerDraftId: "group:room:thread",
      fallback: createElement("div", null, "Normal tool result"),
    }));
    expect(html).toContain("The gate tool returned data this app could not read.");
    expect(html).toContain("Normal tool result");
    expect(html).not.toContain("Readiness verdict");
  });

  it("uses the parsed card rather than the fallback for a complete tool envelope", () => {
    const html = renderToStaticMarkup(createElement(OkxGateToolResult, {
      message: message(JSON.stringify({ data: {
        endpointUrl: "https://example.com/free-mcp",
        verdict: "PASS",
        checks: [{ id: "https_scheme", status: "pass", detail: "https" }],
        remediation: [],
      } })),
      enabled: true,
      composerDraftId: "bot:markets:thread",
      fallback: createElement("div", null, "Normal tool result"),
    }));
    expect(html).toContain("Readiness verdict PASS");
    expect(html).not.toContain("Normal tool result");
  });
});
