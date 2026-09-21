import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReadinessRunCard } from "./ReadinessRunCard";
import { TrustCard } from "./TrustCard";

describe("OKX action cards", () => {
  it("renders a readiness verdict, concrete fixes, fill-only re-scan action, and collapsed evidence", () => {
    const html = renderToStaticMarkup(createElement(ReadinessRunCard, {
      data: {
        kind: "readiness",
        endpointUrl: "https://demo.vercel.app/api/okx/free-mcp",
        verdict: "FAIL",
        checks: [{ id: "host_pitfall_vercel", status: "fail", detail: "host=demo.vercel.app" }],
        remediation: ["Replace *.vercel.app with a custom domain."],
        rawJson: '{"data":{"verdict":"FAIL"}}',
      },
      onRescan: () => {},
    }));

    expect(html).toContain("Readiness verdict FAIL");
    expect(html).toContain("Vercel host");
    expect(html).toContain("Copy fixes");
    expect(html).toContain("Re-scan");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('&quot;verdict&quot;');
  });

  it("renders a trust decision without a made-up score and always exposes not-checked evidence", () => {
    const html = renderToStaticMarkup(createElement(TrustCard, {
      data: {
        kind: "trust",
        agentId: "99999",
        decision: "NO_GO",
        summary: "Listing or endpoint checks failed.",
        signals: [{ id: "listing_page", status: "fail", detail: "HTTP 404" }],
        notChecked: ["on-chain credit score", "historical settlement volume", "OKX official endorsement"],
        remediation: [],
        safeNextStep: "Do not call pay/x402 tools. Fix listing or endpoint first.",
        rawJson: '{"data":{"decision":"NO_GO"}}',
      },
    }));

    expect(html).toContain("Trust decision NO_GO");
    expect(html).toContain("Not checked");
    expect(html).toContain("Copy next step");
    expect(html).toContain("Do not call pay/x402 tools.");
    expect(html).not.toContain("Trust score");
  });
});
